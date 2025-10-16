# Discord Panel Bot - Setup Guide

## Prerequisites

1. Python 3.7+ installed
2. Discord account(s)
3. Google API key for Gemini (optional, for AI responses)

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

The web interface will be available at `http://localhost:5005`

## Configuration

### 1. Getting Discord User Tokens

**IMPORTANT:** This bot uses user tokens (not bot tokens). User tokens allow automation of regular Discord accounts.

#### Method 1: Browser DevTools (Recommended)

1. Open Discord in your web browser (https://discord.com/app)
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Paste this code and press Enter:
   ```javascript
   (webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()
   ```
5. Copy the token that appears (it will be a long string)
6. Paste it into `config.json` under `discord_tokens` array

#### Method 2: Using Discord Desktop App

1. Open Discord Desktop App
2. Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac) to open DevTools
3. Follow the same steps as Method 1 above

#### Important Notes About Tokens:

- **Security**: Never share your tokens publicly
- **Validity**: Tokens can expire if you change your password or Discord detects unusual activity
- **Multiple Accounts**: You can add multiple tokens to rotate between different accounts
- **Rate Limits**: Discord has rate limits; the bot handles this automatically

### 2. Getting Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key
5. Add it to `config.json` under `google_api_keys` array

#### Free Tier Limits:
- 15 requests per minute
- 1,500 requests per day
- 1 million tokens per day

### 3. Configuration File Structure

Edit `config.json`:

```json
{
    "discord_tokens": [
        "YOUR_DISCORD_TOKEN_1",
        "YOUR_DISCORD_TOKEN_2"
    ],
    "google_api_keys": [
        "YOUR_GOOGLE_API_KEY"
    ],
    "tasks": []
}
```

## Usage

### Creating a Task

1. Open web interface at `http://localhost:5005`
2. Click "Add New Task"
3. Configure the task:
   - **Channel ID**: Right-click on a Discord channel → Copy ID (enable Developer Mode in Discord settings)
   - **Bot Account**: Select which Discord account to use
   - **Mode**:
     - `gemini`: AI-powered responses using Google Gemini
     - `pesan`: Random messages from `pesan.txt`
   - **Read Delay**: How often to check for new messages (seconds)
   - **Reply Delay**: Time between bot responses (seconds)
   - **Language**: `en` for English, `id` for Indonesian
   - **Use Reply**: Whether to reply to messages or send standalone messages
   - **Auto Delete**: Optionally delete bot messages after N seconds

### Managing Tasks

- **Start**: Click the ▶️ button to start a task
- **Stop**: Click the ⏹️ button to stop a task
- **Edit**: Modify task settings and click "Save Configuration"
- **Delete**: Remove tasks you no longer need

### Creating pesan.txt

Create a file named `pesan.txt` in the root directory with one message per line:

```
Hello!
How are you?
What's up?
Nice to meet you!
```

The bot will randomly select messages from this file when in `pesan` mode.

## Troubleshooting

### Token Issues

**Error: "Token tidak valid atau expired"**
- Your Discord token has expired
- Get a new token using the methods above
- Make sure you copied the entire token

**Error: "Token lacks permissions"**
- The account doesn't have access to the channel
- Make sure the account is a member of the server

### Gemini API Issues

**Error: "All Gemini models failed"**
- Check your API key is valid
- Verify you haven't exceeded rate limits
- Try again after a few minutes

**Error: "Model not found (404)"**
- The bot will automatically try alternative models
- If all fail, your API key might not have access to Gemini

### Connection Issues

**Error: "Request failed"**
- Check your internet connection
- Discord or Google services might be down
- The bot will automatically retry

## Security Best Practices

1. **Never commit tokens to git**: Add `config.json` to `.gitignore`
2. **Use environment variables**: Store sensitive data in `.env` file
3. **Rotate tokens regularly**: Change your Discord password periodically
4. **Monitor usage**: Check Discord for unusual activity
5. **Limit API keys**: Use separate API keys for different projects

## Rate Limits

### Discord
- User accounts: ~5 messages per 5 seconds per channel
- The bot automatically handles delays

### Google Gemini
- Free tier: 15 RPM, 1500 RPD
- The bot rotates between multiple API keys if provided

## Legal Notice

**DISCLAIMER**: Automating user accounts is against Discord's Terms of Service. This tool is for educational purposes only. Use at your own risk. Your account may be banned if Discord detects automation.

## Support

For issues or questions:
1. Check the logs in the web interface
2. Review this documentation
3. Check `CLAUDE.md` for technical details

## Advanced Configuration

### Multiple Google API Keys

Add multiple API keys to rotate and bypass rate limits:

```json
{
    "google_api_keys": [
        "KEY_1",
        "KEY_2",
        "KEY_3"
    ]
}
```

### Environment Variables

Create a `.env` file:

```env
DISCORD_TOKENS=token1,token2,token3
GOOGLE_API_KEYS=key1,key2
```

The app will automatically load these on startup.
