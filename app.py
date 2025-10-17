from flask import Flask, render_template, request, jsonify, Response
import json
import os
import threading
from queue import Queue, Empty
from dotenv import load_dotenv
from bot_logic import auto_reply, get_channel_info, get_bot_info, get_message_cache_info, refresh_message_cache
from concurrent.futures import ThreadPoolExecutor
import functools
import logging

load_dotenv()

app = Flask(__name__)

# Suppress BrokenPipeError logging for SSE connections
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

CONFIG_FILE = 'config.json'
active_threads = {}
log_queue = Queue()
executor = ThreadPoolExecutor(max_workers=5)  # Limit concurrent operations

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return create_default_config()
    return create_default_config()

def create_default_config():
    return {
        "discord_tokens": [token.strip() for token in os.getenv('DISCORD_TOKENS', '').split(',') if token.strip()],
        "google_api_keys": [key.strip() for key in os.getenv('GOOGLE_API_KEYS', '').split(',') if key.strip()],
        "openrouter_api_keys": [key.strip() for key in os.getenv('OPENROUTER_API_KEYS', '').split(',') if key.strip()],
        "tasks": []
    }

def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)

@functools.lru_cache(maxsize=32)
def get_bot_info_cached(token):
    """Cached version of get_bot_info to avoid repeated API calls"""
    return get_bot_info(token, None)

def log_emitter():
    """Generator for Server-Sent Events with timeout handling"""
    try:
        while True:
            try:
                # Use timeout to prevent infinite blocking
                message = log_queue.get(timeout=30)
                yield f"data: {message}\n\n"
                log_queue.task_done()
            except Empty:
                # Send keepalive comment every 30 seconds to prevent connection timeout
                yield f": keepalive\n\n"
    except (GeneratorExit, BrokenPipeError, ConnectionResetError):
        # Client disconnected, cleanup gracefully without logging error
        pass

@app.route('/')
def index():
    config = load_config()

    bot_accounts = []
    if config.get("discord_tokens"):
        # Use ThreadPoolExecutor for concurrent bot info retrieval
        future_to_index = {
            executor.submit(get_bot_info_cached, token): i
            for i, token in enumerate(config["discord_tokens"])
            if token and token.strip()
        }

        for future in future_to_index:
            try:
                i = future_to_index[future]
                username, discriminator, user_id = future.result(timeout=5)

                # Only add valid bot accounts (skip Invalid, Error, Timeout, Forbidden)
                if user_id not in ("UnknownID",) or username not in ("Invalid", "Error", "Timeout", "Forbidden"):
                    if user_id != "UnknownID":  # Valid token
                        bot_accounts.append({
                            "index": i, "username": username,
                            "discriminator": discriminator, "id": user_id
                        })
            except Exception as e:
                # Silently skip failed tokens
                pass

    for task in config.get("tasks", []):
        token_index = task.get("assigned_token_index", 0)
        token = (config["discord_tokens"][token_index]
                 if token_index < len(config["discord_tokens"])
                 else config["discord_tokens"][0] if config.get("discord_tokens") else None)
        
        if token:
            server, channel = get_channel_info(task.get("channel_id"), token, log_queue)
            task["server_name"] = server
            task["channel_name"] = channel
        
        task["status"] = ("Running" if task.get("id") in active_threads
                          and active_threads[task.get("id")].is_alive() else "Stopped")

    pesan_info = get_message_cache_info()
    return render_template('index.html', config=config, bot_accounts=bot_accounts, pesan_info=pesan_info)

@app.route('/logs')
def logs():
    """SSE endpoint for live logging with proper error handling"""
    response = Response(log_emitter(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response

@app.route('/refresh_pesan', methods=['POST'])
def handle_refresh_pesan():
    info = refresh_message_cache()
    return jsonify({"status": "success", "message": "pesan.txt di-refresh.", "info": info})

@app.route('/save_config', methods=['POST'])
def handle_save_config():
    new_config = request.json
    save_config(new_config)
    return jsonify({"status": "success", "message": "Perubahan disimpan!"})

@app.route('/start_bot', methods=['POST'])
def start_bot():
    data = request.json
    task_id = data.get('task_id')
    config = load_config()

    task_to_run = next((task for task in config.get("tasks", []) if task.get("id") == task_id), None)

    if not task_to_run:
        return jsonify({"status": "error", "message": "Tugas tidak ditemukan."}), 404

    if task_id in active_threads and active_threads[task_id].is_alive():
        return jsonify({"status": "warning", "message": "Tugas ini sudah berjalan."})

    token_index = task_to_run.get("assigned_token_index", 0)
    if token_index >= len(config.get('discord_tokens', [])):
        return jsonify({"status": "error", "message": "Token tidak valid."}), 400

    token = config['discord_tokens'][token_index]

    # Validate token before starting
    username, _, user_id = get_bot_info(token, log_queue)
    if user_id == "UnknownID" or username in ("Invalid", "Error", "Timeout", "Forbidden"):
        log_queue.put(f"❌ Token index {token_index} (ending ...{token[-4:]}) tidak valid atau expired.")
        return jsonify({"status": "error", "message": f"Token tidak valid. Silakan periksa token index {token_index}."}), 400

    channel_id = task_to_run.get("channel_id")
    google_keys = config['google_api_keys']
    openrouter_keys = config.get('openrouter_api_keys', [])

    stop_event = threading.Event()
    thread = threading.Thread(target=auto_reply, args=(
        channel_id, task_to_run, token, google_keys, log_queue, stop_event, openrouter_keys), daemon=True)

    active_threads[task_id] = thread
    active_threads[task_id].stop_event = stop_event
    thread.start()

    log_queue.put(f"✅ [{channel_id}] Tugas '{task_id}' dimulai dengan akun: {username}.")
    return jsonify({"status": "success", "message": "Tugas berhasil dimulai."})

@app.route('/stop_bot', methods=['POST'])
def stop_bot():
    data = request.json
    task_id = data.get('task_id')

    if task_id in active_threads and active_threads[task_id].is_alive():
        active_threads[task_id].stop_event.set()
        del active_threads[task_id]
        log_queue.put(f"🛑 Tugas '{task_id}' berhasil dihentikan.")
        return jsonify({"status": "success", "message": "Tugas dihentikan."})

    return jsonify({"status": "error", "message": "Tugas tidak sedang berjalan."}), 404

if __name__ == '__main__':
    # Disable Flask reloader logging for cleaner output
    import sys
    if '--no-reload' not in sys.argv:
        app.logger.setLevel(logging.WARNING)

    app.run(debug=True, host='0.0.0.0', port=5005)
