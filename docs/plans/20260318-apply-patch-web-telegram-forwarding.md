# Apply Patch 변경사항 전달 설계

## 문제 정의
- 목적: `apply_patch`로 실제 반영된 파일 변경사항이 현재 세션의 `web` UI와 `telegram` 채널 모두에 일관되게 전달되도록 이벤트 전달 구조를 설계한다.
- 범위: Codex app-server 이벤트 수신부, 내부 도메인 이벤트 정규화, Web SSE 전달, Telegram 메시지 전달, 최소 UI/포맷 요구사항까지 포함한다.
- 성공 기준:
  - `apply_patch` 실행 후 변경 파일 목록과 핵심 diff 요약이 현재 사용자 세션의 `web`과 `telegram`에 모두 보인다.
  - 승인 요청(`applyPatchApproval`)과 실제 변경 결과(`turn/diff/updated` 또는 동등 이벤트)가 혼동되지 않는다.
  - 기존 `turn_delta`, approval, 일반 시스템 메시지 흐름을 깨지 않는다.

## 요구사항 구조화
- 기능 요구사항:
  - `apply_patch` 결과를 식별할 수 있어야 한다.
  - 변경 파일 목록, 추가/삭제 라인 수, 가능하면 hunk preview를 추출해야 한다.
  - 동일 turn에서 여러 번 발생하는 patch 변경은 누적 또는 배치해 전달해야 한다.
  - `web`은 채팅 타임라인 안에서 변경 이벤트를 구조적으로 보여줘야 한다.
  - `telegram`은 메시지 길이 제한 내에서 요약본을 받아야 한다.
  - thread/turn 기준으로 해당 사용자에게만 전달되어야 한다.
- 비기능 요구사항:
  - app-server event payload shape가 일부 달라도 fallback 가능한 파서여야 한다.
  - 이벤트 중복 전송을 피해야 한다.
  - 대용량 diff에서도 Telegram 4096자 제한과 Web 렌더링 부담을 제어해야 한다.
  - 기존 approval 처리와 event forwarding 정책과 충돌하지 않아야 한다.
- 우선순위:
  - 1순위: 내부 정규화와 양 채널 fan-out
  - 2순위: Web 구조화 표시
  - 3순위: Telegram 요약 최적화와 diff preview 고도화

## 제약 조건
- 일정/리소스:
  - 현재 구현은 `main.py`의 `forward_event`에 이벤트 fan-out이 집중되어 있어, 가장 작은 변경으로 여기에 정규화 단계를 추가하는 편이 안전하다.
- 기술 스택/환경:
  - app-server와는 JSON-RPC notification 기반이다.
  - Web은 `WebEventHub` + SSE(`/api/events/stream`)를 사용한다.
  - Telegram은 `python-telegram-bot`의 단건 메시지 전송 중심이다.
- 기타:
  - 현재 Web 프론트는 `turn_delta`, `turn_started`, `turn_completed`, `turn_failed`, `approval_required`, `system_message`만 실질 소비한다.
  - 현재 Telegram 포워딩은 `_format_event()` 문자열 포맷 기반이라 구조화된 diff 전달에는 한계가 있다.
  - 저장소 기준으로 `turn/diff/updated`는 로깅 대상이지만, 별도 UI 이벤트로 승격되어 있지 않다.

## 아키텍처/설계 방향
- 핵심 설계:
  - `apply_patch` 관련 전달을 "승인"과 "결과"로 분리한다.
  - 승인 단계:
    - 기존 `item/tool/requestUserInput`, `applyPatchApproval`, `item/fileChange/requestApproval` 계열은 현 구조대로 approval flow를 유지한다.
  - 결과 단계:
    - `turn/diff/updated`를 1차 신호로 사용한다.
    - app-server가 다른 method로 diff를 보내더라도, method/payload를 보고 `file_change` 도메인 이벤트로 정규화한다.
  - `main.py`에 `_extract_file_change_summary(method, params)`를 추가한다.
    - 입력 후보:
      - `turn/diff/updated`
      - `item/completed` 내부 tool 결과에 diff/path 정보가 포함된 경우
      - 향후 `codex/event/*` 계열의 file-change payload
    - 출력 shape:
      - `thread_id`
      - `turn_id`
      - `source` (`apply_patch`, `file_change`, `unknown`)
      - `files`: `[{path, change_type, additions, deletions, preview}]`
      - `summary_text`
      - `raw_params`
  - 정규화된 결과가 있으면 `forward_event()`에서 별도 fan-out을 수행한다.
    - Web: `type = "file_change"`
    - Telegram: 요약 문자열로 즉시 전송
  - 일반 `app_event` 문자열 포워딩은 유지하되, `file_change`로 승격된 이벤트는 Telegram 중복 전송을 막기 위해 일반 `_format_event()` 경로에서 제외한다.

- Web 전달 설계:
  - `event_hub.publish_event()` payload에 `type: "file_change"`를 추가한다.
  - payload 예시:
    - `thread_id`
    - `turn_id`
    - `source`
    - `summary`
    - `files`
  - `web/static/app.jsx`에서 `file_change` 이벤트를 수신해 `messages`에 `role: "system"` 또는 별도 `kind: "file_change"`로 append 한다.
  - 1차 구현은 채팅 타임라인에 요약 텍스트 + 파일 리스트를 렌더링한다.
  - 2차 확장으로 파일별 fold/unfold preview를 둘 수 있다.

- Telegram 전달 설계:
  - `_send_telegram_file_change(user_id, summary, thread_id)` 헬퍼를 별도로 둔다.
  - 기본 포맷:
    - 첫 줄: `Applied patch changes`
    - 이후 파일별 1줄 요약: `M path/to/file.py (+12 -3)`
    - 필요 시 마지막에 `... (N more files)` 추가
    - footer: `threadId: ...`
  - 파일 수 또는 본문 길이가 길면 preview 없이 파일 통계만 보낸다.
  - 동일 turn 안에서 diff 이벤트가 여러 번 오면 debounce 또는 turn-local accumulator로 300~800ms 내 묶어서 1건으로 보낸다.

- 이벤트 정규화 위치 선택:
  - `main.py`의 `forward_event()` 바로 앞 또는 내부에 둔다.
  - 이유:
    - thread/turn -> user 매핑 로직이 이미 여기에 있다.
    - Web/Telegram 양쪽 fan-out이 한 지점에 모여 있다.
    - approval flow와 상태 동기화도 같은 컨텍스트를 공유한다.

- 데이터 모델 제안:
  - 새 TypedDict/도우미 dataclass를 추가한다. 위치는 `main.py` 내부 helper 또는 별도 `codex/file_changes.py`.
  - 권장 shape:
    - `FileChangeEntry(path, change_type, additions, deletions, preview)`
    - `FileChangeSummary(thread_id, turn_id, source, files, summary_text, raw_params)`
  - 초기 구현은 별도 모듈 분리 없이 `main.py` helper로 시작하고, payload 패턴이 안정되면 `codex/events.py` 또는 `codex/file_changes.py`로 승격한다.

- 파싱 전략:
  - 우선 payload에 `diff`, `changes`, `files`, `patch`, `path`, `added`, `removed`, `additions`, `deletions` 키가 있는지 탐색한다.
  - 리스트/딕셔너리 혼합 구조를 허용한다.
  - 명시적 파일 리스트가 없으면 unified diff 텍스트에서 `+++`, `---`, `diff --git` 기준으로 파일명을 추출한다.
  - 어떤 것도 파싱되지 않으면 `summary_text`만 생성해 generic file-change로 전달한다.

- 중복 방지:
  - `turn/diff/updated` 직후 `item/completed`에서도 같은 파일 정보가 반복될 수 있다.
  - `(turn_id, normalized_path, additions, deletions)` 정도로 짧은 TTL 캐시를 두고 최근 동일 이벤트를 드롭한다.

- 대안 및 trade-off:
  - 대안 1: 기존 `_format_event()` 문자열 경로만 확장
    - 장점: 변경량이 적다.
    - 단점: Web 구조화 UI를 만들 수 없고 Telegram/Web 포맷이 강하게 결합된다.
  - 대안 2: app-server payload를 그대로 Web에만 노출
    - 장점: 구현이 빠르다.
    - 단점: Telegram과 UX 일관성이 깨지고 payload shape 변화에 취약하다.
  - 선택:
    - 내부 `file_change` 도메인 이벤트를 도입하는 방향이 가장 안정적이다.

- 리스크:
  - app-server의 실제 `turn/diff/updated` payload shape가 예상과 다를 수 있다.
  - 한 turn에서 patch가 매우 많으면 Telegram 스팸이 될 수 있다.
  - Web 타임라인에서 system message와 file change card를 섞을 때 시각적 구분이 약할 수 있다.

## 작업 계획
1. 실제 app-server `turn/diff/updated`와 관련 payload 샘플을 로그 또는 테스트 fixture로 수집한다.
2. `main.py`에 file-change summary extractor와 dedupe/accumulate helper를 추가한다.
3. `forward_event()`에서 `file_change`를 일반 문자열 포워딩과 분리해 Web/Telegram fan-out을 구현한다.
4. `web/static/app.jsx`에 `file_change` SSE listener와 타임라인 렌더링을 추가한다.
5. Telegram용 요약 메시지 포맷터와 길이 제한 처리를 추가한다.
6. 테스트를 추가한다.
7. 필요하면 `forwarding.rules`에 `turn/diff/updated` 기본 허용 규칙 또는 문서를 보강한다.

