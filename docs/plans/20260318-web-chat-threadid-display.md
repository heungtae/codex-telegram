# 웹 채팅 threadId 말풍선 표시 설계

## 문제 정의
- 목적: 웹 채팅에서 각 메시지 말풍선에 `threadId`를 일관되게 보여 현재 상단 요약과 개별 메시지 문맥을 연결한다.
- 범위: 웹 thread read API 응답, 실시간 SSE 이벤트 수신부, 프론트 메시지 모델과 말풍선 렌더링, 최소 스타일 조정까지 포함한다.
- 성공 기준:
  - 웹 채팅의 user, assistant, system 말풍선에서 해당 메시지의 `threadId`를 확인할 수 있다.
  - 기존 상단 `Current Thread` 표시와 충돌하지 않는다.
  - 과거 thread 조회와 실시간 turn 진행 모두에서 잘못된 `threadId`가 붙지 않는다.

## 요구사항 구조화
- 기능 요구사항:
  - thread read 응답의 각 message에 `thread_id`를 포함해야 한다.
  - 실시간 SSE로 들어오는 `turn_delta`, `system_message`, `file_change`에도 `thread_id`를 메시지 상태로 유지해야 한다.
  - 말풍선 내부에 본문과 분리된 메타 라인으로 `threadId`를 렌더링해야 한다.
  - 기존 상단 `Current Thread` 패널은 유지해야 한다.
- 비기능 요구사항:
  - 기존 메시지 dedupe, plan/file_change 렌더링을 깨지 않아야 한다.
  - 활성 thread가 바뀌어도 이미 렌더링된 과거 메시지의 `threadId`가 덮어써지지 않아야 한다.
  - 스타일은 현재 UI 톤을 유지하면서 가독성을 해치지 않아야 한다.
- 우선순위:
  - 1순위: 서버 응답과 실시간 이벤트에 thread metadata 고정
  - 2순위: 모든 말풍선 공통 메타 렌더링
  - 3순위: 테스트 보강

## 제약 조건
- 일정/리소스:
  - 문서를 저장한 뒤 바로 구현을 시작해야 하므로, 기존 메시지 모델을 확장하는 최소 변경이 적합하다.
- 기술 스택/환경:
  - 백엔드는 FastAPI, 프론트는 단일 `web/static/app.jsx` React 앱이다.
  - 실시간 갱신은 SSE(`/api/events/stream`)로만 들어온다.
- 기타:
  - 현재 프론트는 상단 패널에만 active thread를 보여 준다.
  - 과거 thread 읽기와 현재 active thread가 달라질 수 있으므로 렌더링 시점 fallback 남용은 위험하다.

## 아키텍처/설계 방향
- 핵심 설계:
  - 메시지 객체 자체에 `threadId`를 저장한다.
  - 서버의 `thread/read` 응답은 각 message에 `thread_id`를 넣어 내려준다.
  - 프론트의 실시간 이벤트 핸들러는 event payload의 `thread_id`를 각 message state에 복사한다.
  - UI는 모든 말풍선 하단에 작은 메타 라인으로 `threadId: ...`를 표시한다.
- 대안 및 trade-off:
  - 대안 1: 상단 `Current Thread`만 유지
    - 장점: 구현이 가장 작다.
    - 단점: 개별 메시지와 thread의 연결이 약하다.
  - 대안 2: assistant/system 말풍선에만 표시
    - 장점: UI가 덜 복잡하다.
    - 단점: user 메시지와의 일관성이 떨어진다.
  - 선택:
    - 모든 말풍선에 표시하되, 메타 스타일을 작게 두는 쪽이 정보 일관성과 구현 단순성의 균형이 가장 낫다.
- 리스크:
  - 일부 이벤트에서 `thread_id`가 비어 있을 수 있다.
  - streaming assistant 메시지 누적 중 `threadId`를 잃지 않도록 append 로직을 같이 수정해야 한다.

## 작업 계획
1. `docs/plans`에 설계 문서를 저장한다.
2. `web.server`에서 thread read 메시지에 `thread_id`를 포함하도록 확장한다.
3. `web/static/app.jsx`에서 모든 메시지 생성 경로에 `threadId`를 저장하고 렌더링한다.
4. `web/static/styles.css`에 메시지 메타 스타일을 추가한다.
5. 서버 테스트를 보강하고 관련 테스트를 실행해 회귀 여부를 확인한다.
