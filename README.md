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

### Update

The CLI checks for updates automatically on startup. When a newer version is available on PyPI, you'll see:

```text
✨ Update available! 0.5.1 -> 0.5.2

  Release notes: https://github.com/heungtae/codex-telegram/releases/latest

  1. Update now and exit (runs `pip install -U codex-telegram`)
  2. Skip this run
  3. Skip this version

  Choose [1/2/3] (default: 2):
```

You can also update manually:

```bash
pip install -U codex-telegram
```

Or with system packages flag:

```bash
pip install -U codex-telegram --break-system-packages
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

If you want to rebuild the web UI before launching the app, use:

```bash
./run_build_and_main.sh
```

Or:

```bash
make run
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
./run_build_and_main.sh
```

## Publishing a Release

1. Update `codex_telegram/__init__.py` (`__version__`), validate the changes, and push the commits.
2. In GitHub Releases, create a draft with a matching tag (for example, `v0.6.0` for version `0.6.0`) targeting the intended commit. The commit must contain `.github/workflows/pypi-publish.yml` with the release trigger.
3. Write the release notes and publish the Release. Drafts and tag pushes alone do not deploy.
4. Wait for **Publish release to PyPI** to succeed: it builds the Web UI, builds/checks the wheel and sdist (including UI assets), publishes to PyPI, then attaches the same distributions and `SHA256SUMS` to the Release.

Configure `PYPI_API_TOKEN` as a repository secret or a secret on the `pypi` environment before publishing. Existing environment protection rules still apply; remove required reviewers from that environment if fully automatic publishing is desired. Published prereleases also trigger this workflow, so use a matching Python prerelease version such as `0.6.1rc1` / `v0.6.1rc1`.

A published GitHub Release alone does not mean PyPI deployment succeeded; check the workflow result. If attachment fails after PyPI publishing succeeds, rerun only failed jobs to attach the retained files without republishing. For code changes after a successful PyPI upload, use a new version and Release.

## Documentation

| File | Description |
|------|-------------|
| [TELEGRAM.md](https://github.com/heungtae/codex-telegram/blob/main/TELEGRAM.md) | Telegram bot commands, real-time updates, approval workflow |
| [WEB.md](https://github.com/heungtae/codex-telegram/blob/main/WEB.md) | Web UI features, API endpoints, workspace browser |
| [conf.toml.example](https://github.com/heungtae/codex-telegram/blob/main/conf.toml.example) | Full configuration reference |

## Security

- Keep `users.allowed_ids` populated with trusted Telegram user IDs only
- Use environment variables for tokens: `TELEGRAM_BOT_TOKEN`, `CODEX_WEB_PASSWORD`
- Run one polling instance per bot token to avoid conflicts
- Set `cookie_secure = true` when using HTTPS

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
