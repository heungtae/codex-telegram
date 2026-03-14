# Codex-Telegram Bridge Design

## Overview
`codex-telegram` is a Telegram interface for Codex App Server. It provides command routing, per-user runtime state, event forwarding, and interactive approval handling.

## High-Level Architecture
```text
Telegram User
  <-> python-telegram-bot handlers/callbacks
  <-> Command Router + User State
  <-> Codex Client (JSON-RPC over stdio)
  <-> codex app-server
```

## Runtime Components
- `main.py`
: Bootstraps Telegram application, Codex client initialization, handler registration, and polling lifecycle.
- `codex/client.py`
: JSON-RPC transport and request/response handling for `codex app-server`.
- `codex/approval_guardian.py`
: Runs approval review in a dedicated Codex app-server session and returns approve/session/deny decisions.
- `codex/command_router/*`
: Command dispatch and domain-specific command handlers (`threads`, `projects`, `system`, `review`).
- `bot/handlers.py`
: Telegram command and text-message handling.
- `bot/callbacks.py`
: Inline keyboard callback handling (threads paging/actions, project/skill pickers, approvals).
- `models/user.py`
: In-memory per-user and per-thread runtime state.
- `utils/config.py`
: Configuration loader and project profile persistence.

## Configuration Model
- Active config path: `~/.config/codex-telegram/conf.toml`
- If missing, config is auto-generated with defaults.
- Environment-variable substitution is applied when a config string exactly matches an env key.

Key sections:
- `[telegram.bot]`: token, pending update behavior, startup conflict strategy
- `[codex]`: command + args to launch app-server
- `[users]`: allowed Telegram user IDs
- `[approval]`: `interactive` or `auto`
- `[approval.guardian]`: guardian on/off, timeout, fallback policy, explainability, method filters
- `[forwarding]`: event forwarding level/allowlist/denylist/rules
- `[projects.*]` + `project`: project profiles and default profile

## Telegram Entry Points

### Command and Message Path
- `/start`, `/help`, and command list in `main.py` are routed to `bot/handlers.py`.
- Text messages (`~filters.COMMAND`) start `turn/start` on the active thread.
- If no active thread exists, users are prompted to run `/start`.
- If a turn is already running, users are prompted to interrupt first.

### Inline Callback Path
Main menu buttons:
- `cmd:start`, `cmd:threads`, `cmd:skills`, `cmd:projects`, `cmd:config`, `cmd:interrupt`

Settings callbacks:
- `cmd:config_view`, `cmd:guardian_settings`, `cmd:features`, `cmd:apps`, `cmd:projects`, `cmd:models`, `cmd:modes`, `cmd:mcp`, `cmd:menu`
- `guardian_toggle:enabled`
- `guardian_cycle:timeout|failure_policy|explainability`
- `guardian_apply`, `guardian_refresh`

Thread UI callbacks:
- `threads_page:{active|arch}:{offset}:{limit}`
- `resume:{threadId}`, `read:{threadId}`, `archive:{threadId}`, `unarchive:{threadId}`, `fork:{threadId}`

Other callbacks:
- `skillpick:{name}` inserts `$<skill>` template
- `projectsel:{key}` selects project and starts a fresh thread
- `approval:{requestId}:{approve|session|deny}` submits approval decision

## Command Router and Supported Commands
`CommandRouter` maps commands to handlers:
- Threads: `/start`, `/resume`, `/fork`, `/threads`, `/read`, `/archive`, `/unarchive`, `/compact`, `/rollback`, `/interrupt`
- System: `/commands`, `/exec`, `/models`, `/features`, `/modes`, `/skills`, `/apps`, `/mcp`, `/config`
- Projects: `/projects`, `/project`
- Review: `/review`

## Thread and Project Behavior

### Project-aware thread creation
- `/start` resolves effective project (`selected` -> `default` -> `current workspace`) and calls `thread/start` with `cwd`.
- Thread-to-project mapping is tracked in memory (`_thread_projects`).

### Project switching (`/project`)
- Selects project by key/number/name.
- If a turn is running, attempts `turn/interrupt` with timeout.
- Starts a new thread in selected project workspace.
- Updates active thread and project mapping.

### Thread list modes (`/threads`)
Supported options:
- `--archived`
- `--by-profile`
- `--current-profile`
- `--limit N`
- `--offset N`
- `--full`

Current UX behavior:
- Inline `My Threads` button uses `--current-profile` by default.
- Plain `/threads` with no args in command handler also defaults to `--current-profile`.
- `--current-profile` strictly filters by selected/default profile.
- For older threads without in-memory profile mapping, best-effort profile inference is attempted from thread path fields (`cwd`, `path`, `workspace`, etc.) against configured project paths.

## Event Forwarding Design
`main.py` registers a wildcard Codex event handler (`on_any`) and applies forwarding policy:
- Denylist check
- Allowlist check (if configured)
- Event-level threshold check (`DEBUG|INFO|WARNING|ERROR|OFF`)

Formatting behavior:
- Rule-based extraction from `forwarding.rules` if configured
- Method-specific formatting for common events
- Message truncation to fit Telegram limits
- `threadId` footer appended to forwarded messages

Turn-state sync:
- `turn/started` sets `active_turn_id`
- `turn/completed|turn/failed|turn/cancelled` clears `active_turn_id`
- This synchronization runs even if event forwarding is filtered out.

## Approval Handling
There are two layers:

1. Codex request handling in `CodexClient._handle_server_request`
- Supports approval methods such as:
  - `item/commandExecution/requestApproval`
  - `item/fileChange/requestApproval`
  - `execCommandApproval`
  - `applyPatchApproval`
- In `auto` mode, responds immediately using configured `approval.auto_response`.
- In `interactive` mode, waits for user decision future.

2. Guardian review layer
- If `approval.guardian.enabled = true` and method matches filters, review runs first.
- Review executes in a separate app-server client and returns `approve|session|deny`.
- On guardian timeout/failure, fallback policy applies (`manual_fallback` keeps Telegram buttons).

3. Telegram UI approval flow
- `on_approval_request` sends message with `Approve / Session / Deny` keyboard.
- Callback `approval:<id>:<choice>` submits decision via `submit_approval_decision`.

## State Model
`models/user.py` maintains in-memory state:
- Per-user active thread/turn
- Selected project
- Project-add interaction flow state
- Last listed thread/project IDs (for numeric shortcuts)
- Thread ownership map (`threadId -> userId`)
- Thread project map (`threadId -> projectKey`)

Note:
- Thread/project mapping is runtime memory, not persisted across restarts.

## Operational Notes
- App-server event forwarding is configurable and can be reduced/noised-filtered via allowlist/denylist/rules.
- Bot runs in polling mode with `concurrent_updates(True)`.
- Unauthorized users are blocked based on `users.allowed_ids`.

## Known Design Constraints
- Profile mapping is primarily in-memory; accuracy for legacy threads after restart depends on path-based inference quality.
- Thread list pagination fetches up to `limit + offset` then slices locally when offset is used.
