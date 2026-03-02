# Codex Telegram Bot

A bot that lets you control Codex App Server from Telegram.

## What You Can Do

- Run Codex commands from Telegram and view results
- Control user access based on `allowed_ids`
- Manage conversation lifecycle: start/resume/list/archive threads
- Forward approval requests and progress events to Telegram in real time

## Requirements

- Python `3.11+`
- Telegram Bot Token
- `codex` CLI installed and runnable

## Quick Start

1. Install dependencies

```bash
python3 -m pip install -r requirements.txt
```

2. Prepare the configuration file

```bash
cp conf.toml.example conf.toml
```

3. Edit `conf.toml`

- `projects.<key>.path`: absolute path to the target project
- `users.allowed_ids`: Telegram user IDs allowed to use this bot
- `bot.token` or environment variable `TELEGRAM_BOT_TOKEN`

Example:

```toml
project = "default"

[projects.default]
name = "my project"
path = "/absolute/path/to/your/project"

[bot]
token = "TELEGRAM_BOT_TOKEN"
drop_pending_updates = true
conflict_action = "prompt" # prompt | kill | exit

[codex]
command = "codex"
args = ["app-server"]

[users]
allowed_ids = [123456789]

[approval]
mode = "interactive" # interactive | auto
auto_response = "approve" # approve | session | deny

[logging]
level = "INFO"

[forwarding]
app_server_event_level = "INFO"
app_server_event_allowlist = []
app_server_event_denylist = []

[[forwarding.rules]]
 method = "item/completed"
 require_path = "item.type"
 require_equals = "agentMessage"
 text_paths = ["item.text"]
 fallback = "drop"

[display]
max_message_length = 4000
send_progress = true
```

4. (Optional) Provide the token via environment variable

```bash
export TELEGRAM_BOT_TOKEN="your_actual_bot_token"
```

5. Run

```bash
python3 main.py
```

## First Commands

After starting a chat with the bot, run commands in this order for a quick check:

1. `/commands` - Show all commands
2. `/projects --list` - Show project profiles
3. `/project <key|number|name>` - Select active project
4. `/start` - Start a new thread

## Command Reference

| Telegram | Codex API | Description |
|----------|-----------|-------------|
| `/commands` | - | List available commands |
| `/projects --list` | - | List configured projects |
| `/projects --add <key>` | - | Start interactive project add flow |
| `/project <key\|number\|name>` | - | Select active project |
| `/start` | thread/start | Create a new thread |
| `/resume <id\|number>` | thread/resume | Resume a thread (supports list number) |
| `/fork <id>` | thread/fork | Fork a thread |
| `/threads [--full] [--by-profile] [--current-profile] [--limit N] [--offset N] [--archived]` | thread/list | List threads with paging/full id options |
| `/read <id\|number>` | thread/read | Read a thread (supports list number) |
| `/archive <id\|number>` | thread/archive | Archive a thread (supports list number) |
| `/unarchive <id>` | thread/unarchive | Unarchive a thread |
| `/compact <id>` | thread/compact/start | Compact conversation history |
| `/rollback <n>` | thread/rollback | Rollback N turns |
| `/interrupt` | turn/interrupt | Interrupt running turn |
| `/review` | review/start | Start code review |
| `/exec <cmd>` | command/exec | Execute a command |
| `/models` | model/list | List available models |
| `/features` | experimentalFeature/list + command/exec | Show beta features and apply enable/disable via checkbox UI |
| `/modes` | collaborationMode/list | List collaboration modes |
| `/skills` | skills/list | List skills |
| `/apps` | app/list | List apps |
| `/mcp` | mcpServerStatus/list | List MCP servers |
| `/config` | config/read | Read configuration |

Tip: Use `<command> --help` to see detailed usage for each command.

## Security Notes

- If `users.allowed_ids` is empty, nobody can use the bot.
- It is recommended to use environment variables for tokens instead of hardcoding them in `conf.toml`.
- With `approval.mode = "interactive"`, approvals are handled via Telegram buttons (Approve/Session/Deny).
- With `approval.mode = "auto"`, decisions are returned immediately using `approval.auto_response`.
- Run only one polling instance per bot token. Duplicate pollers will conflict.
- `bot.conflict_action` controls startup behavior on local lock conflict:
  - `prompt`: ask in terminal (`kill` or `exit`)
  - `kill`: terminate lock-owner process then continue
  - `exit`: stop immediately

## Message Flow

```text
Telegram User -> codex-telegram -> Codex App Server (stdio)
                ^                      |
                |                      v
                +------ Telegram <-----+
```

## Project Structure

```text
codex-telegram/
├── conf.toml.example
├── main.py
├── requirements.txt
├── bot/
│   ├── handlers.py
│   ├── callbacks.py
│   ├── keyboard.py
│   ├── thread_ui.py
│   ├── skills_ui.py
│   └── projects_ui.py
├── codex/
│   ├── client.py
│   ├── protocol.py
│   ├── events.py
│   └── commands.py
├── models/
│   ├── state.py
│   ├── thread.py
│   └── user.py
└── utils/
    ├── config.py
    └── logger.py
```

## Create Telegram Bot Token

1. Open `@BotFather` in Telegram
2. Run `/newbot`
3. Set bot name and username
4. Copy the issued token
5. Check your Telegram user ID via `@userinfobot` and add it to `allowed_ids`

## Documentation

- Setup and configuration details: `docs/TELEGRAM_BOT_SETUP.md`
- Design notes: `docs/DESIGN.md`

## License

Apache License 2.0. See [LICENSE](LICENSE).
