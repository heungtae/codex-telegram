# Telegram Bot 생성 및 연동 가이드

이 문서는 `codex-telegram` 프로젝트 기준으로 Telegram Bot을 생성하고, 로컬 환경에 연동해 실행하는 전체 절차를 설명합니다.

## 1. 준비 사항

- OS: macOS / Linux / WSL 권장
- Python: 3.11 이상
- Telegram 앱 설치 (모바일 또는 데스크톱)
- Codex CLI 설치 및 실행 가능 상태 (`codex` 명령)

프로젝트 루트:

```bash
cd /home/heungtae/develop/ai-agent/codex-telegram
```

## 2. BotFather에서 봇 생성

1. Telegram에서 `@BotFather` 검색 후 채팅 시작
2. `/newbot` 입력
3. 봇 표시 이름 입력 (예: `Codex Assistant Bot`)
4. 봇 유저네임 입력 (`...bot` 으로 끝나야 함, 예: `my_codex_helper_bot`)
5. 발급된 HTTP API 토큰 저장

예시 토큰 형식:

```text
1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

보안 주의:
- 토큰은 비밀번호와 동일하게 취급
- Git에 커밋 금지
- 외부 공유 금지

## 3. (권장) 봇 기본 설정

BotFather에서 추가로 아래 설정을 권장합니다.

### 3.1 명령어 메뉴 등록

- `/setcommands` 실행
- 대상 봇 선택
- 아래 내용을 붙여넣기

```text
start - Start a new thread
resume - Resume a thread
threads - List your threads
read - Read a thread
archive - Archive a thread
unarchive - Unarchive a thread
compact - Compact conversation history
rollback - Rollback N turns
interrupt - Interrupt running turn
review - Start code review
exec - Execute a command
models - List available models
features - List experimental features
modes - List collaboration modes
skills - List skills
apps - List apps
mcp - List MCP servers
config - Read configuration
help - Show help
```

### 3.2 그룹 사용 정책

- 개인 DM만 쓸 경우: 기본값 유지 가능
- 그룹에서도 쓸 경우: `/setprivacy` -> `Disable` 고려

## 4. 이 프로젝트에 필요한 Python 의존성 설치

가상환경 생성/활성화 후 설치:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

현재 주요 의존성:

- `python-telegram-bot>=20.0`

## 5. 설정 파일 준비

이 프로젝트는 루트의 `conf.toml`이 아니라 사용자 홈 설정 경로를 사용합니다.

실제 경로:

```text
~/.config/codex-telegram/conf.toml
```

코드에서 `utils/config.py`가 위 파일을 자동 생성합니다.

### 5.1 기본 템플릿 생성(자동)

아직 파일이 없다면 실행 시 자동 생성됩니다. 먼저 실행해 생성해도 되고, 수동으로 미리 작성해도 됩니다.

### 5.2 수동 작성 예시

```toml
[bot]
token = "1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[codex]
command = "codex"
args = ["app-server"]

[users]
allowed_ids = [123456789]

[approval]
mode = "interactive"
auto_response = "approve"

[logging]
level = "INFO"

[display]
max_message_length = 4000
send_progress = true
```

## 6. Telegram 사용자 ID 확인 및 접근 제어

이 프로젝트는 `users.allowed_ids`에 없는 사용자 접근을 차단할 수 있습니다.

사용자 ID 확인 방법:

1. Telegram에서 `@userinfobot` 검색
2. `/start` 입력
3. 받은 numeric ID를 `allowed_ids`에 추가

예시:

```toml
[users]
allowed_ids = [123456789, 987654321]
```

참고:
- `allowed_ids = []` 이면 코드상 제한 없이 동작할 수 있으므로 운영 환경에서는 반드시 제한 권장

## 7. 실행

프로젝트 루트에서:

```bash
source .venv/bin/activate
python3 main.py
```

정상 동작 시:

- 로그에 `Starting Codex Telegram Bot...`
- Telegram에서 봇 DM 열고 `/start` 전송
- 스레드 생성/명령 응답 확인

## 8. 동작 방식(요약)

- Telegram 메시지 수신
- `python-telegram-bot` 기반 핸들러에서 명령/텍스트 분기
- 내부적으로 Codex App Server (`codex app-server`)와 통신
- 결과를 Telegram으로 다시 전송

이 프로젝트는 polling 방식으로 동작합니다 (`app.run_polling(...)`).

## 9. 운영 팁

- `allowed_ids`를 반드시 설정해 비인가 사용 차단
- 로그 레벨은 기본 `INFO`, 문제 분석 시 `DEBUG`
- 토큰 유출 시 즉시 BotFather에서 `/revoke` 또는 재발급
- systemd/pm2/supervisor 등 프로세스 매니저로 상시 구동 권장

## 10. 자주 발생하는 문제와 해결

### 10.1 `Please set bot.token in conf.toml`

원인:
- `~/.config/codex-telegram/conf.toml`에 토큰이 없거나 placeholder 값

해결:
- 실제 BotFather 토큰으로 교체

### 10.2 봇이 응답하지 않음

점검:
- `python3 main.py` 프로세스 실행 중인지
- 토큰이 유효한지
- 네트워크 차단 여부
- Telegram에서 봇이 block 상태인지

### 10.3 `You are not authorized to use this bot.`

원인:
- 사용자 ID가 `allowed_ids`에 없음

해결:
- 본인 ID 확인 후 `allowed_ids`에 추가
- 파일 저장 후 프로세스 재시작

### 10.4 `codex` 관련 실행 오류

원인:
- `codex` 명령 미설치 또는 PATH 문제

해결:
- 터미널에서 `codex --help` 확인
- `conf.toml`의 `[codex] command`/`args` 점검

## 11. 빠른 점검 체크리스트

- [ ] BotFather로 봇 생성 완료
- [ ] 토큰을 `~/.config/codex-telegram/conf.toml`에 설정
- [ ] 내 Telegram ID를 `allowed_ids`에 등록
- [ ] `pip install -r requirements.txt` 완료
- [ ] `python3 main.py` 실행 후 로그 정상
- [ ] Telegram DM에서 `/start` 응답 확인

## 12. 권장 다음 단계

- 명령어별 권한 정책 분리 (`/exec`, `/review` 등 고위험 명령 제한)
- Docker/systemd 기반 자동 재시작 구성
- 장애 추적을 위한 구조적 로그/알림 연동
