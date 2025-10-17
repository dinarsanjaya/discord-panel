import time
import requests
import random
import threading
from datetime import datetime
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

processed_message_ids = set()
used_api_keys = set()
last_generated_text = None
cooldown_time = 86400
MAX_PROCESSED_IDS = 1000  # Limit memory usage

# Cache for pesan.txt to avoid reading file repeatedly
_message_cache = None
_message_cache_time = 0
MESSAGE_CACHE_TTL = 300  # 5 minutes

# Create a session with connection pooling and retry strategy
session = requests.Session()
retry_strategy = Retry(
    total=3,
    status_forcelist=[429, 500, 502, 503, 504],
    backoff_factor=1
)
adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
session.mount("http://", adapter)
session.mount("https://", adapter)


def log_message(queue, message, level="INFO"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    icon_map = {
        "SUCCESS": "✅",
        "ERROR": "🚨",
        "WARNING": "⚠️",
        "WAIT": "⌛",
        "INFO": "ℹ️",
    }
    icon = icon_map.get(level.upper(), "ℹ️")
    formatted_message = f"[{timestamp}] {icon} {message}"
    if queue:
        queue.put(formatted_message)
    else:
        print(formatted_message)


def get_cached_messages():
    """Get messages from cache or file with TTL"""
    global _message_cache, _message_cache_time
    current_time = time.time()

    if _message_cache is None or current_time - _message_cache_time > MESSAGE_CACHE_TTL:
        try:
            with open("pesan.txt", "r", encoding="utf-8") as file:
                messages = [line.strip() for line in file.readlines() if line.strip()]
                _message_cache = messages if messages else ["Tidak ada pesan di pesan.txt"]
                _message_cache_time = current_time
        except FileNotFoundError:
            _message_cache = ["File pesan.txt tidak ditemukan!"]
            _message_cache_time = current_time

    return _message_cache


def get_message_cache_info():
    """Return pesan.txt cache info: count and last refresh time (epoch)."""
    global _message_cache, _message_cache_time
    messages = _message_cache if _message_cache is not None else []
    return {
        "count": len(messages),
        "last_refresh": _message_cache_time,
    }


def refresh_message_cache():
    """Force refresh pesan.txt cache immediately."""
    global _message_cache, _message_cache_time
    _message_cache = None
    # Trigger load to repopulate immediately
    get_cached_messages()
    return get_message_cache_info()


def manage_processed_ids():
    """Manage memory usage by limiting processed message IDs"""
    global processed_message_ids
    if len(processed_message_ids) > MAX_PROCESSED_IDS:
        # Keep only the most recent half
        ids_list = list(processed_message_ids)
        processed_message_ids = set(ids_list[-MAX_PROCESSED_IDS//2:])


def get_random_api_key(google_api_keys, queue):
    global used_api_keys
    available_keys = [key for key in google_api_keys if key not in used_api_keys]
    if not available_keys:
        log_message(queue, "Semua API key 429. Menunggu 24 jam...", "ERROR")
        time.sleep(cooldown_time)
        used_api_keys.clear()
        return get_random_api_key(google_api_keys, queue)
    return random.choice(available_keys)


def generate_reply_openrouter(prompt, prompt_language, openrouter_api_key, model_id, queue):
    """Generate reply using OpenRouter API"""
    global last_generated_text

    if not openrouter_api_key:
        log_message(queue, "Tidak ada OpenRouter API Key.", "ERROR")
        return None

    if prompt_language == "id":
        ai_prompt = f"Balas pesan berikut dalam Bahasa Indonesia: '{prompt}'. Buat balasan menjadi satu kalimat santai dan kasual tanpa simbol seperti yang diucapkan manusia sehari-hari."
    else:
        ai_prompt = f"Reply to the following message in English: '{prompt}'. Make the reply a single, casual sentence like a human would say."

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/shareithub",
    }

    data = {
        "model": model_id,
        "messages": [
            {"role": "user", "content": ai_prompt}
        ]
    }

    try:
        response = session.post(url, headers=headers, json=data, timeout=30)

        if response.status_code == 429:
            log_message(queue, f"⚠️ OpenRouter rate limit (429)", "WARNING")
            return None

        if response.status_code == 401:
            log_message(queue, f"⚠️ OpenRouter API key tidak valid", "ERROR")
            return None

        response.raise_for_status()
        result = response.json()

        if "choices" not in result or not result["choices"]:
            log_message(queue, f"⚠️ No response from OpenRouter", "WARNING")
            return None

        generated_text = result["choices"][0]["message"]["content"].strip()

        if generated_text.lower() == last_generated_text or not generated_text:
            log_message(queue, "Duplicate response detected, regenerating...", "INFO")
            return generate_reply_openrouter(prompt, prompt_language, openrouter_api_key, model_id, queue)

        last_generated_text = generated_text.lower()
        log_message(queue, f"✅ AI reply generated using OpenRouter ({model_id})", "SUCCESS")
        return generated_text

    except requests.exceptions.RequestException as e:
        log_message(queue, f"OpenRouter request failed: {str(e)[:100]}", "ERROR")
        return None
    except (KeyError, IndexError) as e:
        log_message(queue, f"Invalid OpenRouter response: {e}", "ERROR")
        return None


def generate_reply(prompt, prompt_language, use_google_ai, google_api_keys, queue):
    global last_generated_text
    if use_google_ai:
        if not google_api_keys or not any(google_api_keys):
            log_message(queue, "Tidak ada Google API Key.", "ERROR")
            return None

        google_api_key = get_random_api_key(google_api_keys, queue)

        if prompt_language == "id":
            ai_prompt = f"Balas pesan berikut dalam Bahasa Indonesia: '{prompt}'. Buat balasan menjadi satu kalimat santai dan kasual tanpa simbol seperti yang diucapkan manusia sehari-hari."
        else:
            ai_prompt = f"Reply to the following message in English: '{prompt}'. Make the reply a single, casual sentence like a human would say."

        # Prefer official google-genai SDK; fall back to REST if unavailable
        try:
            from google import genai  # type: ignore

            client = genai.Client(api_key=google_api_key)
            # Use latest stable model
            model_id = "gemini-2.0-flash-exp"
            try:
                sdk_response = client.models.generate_content(
                    model=model_id,
                    contents=ai_prompt,
                )
                generated_text = (getattr(sdk_response, "text", None) or "").strip()
                if generated_text:
                    if generated_text.lower() == last_generated_text:
                        return generate_reply(prompt, prompt_language, use_google_ai, google_api_keys, queue)
                    last_generated_text = generated_text.lower()
                    log_message(queue, f"✅ AI reply generated using SDK ({model_id})", "SUCCESS")
                    return generated_text
            except Exception as sdk_e:
                log_message(queue, f"SDK error ({model_id}): {sdk_e}. Fallback to REST.", "WARNING")
        except ImportError:
            # SDK not installed; continue to REST
            log_message(queue, "Google GenAI SDK not found, using REST API", "INFO")
        except Exception as e:
            log_message(queue, f"SDK initialization error: {e}. Using REST API.", "WARNING")

        # REST fallback with updated model candidates (only working models)
        model_candidates = [
            "gemini-2.0-flash-exp",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
        ]

        headers = {
            "Content-Type": "application/json",
        }
        data = {"contents": [{"role": "user", "parts": [{"text": ai_prompt}]}]}

        for model_id in model_candidates:
            # Use query parameter for API key instead of header (more compatible)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={google_api_key}"
            try:
                response = session.post(url, headers=headers, json=data, timeout=20)

                if response.status_code == 404:
                    log_message(queue, f"⚠️ Model {model_id} not found (404), trying next model...", "WARNING")
                    continue

                if response.status_code == 429:
                    log_message(queue, f"⚠️ API key rate limit (429), marking key as used", "WARNING")
                    used_api_keys.add(google_api_key)
                    return None

                if response.status_code == 400:
                    error_detail = response.json().get("error", {}).get("message", "Unknown error")
                    log_message(queue, f"⚠️ Bad request for {model_id}: {error_detail}", "WARNING")
                    continue

                response.raise_for_status()
                result = response.json()

                # Better error handling for response structure
                if "candidates" not in result or not result["candidates"]:
                    log_message(queue, f"⚠️ No candidates in response for {model_id}", "WARNING")
                    continue

                generated_text = result["candidates"][0]["content"]["parts"][0]["text"].strip()

                if generated_text.lower() == last_generated_text or not generated_text:
                    log_message(queue, "Duplicate response detected, regenerating...", "INFO")
                    return generate_reply(prompt, prompt_language, use_google_ai, google_api_keys, queue)

                last_generated_text = generated_text.lower()
                log_message(queue, f"✅ AI reply generated using REST ({model_id})", "SUCCESS")
                return generated_text

            except requests.exceptions.HTTPError as e:
                log_message(queue, f"HTTP error for {model_id}: {e.response.status_code}", "ERROR")
                continue
            except requests.exceptions.RequestException as e:
                log_message(queue, f"Request failed for {model_id}: {str(e)[:100]}", "ERROR")
                continue
            except (KeyError, IndexError) as e:
                log_message(queue, f"Invalid response structure from {model_id}: {e}", "ERROR")
                continue

        log_message(queue, "❌ All Gemini models failed. Check API key and model availability.", "ERROR")
        return None

    else:
        messages = get_cached_messages()
        return random.choice(messages)


def send_message(
    channel_id,
    message_text,
    token,
    queue,
    reply_to=None,
    delete_after=None,
    delete_immediately=False,
):
    headers = {"Authorization": token, "Content-Type": "application/json"}
    payload = {"content": message_text}
    if reply_to:
        payload["message_reference"] = {"message_id": reply_to}
    url = f"https://discord.com/api/v9/channels/{channel_id}/messages"
    try:
        response = session.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        message_id = data.get("id")
        log_message(
            queue, f'[{channel_id}] Pesan terkirim: "{message_text}"', "SUCCESS"
        )

        if delete_after is not None and delete_after >= 0:
            delay = 0 if delete_immediately else delete_after
            threading.Timer(
                delay, delete_message, args=(channel_id, message_id, token, queue)
            ).start()
            if delay > 0:
                log_message(
                    queue,
                    f"[{channel_id}] Pesan akan dihapus dalam {delay} detik.",
                    "WAIT",
                )

    except requests.exceptions.RequestException as e:
        log_message(queue, f"[{channel_id}] Gagal kirim pesan: {e}", "ERROR")


def delete_message(channel_id, message_id, token, queue):
    headers = {"Authorization": token}
    url = f"https://discord.com/api/v9/channels/{channel_id}/messages/{message_id}"
    try:
        response = session.delete(url, headers=headers)
        if response.status_code == 204:
            log_message(queue, f"[{channel_id}] Pesan {message_id} dihapus.", "SUCCESS")
        else:
            log_message(
                queue,
                f"[{channel_id}] Gagal hapus {message_id}. Status: {response.status_code}",
                "ERROR",
            )
    except requests.exceptions.RequestException as e:
        log_message(queue, f"[{channel_id}] Error hapus pesan: {e}", "ERROR")


def auto_reply(channel_id, settings, token, google_api_keys, queue, stop_event, openrouter_api_keys=None):
    headers = {"Authorization": token}

    username, _, bot_user_id = get_bot_info(token, queue)
    if bot_user_id == "UnknownID":
        log_message(queue, f"[{channel_id}] Gagal memulai: Token tidak valid.", "ERROR")
        return

    # Log bot start info
    mode = settings.get("mode") or ("gemini" if settings.get("use_google_ai") else "pesan")
    log_message(queue, f"[{channel_id}] Bot started as {username} in {mode} mode", "SUCCESS")

    while not stop_event.is_set():
        try:
            # Determine mode with backward compatibility
            mode = settings.get("mode") or ("gemini" if settings.get("use_google_ai") else "pesan")
            if mode == "gemini" or mode == "openrouter":
                if stop_event.wait(timeout=settings.get("read_delay", 10)):
                    break

                response = session.get(
                    f"https://discord.com/api/v9/channels/{channel_id}/messages?limit=1",
                    headers=headers,
                )
                response.raise_for_status()
                messages = response.json()

                if messages:
                    last_message = messages[0]
                    author_id = last_message.get("author", {}).get("id")
                    message_id = last_message.get("id")

                    if (
                        author_id != bot_user_id
                        and message_id not in processed_message_ids
                    ):
                        processed_message_ids.add(message_id)
                        manage_processed_ids()  # Manage memory usage
                        user_message = last_message.get("content", "").strip()

                        if user_message:
                            log_message(
                                queue,
                                f"[{channel_id}] Pesan diterima: {user_message}",
                                "INFO",
                            )

                            # Generate reply based on mode
                            if mode == "openrouter":
                                if not openrouter_api_keys or not any(openrouter_api_keys):
                                    log_message(queue, "Tidak ada OpenRouter API Key.", "ERROR")
                                    reply_text = None
                                else:
                                    openrouter_key = random.choice([k for k in openrouter_api_keys if k])
                                    model_id = settings.get("openrouter_model", "openai/gpt-3.5-turbo")
                                    reply_text = generate_reply_openrouter(
                                        user_message,
                                        settings.get("prompt_language"),
                                        openrouter_key,
                                        model_id,
                                        queue,
                                    )
                            else:  # gemini mode
                                reply_text = generate_reply(
                                    user_message,
                                    settings.get("prompt_language"),
                                    True,
                                    google_api_keys,
                                    queue,
                                )

                            if reply_text:
                                send_message(
                                    channel_id,
                                    reply_text,
                                    token,
                                    queue,
                                    reply_to=(
                                        message_id
                                        if settings.get("use_reply")
                                        else None
                                    ),
                                    delete_after=settings.get("delete_bot_reply"),
                                    delete_immediately=settings.get(
                                        "delete_immediately"
                                    ),
                                )
            else:
                if stop_event.wait(timeout=settings.get("delay_interval", 30)):
                    break
                message_text = generate_reply("", "", False, [], queue)
                send_message(
                    channel_id,
                    message_text,
                    token,
                    queue,
                    delete_after=settings.get("delete_bot_reply"),
                    delete_immediately=settings.get("delete_immediately"),
                )

            if stop_event.wait(timeout=settings.get("delay_interval", 30)):
                break

        except requests.exceptions.RequestException as e:
            log_message(queue, f"[{channel_id}] Terjadi Error: {e}", "ERROR")
            if stop_event.wait(timeout=60):
                break
        except Exception as e:
            log_message(
                queue, f"[{channel_id}] Terjadi kesalahan tak terduga: {e}", "ERROR"
            )
            if stop_event.wait(timeout=60):
                break


def get_channel_info(channel_id, token, queue):
    headers = {"Authorization": token}
    try:
        res = session.get(
            f"https://discord.com/api/v9/channels/{channel_id}",
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        server_name = "Direct Message"
        if guild_id := data.get("guild_id"):
            guild_res = session.get(
                f"https://discord.com/api/v9/guilds/{guild_id}",
                headers=headers,
                timeout=10,
            )
            guild_res.raise_for_status()
            server_name = guild_res.json().get("name", "Unknown Server")
        return server_name, data.get("name", "Unknown Channel")
    except requests.exceptions.RequestException:
        return "Akses Error", "Periksa Token/ID"


def get_bot_info(token, queue):
    """Get bot account information from Discord API.

    Returns tuple of (username, discriminator, user_id).
    Returns ("Invalid", "0000", "UnknownID") if token is invalid.
    """
    if not token or not token.strip():
        if queue:
            log_message(queue, "Empty token provided", "WARNING")
        return "Invalid", "0000", "UnknownID"

    headers = {"Authorization": token}
    try:
        res = session.get(
            "https://discord.com/api/v9/users/@me", headers=headers, timeout=10
        )

        # Handle specific error codes
        if res.status_code == 401:
            if queue:
                log_message(queue, f"⚠️ Token ending ...{token[-4:]} is invalid or expired", "WARNING")
            return "Invalid", "0000", "UnknownID"
        elif res.status_code == 403:
            if queue:
                log_message(queue, f"⚠️ Token ending ...{token[-4:]} lacks permissions", "WARNING")
            return "Forbidden", "0000", "UnknownID"

        res.raise_for_status()
        data = res.json()
        return (
            data.get("username", "Unknown"),
            data.get("discriminator", "0000"),
            data.get("id", "UnknownID"),
        )
    except requests.exceptions.Timeout:
        if queue:
            log_message(queue, f"⏱️ Timeout checking token ...{token[-4:]}", "WARNING")
        return "Timeout", "0000", "UnknownID"
    except requests.exceptions.RequestException as e:
        if queue:
            log_message(queue, f"⚠️ Failed to verify token ...{token[-4:]}: {str(e)[:50]}", "WARNING")
        return "Error", "0000", "UnknownID"
