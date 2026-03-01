# Codex Telegram Bot

Telegram bot to control Codex App Server

## Features

- Control Codex App Server via Telegram
- Only `allowed_users` can use the bot
- Full support for all Codex API commands
- Real-time event streaming (turn progress, approval requests, etc.)

## Prerequisites

- Python 3.11+
- Telegram Bot Token
- Codex CLI installed

## Installation

```bash
pip install python-telegram-bot
```

## Configuration

### 1. Edit conf.toml

```toml
[bot]
token = "TELEGRAM_BOT_TOKEN"

[codex]
command = "codex"
args = ["app-server"]

[users]
allowed_ids = [123456789]

[approval]
require_for = ["file_write", "command_exec", "tool_use"]
auto_approve_trusted = false

[logging]
level = "INFO" # app-server 로그

[forwarding]
app_server_event_level = "INFO" # OFF|ERROR|WARNING|INFO|DEBUG (Telegram 전달 레벨)
app_server_event_allowlist = [] # method 패턴 허용 목록, 예: ["turn/*", "item/agentMessage/*", "codex/event/*"]
app_server_event_denylist = []  # method 패턴 차단 목록, 예: ["codex/event/mcp_startup_*", "deprecationNotice"]

# 예: item/completed 중 agentMessage의 text만 전달
[[forwarding.rules]]
method = "item/completed"
require_path = "item.type"
require_equals = "agentMessage"
text_paths = ["item.text"]
fallback = "drop" # drop|json
```

### 2. Set Environment Variable

```bash
export TELEGRAM_BOT_TOKEN="your_actual_bot_token"
```

### 3. Run

```bash
python3 main.py
```

## Available Commands

| Telegram | Codex API | Description |
|----------|-----------|-------------|
| `/start` | thread/start | Create a new thread |
| `/resume <id\|number>` | thread/resume | Resume a thread (supports list number) |
| `/fork <id>` | thread/fork | Fork a thread |
| `/threads [--full] [--limit N] [--offset N] [--archived]` | thread/list | List threads with paging/full id options |
| `/read <id\|number>` | thread/read | Read a thread (supports list number) |
| `/archive <id\|number>` | thread/archive | Archive a thread (supports list number) |
| `/unarchive <id>` | thread/unarchive | Unarchive a thread |
| `/compact <id>` | thread/compact/start | Compact conversation history |
| `/rollback <n>` | thread/rollback | Rollback N turns |
| `/interrupt` | turn/interrupt | Interrupt running turn |
| `/review` | review/start | Start code review |
| `/exec <cmd>` | command/exec | Execute a command |
| `/models` | model/list | List available models |
| `/features` | experimentalFeature/list | List experimental features |
| `/modes` | collaborationMode/list | List collaboration modes |
| `/skills` | skills/list | List skills |
| `/apps` | app/list | List apps |
| `/mcp` | mcpServerStatus/list | List MCP servers |
| `/config` | config/read | Read configuration |

## Message Flow

```
Telegram User → codex-telegram → Codex App Server (stdio)
                ↑                      ↓
                └────── Telegram ←─────┘
```

## Project Structure

```
codex-telegram/
├── conf.toml           # Configuration file
├── main.py             # Bot entry point
├── requirements.txt    # Dependencies
├── bot/                # Telegram handlers
│   ├── handlers.py
│   ├── callbacks.py
│   └── keyboard.py
├── codex/              # Codex client
│   ├── client.py
│   ├── protocol.py
│   ├── events.py
│   └── commands.py
├── models/             # State management
│   ├── user.py
│   └── thread.py
└── utils/              # Utilities
    ├── config.py
    └── logger.py
```

## Creating a Telegram Bot

1. Send `/newbot` to @BotFather
2. Enter bot name
3. Enter username (must end with `bot`)
4. Get the token
5. Find your Telegram ID at @userinfobot

## License

Apache License 2.0 - See [LICENSE](LICENSE) file
