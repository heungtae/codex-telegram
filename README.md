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

- Run Codex commands in Telegram and view results
- Run Codex commands in ChatGPT-style Web UI (`FastAPI + React`)
- Use Telegram-equivalent command shortcut buttons in Web UI (plus direct `/command` execution input)
- Control user access with `allowed_ids`
- Manage conversation lifecycle: start/resume/list/archive threads
- Receive approval requests and progress events in real time via Telegram and Web (SSE)
- Browse the active workspace in Web UI and inspect file contents or Git diffs without leaving the chat
- Review applied patches and file-change summaries directly in the Web timeline
- Track each Web message with its `threadId` and keep thread context visible while reading history
- Manage Guardian configuration and project profiles from the Web UI

## Requirements

- Python `3.11+`
- Telegram Bot Token
- Installed and runnable `codex` CLI
- For Web UI: `web.password` and `web.allowed_users` configured

If `telegram.enabled = false`, Telegram token is not required.

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
| `/guardian` | local config | Show guardian summary. Edit settings and rules in Web UI |
| `/modes` | collaborationMode/list | List collaboration modes |
| `/collab` | collaborationMode/list | List collaboration modes |
| `/skills` | skills/list | List skills |
| `/apps` | app/list | List apps |
| `/mcp` | mcpServerStatus/list | List MCP servers |
| `/config` | config/read | Read configuration |

Tip: Use `<command> --help` for detailed usage.

UI note:
- `Settings` includes `Features`, `Apps`, `Project Select`, `Guardian`, `Models`, `Modes`, `MCP`, and `App Config`.
- Web chat includes a workspace side panel for file browsing and a preview panel for file/diff inspection.
- Patch/file-change events are rendered as structured cards in the Web timeline instead of plain log text.

## Security Notes

- Keep `users.allowed_ids` explicitly populated with trusted Telegram user IDs only. If empty, nobody can use the bot.
- Prefer `TELEGRAM_BOT_TOKEN` environment variable over `telegram.bot.token`, and never commit real tokens to version control.
- If a token is exposed, revoke and reissue it immediately via `@BotFather` (for example, `/revoke`), then restart the bot with the new token.
- Prefer `approval.mode = "interactive"` in production. Use `approval.mode = "auto"` only in tightly controlled environments.
- If `approval.mode = "auto"` is required, choose a conservative `approval.auto_response` (typically `deny` or `session`).
- `approval.guardian.enabled` defaults to `false`; enable it when you need policy-based safety checks before approval decisions.
- `approval.guardian.rules` are evaluated before Guardian LLM review and can return `approve`, `session`, `deny`, or `manual_fallback`.
- Use `manual_fallback` for explicit human approval cases such as protected files, large change sets, DB schema changes, or coverage regressions.
- Telegram no longer edits Guardian settings/rules; use Web `Guardian settings` instead.
- Web `Guardian settings` shows only rules that already exist in `conf.toml`. If none are configured, the editor shows the `conf.toml.example` rules as commented examples.
- Matcher groups inside one Guardian rule are combined with `AND`; use multiple rules when you need `OR`.
- Guardian checks run in a dedicated Codex app-server session isolated from user conversation threads.
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
