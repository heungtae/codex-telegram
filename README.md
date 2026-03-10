# Codex Telegram + Web

A bridge that lets you control the Codex App Server from Telegram and Web UI.

<img src="./docs/images/codex-telegram.png" alt="Codex Telegram Bot Integration" width="520" />

## What You Can Do

- Run Codex commands in Telegram and view results
- Run Codex commands in ChatGPT-style Web UI (`FastAPI + React`)
- Use Telegram-equivalent command shortcut buttons in Web UI (plus direct `/command` execution input)
- Control user access with `allowed_ids`
- Manage conversation lifecycle: start/resume/list/archive threads
- Receive approval requests and progress events in real time via Telegram and Web (SSE)

## Requirements

- Python `3.11+`
- Telegram Bot Token
- Installed and runnable `codex` CLI
- For Web UI: `web.password` and `web.allowed_users` configured

If `telegram.enabled = false`, Telegram token is not required.

## Quick Start

1. Install dependencies

```bash
python3 -m pip install -r requirements.txt
```

2. Prepare the config file

```bash
cp conf.toml.example conf.toml
```

3. Edit `conf.toml`

- `projects.<key>.path`: absolute path to the target project
- `users.allowed_ids`: list of Telegram user IDs allowed to use this bot
- `telegram.bot.token` or environment variable `TELEGRAM_BOT_TOKEN`

Example:

```toml
project = "default"

[projects.default]
name = "my project"
path = "/absolute/path/to/your/project"

[telegram]
enabled = true

[telegram.bot]
token = "TELEGRAM_BOT_TOKEN"
drop_pending_updates = true
conflict_action = "prompt" # prompt | kill | exit

[web]
enabled = true
host = "127.0.0.1"
port = 8080
password = "env:CODEX_WEB_PASSWORD"
password_env = "CODEX_WEB_PASSWORD"
allowed_users = ["admin"]
session_ttl_seconds = 43200
cookie_secure = false

[codex]
command = "codex"
args = ["app-server"]

[users]
allowed_ids = [123456789]

[approval]
mode = "interactive" # interactive | auto
auto_response = "approve" # approve | session | deny

[approval.guardian]
enabled = false
timeout_seconds = 8
failure_policy = "manual_fallback" # manual_fallback | deny | approve | session
explainability = "full_chain" # decision_only | summary | full_chain
apply_to_methods = ["*"]

[validation.reviewer]
enabled = false
max_attempts = 3
timeout_seconds = 8
recent_turn_pairs = 3

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

4. (Optional) Set token via environment variable

```bash
export TELEGRAM_BOT_TOKEN="your_actual_bot_token"
```

5. Run

```bash
python3 main.py
```

6. Open Web UI (if `web.enabled = true`)

```text
http://127.0.0.1:8080
```

Set web password via env:

```bash
export CODEX_WEB_PASSWORD="your_strong_password"
```

## First-Run Command Sequence

After starting a chat with the bot, run the following for a quick check:

1. `/commands` - view all commands
2. `/projects --list` - view project profiles
3. `/project <key|number|name>` - select the active project
4. `/start` - start a new thread

## Command Reference

| Telegram | Codex API | Description |
|----------|-----------|------|
| `/commands` | - | List available commands |
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
| `/features` | experimentalFeature/list + command/exec | Show beta features and apply enable/disable via checkbox UI |
| `/gurdian` (`/guardian`) | local config | Show guardian settings panel and apply changes via checkbox UI |
| `/reviewer` (`/verifier`) | local config | Show result reviewer settings panel and apply changes via checkbox UI |
| `/modes` | collaborationMode/list | List collaboration modes |
| `/skills` | skills/list | List skills |
| `/apps` | app/list | List apps |
| `/mcp` | mcpServerStatus/list | List MCP servers |
| `/config` | config/read | Read configuration |

Tip: Use `<command> --help` for detailed usage.

UI note:
- `Settings` includes `Features`, `Apps`, `Project Select`, `Guardian`, `Reviewer`, `Models`, `Modes`, `MCP`, and `App Config`.

## Security Notes

- Keep `users.allowed_ids` explicitly populated with trusted Telegram user IDs only. If empty, nobody can use the bot.
- Prefer `TELEGRAM_BOT_TOKEN` environment variable over `telegram.bot.token`, and never commit real tokens to version control.
- If a token is exposed, revoke and reissue it immediately via `@BotFather` (for example, `/revoke`), then restart the bot with the new token.
- Prefer `approval.mode = "interactive"` in production. Use `approval.mode = "auto"` only in tightly controlled environments.
- If `approval.mode = "auto"` is required, choose a conservative `approval.auto_response` (typically `deny` or `session`).
- `approval.guardian.enabled` defaults to `false`; enable it when you need policy-based safety checks before approval decisions.
- Guardian setting changes in Telegram `Settings -> Guardian` are applied immediately.
- Guardian checks run in a dedicated Codex app-server session isolated from user conversation threads.
- `validation.reviewer.enabled` defaults to `false`; enable it when you want generated answers to be verified and retried before the final result is shown.
- Reviewer setting changes in Telegram `Settings -> Reviewer` are applied immediately.
- Reviewer checks run in a dedicated Codex app-server session and can retry generation up to `validation.reviewer.max_attempts`.
- Run exactly one polling instance per bot token to avoid update and lock conflicts.
- `telegram.bot.conflict_action` controls lock-conflict startup behavior. For unattended production, `exit` is the safest default.
- Treat logs as sensitive operational data because they may include prompts, commands, and execution context; restrict access and retention.
- Run the bot with a non-root account and limit configured project paths to trusted directories only.

## Getting a Telegram Bot Token

1. Open `@BotFather` in Telegram
2. Run `/newbot`
3. Set bot name and username
4. Copy the issued token
5. Check your Telegram user ID with `@userinfobot` and add it to `allowed_ids`

## Documentation

- Setup and configuration details: `docs/TELEGRAM_BOT_SETUP.md`
- Design notes: `docs/DESIGN.md`

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
