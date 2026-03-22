# Codex Telegram + Web

A bridge that lets you control the Codex App Server from Telegram and Web UI.

<img src="./docs/images/codex-telegram.png" alt="Codex Telegram Bot Integration" width="520" />

## What's New Beyond 0.3.4

- Web workspace browser for the active project, including directory tree, file preview, and Git diff preview
- Structured patch/file-change events in Web chat, with diff rendering for `apply_patch` results
- Message-level `threadId` display in Web chat so streamed output and loaded history stay traceable
- Web settings panels for Guardian, Models, Modes, Skills, Apps, MCP, and App Config
- Interactive project profile add/select flows in both Telegram and Web
- More resilient turn completion routing so completion/progress messages reach the correct Telegram/Web user session
- Responsive Web UI refinements including sidebar toggle, mobile layout, and workspace panel controls

## What You Can Do

- **Telegram Bot**: Control Codex from Telegram with slash commands and receive real-time updates
- **Web UI**: ChatGPT-style interface with streaming responses and workspace browser
- **Multi-project**: Manage multiple projects with independent thread histories
- **Approval workflow**: Interactive approve/deny buttons for sensitive operations
- **Guardian**: Policy-based safety rules to auto-approve or escalate requests
- **Real-time events**: Live updates via SSE in Web, push notifications in Telegram

## Requirements

- Python `3.11+`
- [Telegram Bot Token](TELEGRAM.md#getting-a-bot-token) (if Telegram enabled)
- Installed and runnable `codex` CLI
- Web UI: `web.password` and `web.allowed_users` configured

## Quick Start

### 1. Install

```bash
pip install codex-telegram
```

### 2. Configure

Create `~/.config/codex-telegram/conf.toml` with minimum settings:

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

Find your Telegram user ID: https://t.me/userinfobot

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

### 1. Clone and install

```bash
git clone https://github.com/heungtae/codex-telegram.git
cd codex-telegram
pip install -e .
```

### 2. Build Web frontend

```bash
cd web/frontend
npm install
npm run build
cd ../..
```

### 3. Configure

```bash
cp conf.toml.example ~/.config/codex-telegram/conf.toml
```

Edit `~/.config/codex-telegram/conf.toml`:

- `projects.default.path`: absolute path to your project
- `users.allowed_ids`: your Telegram user ID
- `telegram.bot.token`: your bot token from @BotFather

For full configuration options, see [`conf.toml.example`](conf.toml.example).

### 4. Run

```bash
python3 main.py
```

## Documentation

- [Telegram Bot](TELEGRAM.md) - Commands, real-time updates, approval workflow
- [Web UI](README_WEB.md) - Chat interface, workspace browser, settings panels
- [Configuration](conf.toml.example) - Full configuration reference

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
