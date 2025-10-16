# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord panel bot that provides an automated reply system for Discord channels. The application consists of a Flask web interface for managing bot configurations and a Discord automation engine.

## Core Architecture

### Main Components

- **app.py** - Flask web server that provides the management interface
- **bot_logic.py** - Core Discord automation logic and message handling
- **config.json** - Configuration file storing Discord tokens, Google API keys, and task settings
- **templates/index.html** - Web interface for bot management
- **pesan.txt** - Text file containing predefined messages for non-AI responses

### Key Architecture Patterns

The application uses a multi-threaded design where:
- Flask runs the web interface on the main thread
- Each Discord bot task runs in a separate daemon thread (managed in `active_threads` dict)
- Logging is handled through a shared `Queue` object for thread-safe communication
- Tasks can be started/stopped independently through the web interface

## Development Commands

### Running the Application
```bash
# Install dependencies
pip install -r requirements.txt

# Run the Flask application (development mode)
python app.py
```

The application will start on `http://0.0.0.0:5005` with debug mode enabled.

### Configuration Management

- Discord tokens and Google API keys can be configured via environment variables or directly in `config.json`
- The application supports multiple Discord tokens and will rotate through them
- Google API keys are used for AI-powered responses via Google's Gemini API

### Key Configuration Structure

Tasks in `config.json` contain:
- `channel_id` - Target Discord channel
- `assigned_token_index` - Which Discord token to use
- `use_google_ai` - Whether to use AI responses or predefined messages
- `prompt_language` - Language for AI responses ("en" or "id")
- `read_delay` - Delay between checking for new messages
- `delay_interval` - Interval between automated responses
- `use_reply` - Whether to reply to messages or send standalone messages
- `delete_bot_reply` - Auto-delete timer for bot messages
- `delete_immediately` - Whether to delete messages immediately

## Thread Management

- Active bot tasks are tracked in the `active_threads` dictionary
- Each thread has a `stop_event` for graceful shutdown
- The web interface provides real-time status updates via Server-Sent Events (`/logs` endpoint)

## API Integration

- Uses Discord's REST API v9 for message operations
- Integrates with Google's Generative Language API (Gemini) for AI responses
- Implements rate limiting and API key rotation for Google services