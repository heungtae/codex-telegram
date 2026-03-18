# Telegram Bot Setup and Integration Guide

This document explains the full process for creating a Telegram bot and integrating it with the `codex-telegram` project.

## 1. Prerequisites

- OS: macOS / Linux / WSL recommended
- Python: 3.11+
- Telegram app installed (mobile or desktop)
- Codex CLI installed and runnable (`codex` command)

Project root:

```bash
cd /home/heungtae/develop/ai-agent/codex-telegram
```

## 2. Create a Bot in BotFather

1. Open `@BotFather` in Telegram
2. Run `/newbot`
3. Enter bot display name (example: `Codex Assistant Bot`)
4. Enter bot username (must end with `bot`, example: `my_codex_helper_bot`)
5. Save the issued HTTP API token

Example token format:

```text
1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Security notes:
- Treat the token like a password
- Never commit it to Git
- Never share it publicly

## 3. Recommended Bot Defaults

Recommended extra setup in BotFather:

### 3.1 Register Command Menu

- Run `/setcommands`
- Select your target bot
- Paste the following:

```text
start - Start a new thread
resume - Resume a thread
threads - List your threads
read - Read a thread
archive - Archive a thread
unarchive - Unarchive a thread
compact - Compact conversation history
rollback - Rollback N turns
interrupt - Interrupt running turn
review - Start code review
exec - Execute a command
models - List available models
features - List experimental features
modes - List collaboration modes
collab - List collaboration modes
skills - List skills
apps - List apps
mcp - List MCP servers
config - Read configuration
help - Show help
```

### 3.2 Group Privacy Policy

- If you only use DM: default is fine
- If you also use groups: consider `/setprivacy` -> `Disable`

## 4. Install Python Dependencies

Create and activate a virtual environment, then install:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Main dependency:
- `python-telegram-bot>=20.0`

## 5. Prepare Configuration

This project uses a user-level config path rather than a repo-local `conf.toml`.

Actual path:

```text
~/.config/codex-telegram/conf.toml
```

`utils/config.py` auto-creates this file when needed.

### 5.1 Auto-create Template

If the file does not exist, it is created automatically at startup.

### 5.2 Manual Example

```toml
[telegram]
enabled = true

[telegram.bot]
token = "1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
drop_pending_updates = true
conflict_action = "prompt" # prompt | kill | exit

[codex]
command = "codex"
args = ["app-server"]

[users]
allowed_ids = [123456789]

[approval]
mode = "interactive"
auto_response = "approve"

[logging]
level = "INFO"

[display]
max_message_length = 4000
send_progress = true
```

## 6. Check Telegram User ID and Access Control

You can block users not listed in `users.allowed_ids`.

How to find your user ID:

1. Open `@userinfobot` in Telegram
2. Send `/start`
3. Add the returned numeric ID to `allowed_ids`

Example:

```toml
[users]
allowed_ids = [123456789, 987654321]
```

Note:
- `allowed_ids = []` may allow unrestricted access depending on runtime behavior. Restrict it in production.

## 7. Run

From project root:

```bash
source .venv/bin/activate
python3 main.py
```

Expected behavior:
- Log includes `Starting Codex Telegram Bot...`
- Open bot DM in Telegram and send `/start`
- Verify thread creation and command responses

## 8. Runtime Flow (Summary)

- Receive Telegram messages
- Route command/text in `python-telegram-bot` handlers
- Communicate with Codex App Server (`codex app-server`)
- Send results back to Telegram

This project runs in polling mode (`app.run_polling(...)`).

## 9. Operations Tips

- Always set `allowed_ids` to block unauthorized use
- Default log level is `INFO`; use `DEBUG` for troubleshooting
- If token leaks, revoke/regenerate immediately in BotFather
- Use process managers (systemd/pm2/supervisor) for always-on operation

## 10. Common Issues and Fixes

### 10.1 `Please set telegram.bot.token in conf.toml`

Cause:
- Missing token or placeholder value in `~/.config/codex-telegram/conf.toml`

Fix:
- Replace with the real BotFather token

### 10.2 Bot does not respond

Checks:
- Is `python3 main.py` running?
- Is token valid?
- Any network restrictions?
- Is the bot blocked in Telegram?

### 10.3 `You are not authorized to use this bot.`

Cause:
- Your user ID is not in `allowed_ids`

Fix:
- Add your ID to `allowed_ids`
- Save file and restart the process

### 10.4 `codex` execution errors

Cause:
- `codex` is not installed or PATH is wrong

Fix:
- Run `codex --help` in terminal
- Check `[codex] command` and `args` in `conf.toml`

### 10.5 `Conflict: terminated by other getUpdates request`

Cause:
- Another process or host is running the same bot token in polling mode

Fix:
- Stop duplicate instances (local process manager, container, CI job, etc.)
- Run only one polling instance per token
- If high availability is needed, switch to webhook architecture instead of multiple pollers

Note:
- This project now acquires a local single-instance lock per bot token and exits early on duplicates.
- You can control lock conflict behavior with `telegram.bot.conflict_action`:
  - `prompt`: ask whether to kill existing local process or exit
  - `kill`: terminate local lock-owner process automatically
  - `exit`: always exit immediately
- If conflict comes from another host, local kill cannot resolve it; process exits.

## 11. Quick Checklist

- [ ] Bot created in BotFather
- [ ] Token configured in `~/.config/codex-telegram/conf.toml`
- [ ] Your Telegram user ID added to `allowed_ids`
- [ ] `pip install -r requirements.txt` completed
- [ ] `python3 main.py` runs and logs are healthy
- [ ] `/start` works in Telegram DM

## 12. Recommended Next Steps

- Split permissions by command (restrict high-risk commands like `/exec`, `/review`)
- Add auto-restart setup via Docker/systemd
- Integrate structured logging/alerts for incident tracking
