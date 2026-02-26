# Codex-Telegram Bridge 설계서

## 개요
Telegram을 통해 Codex App Server의 모든 기능을 사용하기 위한 브릿지

## 아키텍처
```
Telegram User → codex-telegram → Codex App Server (stdio)
```

## 프로젝트 구조
```
codex-telegram/
├── conf.toml                    # 설정 파일 (allowed_users 등)
├── main.py                      # Bot 실행 진입점
├── bot/
│   ├── __init__.py
│   ├── handlers.py              # Telegram command/message handlers
│   ├── callbacks.py             # Callback query handlers (approval)
│   └── keyboard.py              # Inline keyboards
├── codex/
│   ├── __init__.py
│   ├── client.py                 # Codex App Server client (stdio)
│   ├── protocol.py               # JSON-RPC message handling
│   ├── events.py                 # Event notification handlers
│   └── commands.py               # Command registry & router
├── models/
│   ├── __init__.py
│   ├── user.py                   # User state management
│   └── thread.py                 # Thread state management
└── utils/
    ├── __init__.py
    ├── config.py                 # conf.toml loader
    └── logger.py                 # Logging setup
```

## 주요 기능

### 1. allowed_users 필터링
- `conf.toml`의 `users.allowed_ids`에 Telegram user ID를 등록
- 등록된 사용자만 Bot 사용 가능

### 2. Command 매핑 (Telegram ↔ Codex API)

| Telegram Command | Codex API | Description |
|-----------------|-----------|-------------|
| `/start` | `thread/start` | 새 스레드 생성 |
| `/resume <id>` | `thread/resume` | 기존 스레드 복원 |
| `/fork <id>` | `thread/fork` | 스레드 포크 |
| `/threads` | `thread/list` | 스레드 목록 조회 |
| `/read <id>` | `thread/read` | 스레드 읽기 |
| `/archive <id>` | `thread/archive` | 스레드 아카이브 |
| `/unarchive <id>` | `thread/unarchive` | 스레드 복원 |
| `/compact <id>` | `thread/compact/start` | 히스토리 압축 |
| `/rollback <n>` | `thread/rollback` | N개 턴 롤백 |
| `/interrupt` | `turn/interrupt` | 진행 중인 턴 취소 |
| `/review` | `review/start` | 코드 리뷰 시작 |
| `/exec <cmd>` | `command/exec` | 명령어 실행 |
| `/models` | `model/list` | 모델 목록 |
| `/features` | `experimentalFeature/list` | 실험적 기능 |
| `/modes` | `collaborationMode/list` | 협업 모드 |
| `/skills` | `skills/list` | 스킬 목록 |
| `/apps` | `app/list` | 앱 목록 |
| `/mcp` | `mcpServerStatus/list` | MCP 서버 상태 |
| `/config` | `config/read` | 설정 읽기 |

### 3. Event Streaming (Codex → Telegram)
Codex에서 발생하는 이벤트를 실시간으로 처리:
- `thread/started`, `thread/archived`, `thread/unarchived`
- `turn/started`, `turn/completed`, `turn/diff/updated`
- `item/started`, `item/completed`, `item/agentMessage/delta`
- `thread/status/changed` (승인 요청 알림)

### 4. Approval 요청 시스템
1. Codex가 `thread/status/changed` + `waitingOnApproval` 알림 전송
2. Bot이 사용자에게 Inline Keyboard로 승인 요청
3. 사용자가 "approve" / "deny" / "view" 선택
4. 응답에 따라 작업 계속/## 설정 (conf.toml)

```중단

toml
[bot]
token = "YOUR_TELEGRAM_BOT_TOKEN"

[codex]
command = "codex"
args = ["app-server"]

[users]
allowed_ids = [123456789, 987654321]

[approval]
require_for = ["file_write", "command_exec", "tool_use"]
auto_approve_trusted = false

[display]
max_message_length = 4000
send_progress = true
```

## 메시지 흐름

### 일반 요청 처리
```
User: /start
  ▶ Bot: allowed_users 확인
  ▶ Codex: thread/start 호출
  ▶ Codex: thread/started 이벤트
  ▶ Codex: turn/started → item/started → item/agentMessage/delta... → turn/completed
  ▶ Bot: 최종 결과를 Telegram으로 전송
```

### 승인 필요시
```
User: 파일 쓰기 요청
  ▶ Codex: thread/status/changed { waitingOnApproval }
  ▶ Bot: "승인 요청" 메시지 + Inline Keyboard 전송
  ▶ User: [승인] 버튼 클릭
  ▶ Bot: Codex에 승인 신호 전송
  ▶ Codex: 작업 계속 진행
```

## 의존성
- Python 3.11+
- python-telegram-bot
- tomllib (표준 라이브러리)

## 실행
```bash
pip install python-telegram-bot
cp conf.toml conf.toml.example
# conf.toml에 Telegram Bot Token 및 설정 입력
python main.py
```
