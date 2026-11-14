# Codex Web UI

A ChatGPT-style web interface for interacting with Codex App Server. Provides real-time chat, workspace browsing, and system configuration.

## Features

### Chat Interface

- **Real-time streaming**: Messages stream in real-time via Server-Sent Events (SSE)
- **Multi-turn conversations**: Full conversation history with resume, fork, and archive
- **Message types**: Supports user messages, assistant responses, plans, reasoning, web search, image generation, and file changes
- **Slash commands**: Type `/` to access command palette with autocomplete
- **Project/skill references**: Use `@project` or `$skill` syntax
- **Build/Plan modes**: Toggle collaboration mode with Tab key
- **Turn controls**: Stop, interrupt, or rollback running turns

### Multi-Project and Multi-Thread

- **Project tabs**: Each project has its own tab with independent workspace context
- **Thread tabs**: Multiple conversations per project, each with independent chat state
- **Thread states**: Visual indicators for idle, running, completed, failed, or cancelled
- **Unread notifications**: Badge indicators for new completions
- **Project management**: Use the project menu → Modify Project to edit its name/path. The key remains fixed to preserve chat associations. Add/Modify Project includes a Default project checkbox. The default project is marked D and its Remove menu is disabled; choose another default before removing it. Changing the default updates the shared configuration without switching existing open chats.
- **Persistent state**: Thread and project tabs preserved across sessions

### Workspace Browser

- **File tree**: Hierarchical directory view with expand/collapse
- **Git status**: Visual badges for added (A), modified (M), deleted (D), renamed (R), and untracked (??) files
- **File preview**: Read file contents with line numbers
- **Diff viewer**: Side-by-side git diff with syntax highlighting
- **Binary detection**: Proper handling of binary files
- **Security**: Path traversal protection prevents unauthorized access

### Real-Time Events

The Web UI receives live updates via SSE for:

| Event | Description |
|-------|-------------|
| `turn_started` | Turn execution started |
| `turn_delta` | Streaming text from assistant |
| `turn_completed` | Turn finished successfully |
| `turn_failed` | Turn execution failed |
| `turn_cancelled` | Turn was cancelled |
| `plan_delta` | Streaming plan content |
| `plan_checklist` | Plan steps with checkboxes |
| `approval_required` | Guardian/approval needed |
| `file_change` | File modifications with diffs |
| `app_event` | Tool execution events |
| `user_message` | User message sent |

### Authentication

- **Session-based auth**: Username/password login with configurable TTL
- **User allowlist**: Restrict access to specific usernames
- **Secure cookies**: HttpOnly cookies with optional HTTPS enforcement
- **Session persistence**: Sessions survive browser refresh

### System Configuration

The Settings panel provides access to:

| Panel | Description |
|-------|-------------|
| **Features** | Enable/disable experimental Codex features |
| **Models** | View and select available AI models |
| **Modes** | View collaboration modes (Build/Plan) |
| **Skills** | View available Codex skills |
| **Apps** | View available Codex apps |
| **MCP** | View MCP server status |
| **Guardian** | Configure policy-based safety rules |
| **App Config** | View system configuration |

### Guardian (Policy-Based Safety)

Guardian provides automated safety checks before approval decisions:

- **Enable/disable**: Toggle Guardian on/off
- **Timeout**: Configure review timeout (3, 8, 20, 60 seconds)
- **Failure policy**: What to do on Guardian failure (manual_fallback, deny, approve, session)
- **Explainability**: Choose decision-only or summary explanations
- **Rules editor**: Advanced TOML editor for custom rules

### UI Features

- **Dark/Light theme**: Toggle and persists to localStorage
- **Responsive design**: Desktop and mobile layouts (900px breakpoint)
- **Resizable panels**: Drag to resize sidebar and workspace panels
- **Turn notifications**: Sound alert on turn completion (toggleable)
- **Command palette**: Autocomplete for commands, projects, and skills
- **Mobile drawer**: Sidebar opens as drawer on mobile devices
- **Keyboard shortcuts**: Full keyboard navigation support

### Keyboard Shortcuts

#### General

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Send message (or Shift+Enter for newline) |
| `Tab` | Toggle Build/Plan mode |
| `Escape` | Close modals / cancel project picker |

#### Alt Key Shortcuts (when not in input)

| Shortcut | Action |
|----------|--------|
| `Alt + N` | New chat (focus composer, start thread) |
| `Alt + T` | New thread tab (start thread) |
| `Alt + W` | Close current thread tab |
| `Alt + P` | Open project picker modal |
| `Alt + [` | Previous thread in project |
| `Alt + ]` | Next thread in project |
| `Alt + 1-9` | Switch to thread 1-9 in current project |
| `Alt + V` | Toggle workspace panel (compact layout) |

#### Ctrl/Cmd Key Shortcuts (when not in input)

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + B` | Switch to Build mode |
| `Ctrl/Cmd + Shift + P` | Switch to Plan mode |

#### Project Picker Modal

| Shortcut | Action |
|----------|--------|
| `Up/Down` | Navigate projects |
| `Enter` | Select project |
| `Esc` / `Backspace` | Close modal |
| `Type` | Filter projects by name/key |

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Get current user info |

### Threads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/threads` | List threads with pagination |
| GET | `/api/threads/summaries` | Get thread summaries |
| POST | `/api/threads/start` | Start new thread |
| POST | `/api/threads/resume` | Resume thread |
| POST | `/api/threads/fork` | Fork thread |
| POST | `/api/threads/archive` | Archive thread |
| POST | `/api/threads/unarchive` | Unarchive thread |
| POST | `/api/threads/compact` | Compact context |
| POST | `/api/threads/rollback` | Rollback turns |
| POST | `/api/threads/interrupt` | Interrupt running turn |
| GET | `/api/threads/read` | Read thread messages |
| POST | `/api/chat/messages` | Send message |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Add project (`default: true` optionally sets the default) |
| PUT | `/api/projects/{key}` | Modify name/path and optionally set default |
| DELETE | `/api/projects/{key}` | Remove a non-default project |
| POST | `/api/projects/select` | Switch project |
| POST | `/api/projects/open-thread` | Open thread in project |
| POST | `/api/projects/open-explorer` | Open project folder in OS file explorer |

### Workspace

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspace/tree` | Get directory tree |
| GET | `/api/workspace/status` | Git status |
| GET | `/api/workspace/file` | Read file |
| GET | `/api/workspace/diff` | Get git diff |
| GET | `/api/workspace/suggestions` | Path autocomplete |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/features` | List features |
| POST | `/api/features/{key}` | Toggle feature |
| GET | `/api/models` | List models |
| GET | `/api/modes` | List collaboration modes |
| GET | `/api/collab` | List collaboration modes (alias) |
| GET | `/api/skills` | List skills |
| GET | `/api/apps` | List apps |
| GET | `/api/mcp` | List MCP servers |
| GET | `/api/guardian` | Get guardian settings |
| POST | `/api/guardian` | Save guardian settings |
| GET | `/api/config` | Get config |
| POST | `/api/approvals/{id}` | Submit approval |

### Approvals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/approvals` | List pending approval requests |
| POST | `/api/approvals/{request_id}` | Submit approval decision (approve|session|deny) |

### Session

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/session/summary` | Get current session state (active thread, workspace, project, mode, agents) |

### Commands

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/command` | Execute any slash command |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/stream` | SSE event stream |

## Configuration

```toml
[web]
enabled = true
host = "127.0.0.1"
port = 8080

# HTTPS (recommended for production)
ssl_enabled = false
ssl_certfile = "/path/to/fullchain.pem"
ssl_keyfile = "/path/to/privkey.pem"

# Authentication
password = "env:CODEX_WEB_PASSWORD"
allowed_users = ["admin"]
session_ttl_seconds = 43200
cookie_secure = false
```

See [`conf.toml.example`](conf.toml.example) for full configuration reference.

### Enable HTTPS directly

To provision certificates and update an existing configuration automatically:

```bash
codex-telegram --setup-https --domain your-domain.com
# Or select the active configuration explicitly:
codex-telegram --config /path/to/conf.toml --setup-https --domain your-domain.com
```

From a source checkout, the build/run script accepts the same CLI options:

```bash
PYTHON_BIN=.venv/bin/python ./run_build_and_main.sh --setup-https --domain your-domain.com
# After successful setup, build the frontend and start the application:
PYTHON_BIN=.venv/bin/python ./run_build_and_main.sh
```

`PYTHON_BIN` defaults to `python3`; use an interpreter with the project dependencies
installed. HTTPS setup, config validation, help, and version commands skip the
frontend build and exit without starting the application. Other CLI options such
as `--config` and `--web-only` are forwarded after the build.

The default method is `self-signed`. It requires OpenSSL and generates a
365-day certificate locally, without CA issuance or external port 80 access.
Browsers require explicit trust configuration to avoid certificate warnings.

#### Quick start with the default self-signed certificate

With the project virtual environment activated, run:

```bash
./run_build_and_main.sh --setup-https --domain your-domain.com
./run_build_and_main.sh
```

Omitting `--method` is equivalent to `--method self-signed`. The domain argument
contains only the hostname, without `http://`, `https://`, a port, or a path.
Setup generates the PEM certificate and private key, validates the pair, and
updates the active `conf.toml`. It does not start the application; the second
command builds the frontend and starts it with the new settings. If an older
instance is running, stop it before starting the updated application.

For an existing configuration with `web.enabled = true`, `web.port = 9090`, and
an externally accessible bind address, open:

```text
https://your-domain.com:9090/
```

Setup preserves `web.enabled`, host, port, and authentication settings. External
access still requires the existing TCP 9090 forwarding/firewall rule. Self-signed
setup itself needs neither Certbot, sudo, nor an external port 80 forwarding rule.

#### Browser warning: "Your connection is not private"

This warning is expected for a self-signed certificate: HTTPS encrypts the
connection, but the browser cannot authenticate the server using a trusted
certificate issuer. Changing the default method does not remove this warning.

For personal devices, explicitly trust the generated certificate through each
device/browser's certificate settings where supported. Obtain the certificate
from the server's configured `web.ssl_certfile` through a trusted channel and
verify its SHA-256 fingerprint before trusting it:

```bash
openssl x509 -in /absolute/path/to/cert.pem -noout -sha256 -fingerprint
```

Trust must be configured separately on each client. Import only the public
certificate; keep `web.ssl_keyfile` private. Browser and OS support for trusting
an individual self-signed server certificate varies. Alternatively, use
`--method mkcert` and install/trust its local CA on each client. Never distribute
the local CA private key. Setup does not install client trust automatically.

Each self-signed setup run generates a fresh certificate, valid for 365 days,
so repeating setup also requires updating any existing certificate trust.
Certificates are not automatically renewed by this method.

For access from arbitrary devices without manual trust installation, use a
public certificate on a domain whose DNS/CAA policy permits issuance. If Certbot
reports `CAA record for iptime.org prevents issuance`, changing ports or running
as root does not resolve the DNS authorization restriction; use a domain you can
configure or contact the DDNS provider about its certificate service.

#### Optional public certificate with Certbot

For a public certificate, select Certbot explicitly:

```bash
codex-telegram --setup-https --domain your-domain.com --method certbot
```

Install Certbot separately for this method. It uses standalone HTTP-01 authentication: DNS must point to your server,
external TCP port 80 must be forwarded to the configured `web.port` on this PC
(default 8080). For `web.port = 9090`, add **external TCP 80 → PC TCP 9090**
alongside the existing external 9090 → PC 9090 rule. Certbot listens on `web.port`
using `--http-01-port`; the local port must be between 1024 and 65535 so no sudo
is needed for binding. Stop the application before setup to free that port, then
start it again after successful setup. Allow the local port through any active
PC firewall. The setup command does not invoke sudo, install tools, change router
rules, or accept CA terms for you.
Certbot prompts for account information/terms as needed in the terminal.

The command uses `--config`, then `CODEX_CONFIG_PATH`, then
`~/.config/codex-telegram/conf.toml`. The file must already exist.
It stores certificates and ACME state under `https/` beside that configuration.
Only after the pair loads successfully does it back up the original as
`conf.toml.https.bak` and atomically update `ssl_enabled`, `ssl_certfile`,
`ssl_keyfile`, and `cookie_secure` in `[web]`. Comments, authentication settings,
host, port, and enabled state are preserved. Each successful run replaces the
backup with the immediately preceding configuration. Restart the application to
apply the change; setup exits without starting or restarting it.

For local testing, alternatives are available:

```bash
codex-telegram --setup-https --domain your-domain.com --method mkcert
codex-telegram --setup-https --domain your-domain.com --method self-signed
```

The mkcert method requires mkcert and a separately installed/trusted local CA
(`mkcert -install` on the relevant machines). Self-signed uses OpenSSL and creates
a certificate valid for 365 days; browsers need explicit trust configuration.
Both create a fresh pair on each setup run, without replacing previously used files.

If a previous sudo invocation left root-owned files, restore ownership once:

```bash
sudo chown -R "$(id -u):$(id -g)" "$HOME/.config/codex-telegram/https"
```

Certbot renewal must use the same ACME directories and challenge port. For the
default config path with `web.port = 9090`:

```bash
certbot renew --http-01-port 9090 \
  --config-dir "$HOME/.config/codex-telegram/https/acme" \
  --work-dir "$HOME/.config/codex-telegram/https/work" \
  --logs-dir "$HOME/.config/codex-telegram/https/logs"
```

Schedule this with your OS scheduler under the appropriate user and configure a
`--deploy-hook` to restart your actual application service after renewal. Setup
does not install a scheduler or service hook. External port 80 forwarding still
applies to renewal; stop the app to free the local challenge port before renewal
and start it again afterward, including when renewal fails. Restart is needed to
load renewed certificates.

Install a PEM certificate chain and its matching unencrypted private key for
your domain, then update the active `conf.toml`:

```toml
[web]
enabled = true
host = "0.0.0.0"
port = 9090
ssl_enabled = true
ssl_certfile = "/absolute/path/to/fullchain.pem"
ssl_keyfile = "/absolute/path/to/privkey.pem"
cookie_secure = true
```

Keep your existing authentication settings. The application user must be able
to read both files; restrict access to the private key. Restart the application
and open `https://your-domain.com:9090`. If using router port forwarding, forward
the external TCP port to this listening port; use the external port in the URL.
The certificate must cover the hostname used in the browser.

Missing paths, unreadable files, invalid PEM data, or a mismatched key prevent
startup when HTTPS is enabled. The server does not fall back to HTTP. This port
accepts HTTPS only; automatic HTTP redirection and certificate issuance/renewal
are not provided. Restart after replacing renewed certificate files.

## Access

```text
http://127.0.0.1:8080
```

Or with HTTPS:

```text
https://your-domain.com
```

Set password via environment variable:

```bash
export CODEX_WEB_PASSWORD="your_password"
```

## See Also

- [TELEGRAM.md](TELEGRAM.md) - Telegram bot commands and approval workflow
- [README.md](README.md) - Project overview and quick start
