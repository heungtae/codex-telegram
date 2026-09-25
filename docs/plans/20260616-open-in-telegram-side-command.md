# Open in Telegram + Side Command 설계

## 배경

Web에서 보이는 Codex 스레드를 명시적 액션으로 Telegram 클라이언트에서 열 수 있게 한다. Web 스레드를 단순히 여는 것만으로는 Telegram의 활성 스레드가 변경되지 않으며, 명시적 크로스 클라이언트 액션으로만 전환이 이루어진다. Side Command는 오른쪽 사이드바 워크스페이스 플로우로 별도 구현 예정이다.

## 요구사항 구조화

**Open in Telegram (완료)**
- 채팅 헤더에서 모달을 열어 현재 프로젝트의 스레드 목록 표시.
- 선택한 스레드를 Telegram의 활성 스레드로 전환.
- `POST /api/telegram/open-thread` API로 Telegram의 활성 스레드 바인딩 업데이트.
- 라우트 동작, 활성 스레드 격리, 오류 전파, 모달 렌더 회귀 테스트 포함.

**Side Command (미완료)**
- 오른쪽 사이드바에 별도 워크스페이스 플로우를 예약.
- 메인 스레드 모델과 분리, v1 구현 범위 외.

## 제약 조건
- Open in Telegram v1은 현재 프로젝트의 스레드만 대상으로 한다.
- Web과 Telegram은 독립적인 활성 스레드 선택을 유지하며, 명시적 액션만이 Telegram의 활성 스레드를 변경한다.
- 기술 스택: FastAPI, Python 3.11, React, 기존 Codex thread/session 라우팅.

## 아키텍처/설계 방향

**Open in Telegram 구현 범위:**
- `web/routes.py`: `POST /api/telegram/open-thread` 추가
- `web/frontend/src/features/app/hooks/useThreadSession.ts`: Open in Telegram 핸들러 추가
- `web/frontend/src/features/app/hooks/useThreadSession.types.ts`: 타입 확장
- `web/frontend/src/features/app/components/ChatHeader.tsx`: 모달 진입점 추가
- `web/frontend/src/features/app/components/AppConversationPane.tsx`: 모달 렌더 연결
- `web/frontend/src/features/app/components/OpenInTelegramModal.tsx` (신규): 스레드 선택 UI
- `web/frontend/src/styles/_overlays.scss`: 모달 스타일
- `tests/test_web_server_local_command.py`: 라우트/모달 회귀 테스트

**Side Command 설계 예약:**
- 오른쪽 사이드바를 Side Command 워크스페이스 플로우 용도로 예약.
- 메인 스레드 모델과 독립적으로 분리 설계.

## 작업 계획
- [x] Open in Telegram: API, 모달 UI, Telegram 브릿지 통합
- [ ] Side Command: 오른쪽 사이드바 워크스페이스 플로우 구현
