# Codex Telegram Bot

Codex App Server를 Telegram에서 제어할 수 있게 해주는 봇입니다.

## What You Can Do

- Telegram에서 Codex 명령 실행 및 결과 확인
- `allowed_ids` 기반 사용자 접근 제어
- 스레드 시작/재개/조회/보관 등 대화 수명주기 관리
- 승인(approval) 요청과 진행 이벤트를 Telegram으로 실시간 전달

## Requirements

- Python `3.11+`
- Telegram Bot Token
- `codex` CLI 설치 및 실행 가능 상태

## Quick Start

1. 의존성 설치

```bash
python3 -m pip install -r requirements.txt
```

2. 설정 파일 준비

```bash
cp conf.toml.example conf.toml
```

3. `conf.toml` 수정

- `projects.<key>.path`: 실제 작업할 프로젝트 경로
- `users.allowed_ids`: 봇 사용을 허용할 Telegram 사용자 ID 목록
- `bot.token` 또는 환경변수 `TELEGRAM_BOT_TOKEN`

예시:

```toml
project = "default"

[projects.default]
name = "my project"
path = "/absolute/path/to/your/project"

[bot]
token = "TELEGRAM_BOT_TOKEN"
drop_pending_updates = true

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

4. (선택) 토큰을 환경변수로 주입

```bash
export TELEGRAM_BOT_TOKEN="your_actual_bot_token"
```

5. 실행

```bash
python3 main.py
```

## First Commands

봇과 대화를 시작한 뒤 아래 순서로 입력하면 빠르게 확인할 수 있습니다.

1. `/commands` - 전체 명령 보기
2. `/projects --list` - 프로젝트 목록 보기
3. `/project <key|number|name>` - 활성 프로젝트 선택
4. `/start` - 새 스레드 시작

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

Tip: 각 명령은 `<command> --help`로 상세 사용법을 확인할 수 있습니다.

## Security Notes

- `users.allowed_ids`를 비워두면 아무도 봇을 사용할 수 없습니다.
- 토큰은 `conf.toml`에 직접 넣기보다 환경변수 사용을 권장합니다.
- `approval.mode = "interactive"`면 Telegram 버튼(Approve/Session/Deny)으로 승인합니다.
- `approval.mode = "auto"`면 버튼 없이 `approval.auto_response`로 즉시 응답합니다.

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

1. Telegram에서 `@BotFather` 열기
2. `/newbot` 실행
3. 봇 이름/유저네임 설정
4. 발급된 토큰 복사
5. `@userinfobot`으로 본인 Telegram ID 확인 후 `allowed_ids`에 추가

## Documentation

- 상세 설정/설치: `docs/TELEGRAM_BOT_SETUP.md`
- 설계 메모: `docs/DESIGN.md`

## License

Apache License 2.0. See [LICENSE](LICENSE).
