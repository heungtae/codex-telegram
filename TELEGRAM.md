# Codex Telegram Bot

A Telegram bot interface for controlling the Codex App Server. Send commands, receive real-time updates, and manage your projects directly from Telegram.

## Features

### Commands

Execute Codex commands using slash commands in any chat with the bot:

| Command | Codex API | Description |
|---------|-----------|-------------|
| `/commands` | - | List all available commands |
| `/projects --list` | - | List configured projects |
| `/projects --add <key>` | - | Start interactive project add flow |
| `/project <key\|number\|name>` | - | Select active project |
| `/start` | thread/start | Create a new thread |
| `/resume <id\|number>` | thread/resume | Resume thread (supports list number) |
| `/fork <id>` | thread/fork | Fork thread |
| `/threads [--full] [--by-profile] [--current-profile] [--limit N] [--offset N] [--archived]` | thread/list | List threads with paging/full-id options |
| `/read <id\|number>` | thread/read | Read thread (supports list number) |
| `/archive <id\|number>` | thread/archive | Archive thread (supports list number) |
| `/unarchive <id>` | thread/unarchive | Unarchive thread |
| `/compact <id>` | thread/compact/start | Compact conversation history |
| `/rollback <n>` | thread/rollback | Roll back last N turns |
| `/interrupt` | turn/interrupt | Interrupt running turn |
| `/review` | review/start | Start code review |
| `/exec <cmd>` | command/exec | Run command |
| `/models` | model/list | List available models |
| `/features` | experimentalFeature/list + command/exec | Show beta features |
| `/guardian` | local config | Show guardian summary |
| `/modes` | collaborationMode/list | List collaboration modes |
| `/collab` | collaborationMode/list | List collaboration modes |
| `/skills` | skills/list | List skills |
| `/apps` | app/list | List apps |
| `/mcp` | mcpServerStatus/list | List MCP servers |
| `/config` | config/read | Read configuration |

Use `<command> --help` for detailed usage.

### Real-Time Updates

Receive live notifications directly in Telegram:

- **Turn progress**: Get updates as commands execute
- **Turn completion**: Notification when a turn finishes
- **Turn failures**: Alert when execution fails
- **Approval requests**: Interactive approve/deny buttons
- **File changes**: Patch summaries and file modification reports

Configure which events to receive via `telegram.forwarding.app_server_event_allowlist`.

### Thread Management

- Start new conversations with `/start`
- Resume previous threads with `/resume`
- Fork threads to experiment
- Archive old threads to keep your list clean
- Compact conversation history to save context
- Rollback turns to undo mistakes

### Project Switching

Manage multiple projects:

1. Configure projects in `conf.toml`
2. Use `/projects --list` to see all projects
3. Use `/project <name>` to switch
4. Each project maintains separate thread history

## Configuration

### Basic Setup

```toml
[telegram]
enabled = true

[telegram.bot]
token = "env:TELEGRAM_BOT_TOKEN"
drop_pending_updates = true
conflict_action = "prompt"  # prompt | kill | exit

[users]
allowed_ids = [123456789]
```

### Getting a Bot Token

1. Open [@BotFather](https://t.me/BotFather) in Telegram
2. Send `/newbot`
3. Follow prompts to set name and username
4. Copy the issued token
5. Add the token to your config or environment variable

### Finding Your User ID

1. Open [@userinfobot](https://t.me/userinfobot) in Telegram
2. Your user ID will be displayed
3. Add it to `users.allowed_ids` in config

### Event Forwarding

Configure which events are sent to Telegram:

```toml
[telegram.forwarding]
app_server_event_level = "DEBUG"
app_server_event_allowlist = ["item/completed", "turn/completed", "turn/failed", "turn/cancelled"]
app_server_event_denylist = ["item/agentMessage/delta"]
```

### Display Settings

```toml
[display]
max_message_length = 4000
send_progress = true
threads_list_limit = 20
```

## Security

- **Keep `allowed_ids` populated**: Only trusted Telegram users can use the bot. Empty list blocks everyone.
- **Use environment variables**: Never commit tokens to version control.
- **Revoke exposed tokens**: If a token is leaked, revoke immediately via `/revoke` command to @BotFather.
- **Single instance**: Run only one polling instance per bot token to avoid conflicts.
- **Set `conflict_action = "exit"`** for unattended production environments.

## Approval Workflow

When Codex requests permission to execute operations:

- **Interactive mode** (default): Approve/deny via inline buttons in Telegram
- **Auto mode**: Automatic response based on `approval.auto_response` setting

Guardian rules can automatically approve safe operations and escalate risky ones:

- Protected files (`.env`, `.pem`, `secrets/**`) are denied automatically
- Large change sets require manual approval
- Build commands like `mvn test` are auto-approved

Configure Guardian rules in `conf.toml` or via Web UI.

## First-Run Checklist

After starting a chat with the bot:

1. `/commands` - View all available commands
2. `/projects --list` - See configured projects
3. `/project <key>` - Select your active project
4. `/start` - Create your first thread
