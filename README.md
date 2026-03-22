# Codex Telegram + Web

A bridge that lets you control the Codex App Server from Telegram and Web UI.

## Features

### Telegram Bot

Control Codex directly from Telegram:

- **Slash commands**: `/start`, `/resume`, `/projects`, `/review`, `/exec`, and more
- **Real-time updates**: Receive progress notifications and turn completions
- **Interactive approvals**: Approve/deny dangerous operations with inline buttons
- **Multi-project support**: Switch between projects with `/project <name>`
- **Thread management**: Start, resume, fork, archive conversations

### Web UI

ChatGPT-style interface with advanced features:

- **Streaming responses**: Real-time message streaming via SSE
- **Multi-project tabs**: Each project has independent workspace context
- **Thread tabs**: Multiple conversations per project
- **Workspace browser**: File tree, Git status, file preview, diff viewer
- **Settings panels**: Features, Models, Modes, Skills, Apps, MCP, Guardian
- **Dark/Light theme**: Theme toggle with localStorage persistence
- **Responsive design**: Desktop and mobile layouts

### Shared Features

- **Approval workflow**: Interactive approve/deny for sensitive operations
- **Guardian**: Policy-based safety rules to auto-approve or escalate requests
- **Real-time events**: Live updates via SSE (Web) and push notifications (Telegram)
- **Multi-project**: Manage multiple projects with separate thread histories

## Requirements

- Python `3.11+`
- [Telegram Bot Token](https://t.me/BotFather) (if Telegram enabled)
- Installed and runnable `codex` CLI
- Web UI: password and allowed users configured

Find your Telegram user ID: https://t.me/userinfobot

## Quick Start

### 1. Install

```bash
pip install codex-telegram
```

If installation fails, try:

```bash
# Upgrade pip first
pip install --upgrade pip

# Install with system packages flag (some Linux distributions)
pip install codex-telegram --break-system-packages

# Or install for current user only
pip install codex-telegram --user

# Or use a virtual environment
python -m venv .venv && source .venv/bin/activate
pip install codex-telegram
```

### 2. Configure

Create `~/.config/codex-telegram/conf.toml`:

```toml
project = "default"

[projects.default]
name = "my project"
path = "/path/to/your/project"

[telegram.bot]
token = "YOUR_TELEGRAM_BOT_TOKEN"

[users]
allowed_ids = [123456789]
```

### 3. Run

```bash
codex-telegram
```

Or with environment variables:

```bash
export TELEGRAM_BOT_TOKEN="your_token"
export CODEX_WEB_PASSWORD="your_password"
codex-telegram
```

### 4. Open Web UI

```text
http://127.0.0.1:8080
```

## Developing from Source

```bash
git clone https://github.com/heungtae/codex-telegram.git
cd codex-telegram
pip install -e .
cd web/frontend && npm install && npm run build && cd ../..
cp conf.toml.example ~/.config/codex-telegram/conf.toml
# Edit config, then run:
python3 main.py
```

## Documentation

| File | Description |
|------|-------------|
| [TELEGRAM.md](TELEGRAM.md) | Telegram bot commands, real-time updates, approval workflow |
| [WEB.md](WEB.md) | Web UI features, API endpoints, workspace browser |
| [conf.toml.example](conf.toml.example) | Full configuration reference |

## Security

- Keep `users.allowed_ids` populated with trusted Telegram user IDs only
- Use environment variables for tokens: `TELEGRAM_BOT_TOKEN`, `CODEX_WEB_PASSWORD`
- Run one polling instance per bot token to avoid conflicts
- Set `cookie_secure = true` when using HTTPS

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
