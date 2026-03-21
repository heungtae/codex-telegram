# Repository Guidelines

## Purpose
This repository bridges Codex App Server with Telegram and Web UI.  
All contributions should favor small, verifiable, production-safe changes with clear handoff between planning, coding, and review.

## Project Assumptions
- Language/runtime: Python 3.11+
- APIs/UI: FastAPI backend + React (static JSX) frontend
- Bot stack: `python-telegram-bot`
- Test stack: `pytest` + `unittest.mock`
- Priorities: stability, observability, maintainability

If repository config conflicts with this guide, repository config wins.

## Project Structure
- `main.py`, `app_runtime/`: app bootstrap and runtime orchestration
- `codex/`: Codex protocol client, command router, approval, event forwarding
- `bot/`: Telegram handlers, callbacks, keyboards
- `web/`: HTTP routes, SSE runtime, workspace helpers, static frontend (`web/static/*`)
- `models/`: user/thread/session in-memory state
- `utils/`: config, logging, normalization, local command execution
- `tests/`: regression and module-level tests (`test_*.py`)
- `docs/`: design/setup docs and plans

## Agent Operating Model
### Planner
- Clarify objective, scope, risks, and acceptance criteria.
- Identify impacted modules/tests before implementation.

### Coder
- Implement only approved scope with minimal diff.
- Preserve local patterns unless clearly harmful.
- Add/update tests with behavior changes.

### Reviewer
- Validate correctness, backward compatibility, operational safety.
- Separate required fixes from optional refactors.

## Standard Workflow
1. Understand request and constraints.
2. Map impacted architecture/files.
3. Decompose into small executable tasks.
4. Implement one task at a time.
5. Run targeted validation after each task.
6. Summarize changes, risks, and next step.

## Build, Test, and Dev Commands
- Install dependencies: `python3 -m pip install -r requirements.txt`
- Run locally: `python3 main.py`
- CLI entrypoint: `codex-telegram`
- Full test run: `python3 -m pytest -q`
- Targeted run: `python3 -m pytest -k web -q`

Use `conf.toml` from `conf.toml.example`. For Web auth, set `web.password` or `CODEX_WEB_PASSWORD`.

## Coding Rules
- Keep changes localized and intention-revealing.
- Python style: PEP 8, 4 spaces, explicit naming.
- Naming: `snake_case` (modules/functions/vars), `PascalCase` (classes), `UPPER_SNAKE_CASE` (constants).
- Prefer constructor-like explicit dependency passing and avoid hidden global side effects.
- Frontend changes in `web/static/app.jsx` should preserve existing event model (`turn_*`, `plan_*`, `file_change`).

## Test Rules
- Every meaningful behavior change requires validation.
- Prefer deterministic tests (mock external/network/process calls).
- Cover success, failure, and boundary paths.
- For bug fixes, add regression tests when feasible.
- Run narrow tests first, then broader suite.

## Commit & PR Rules
- Follow conventional commit style used in history:
  - `feat(web): ...`, `fix(forwarding): ...`, `refactor(runtime): ...`, `build(release): ...`
- Keep one concern per commit.
- PR description should include:
  - objective and scope
  - changed files/modules
  - validation commands run
  - operational/config impact
  - UI screenshot/GIF for `web/static/*` changes

## Handoff Format
```text
[Handoff]
Objective:
Scope completed:
Files changed:
Validation run:
Risks / open questions:
Recommended next step:
```

## Guardrails
- Do not introduce broad refactors unrelated to the task.
- Do not change public behavior silently; document impact.
- Do not commit secrets (`TELEGRAM_BOT_TOKEN`, `CODEX_WEB_PASSWORD`).
- Keep risky config/default changes explicit and reviewable.

## Definition of Done
- Requested behavior implemented.
- Relevant tests pass.
- No unrelated breakage introduced.
- Operational impact and handoff notes are documented.
