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
| POST | `/api/projects` | Add project |
| POST | `/api/projects/select` | Switch project |
| POST | `/api/projects/open-thread` | Open thread in project |

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
| GET | `/api/modes` | List modes |
| GET | `/api/skills` | List skills |
| GET | `/api/apps` | List apps |
| GET | `/api/mcp` | List MCP servers |
| GET | `/api/guardian` | Get guardian settings |
| POST | `/api/guardian` | Save guardian settings |
| GET | `/api/config` | Get config |
| POST | `/api/approvals/{id}` | Submit approval |

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
