# Thread 탭별 독립 작업 세션 설계

## 문제 정의
- 목적:
  - Thread 탭마다 `message view`, `input`, `send/stop/new` 상태를 독립적으로 유지하여 멀티 작업 UX를 제공한다.
  - 탭 전환 시 기존 상태를 즉시 복원하고, 백엔드 이벤트는 해당 thread 세션에만 반영한다.
- 범위:
  - Web UI(`web/static/app.jsx`)와 Web API 경로(`web/routes.py`) 중심.
  - Telegram 쪽 UI/동작은 본 작업 범위에서 제외.
- 성공 기준:
  - 탭 A에서 입력 중/실행 중인 상태가 탭 B로 전환해도 유지된다.
  - 탭 B에서 독립적으로 입력/전송 가능하다.
  - `turn_delta`, `turn_completed` 등 이벤트가 해당 thread 세션에만 누적된다.
  - 탭 전환 시 불필요한 `/api/threads/read` 재호출 없이 복원된다(캐시 우선).

## 요구사항 구조화
- 기능 요구사항:
  - Thread별 composer 상태 저장:
    - `draft input`
    - `turn status(idle/running/failed/completed/cancelled)`
    - `active turn id`
    - `last activity detail`
  - Thread별 message store 유지:
    - 기존 `messagesByThreadId`를 단일 source of truth로 확장.
    - 현재 활성 탭은 store를 참조해 렌더, 비활성 탭은 메모리에 유지.
  - 버튼 동작의 thread-스코프화:
    - `Send`: 활성 thread 세션 기준 전송.
    - `Stop`: 활성 thread 세션의 turn만 중지.
    - `New`: 현재 thread tab 교체/추가 모드에 맞게 동작.
  - 이벤트 라우팅 thread-스코프화:
    - SSE payload의 `thread_id`로 정확한 세션 업데이트.
- 비기능 요구사항:
  - 탭 전환 즉시성(체감 지연 최소화).
  - 기존 단일 탭 사용 흐름과의 하위호환.
  - 장애 시 graceful fallback(세션 미존재시 재조회/초기화).
- 우선순위:
  1. 프론트 세션 분리(보이는 UX 완성)
  2. 백엔드 thread-스코프 turn 제어/상태 API 정합성
  3. 회귀 테스트 확장

## 제약 조건
- 일정/리소스:
  - 2단계 순차 진행(프론트 → 백엔드).
- 기술 스택/환경:
  - FastAPI + React(JSX) + SSE 이벤트 모델.
  - 현재 서버 상태 모델은 `UserState.active_turn_id` 단일값 중심.
- 기타:
  - 메모리 용량 최적화는 이번 범위에서 제외(사용자 요청).

## 아키텍처/설계 방향
- 핵심 설계:
  - 프론트에 `threadSessions` 도입:
    - key: `thread_id`
    - value: `{ messages, draftInput, uiStatus, activeTurnId, activityDetail, updatedAt }`
  - 활성 탭 변경 시:
    - 기존 렌더 상태를 현재 thread 세션에 flush
    - 대상 thread 세션 snapshot을 즉시 restore
  - SSE 수신 시:
    - `thread_id` 기반으로 해당 세션만 갱신
    - 활성 thread와 다르면 unread/배지 처리만 갱신
  - 전송/중지 API 호출은 항상 활성 thread 기준.
- 대안 및 trade-off:
  - 대안 A: 탭마다 별도 React 서브트리 유지(숨김 렌더)
    - 장점: 상태 분리 명확
    - 단점: 컴포넌트/이벤트 비용 증가, 구조 변경 큼
  - 대안 B(채택): 단일 렌더 + 세션 스토어 복원
    - 장점: 현재 구조와 diff 최소, 점진적 도입 가능
    - 단점: 세션 동기화 포인트 관리 필요
- 리스크:
  - 백엔드가 단일 `active_turn_id`면 실질 동시 실행이 제한될 수 있음.
  - 이벤트에 `thread_id` 누락 시 라우팅 모호.
  - 탭 닫기/교체 시 세션 정리 누락 위험.

## 작업 계획
1. 프론트(1단계)
   - `threadSessions` 상태 구조 추가 및 read/write 유틸 도입.
   - `input/status/activityDetail/messages`를 활성 thread 세션과 동기화.
   - `send/stop/new` 버튼을 활성 thread 세션 기준으로 동작하도록 변경.
   - SSE 이벤트 핸들러를 thread 스코프로 정리.
   - 탭 전환/닫기/교체 시 세션 restore/cleanup 처리.
2. 프론트 검증
   - 수동 시나리오: 탭 A running + 탭 B drafting + 전환 반복.
   - 회귀 테스트(가능 범위): 탭 전환 시 세션 유지, 닫기 시 정리.
3. 백엔드(2단계)
   - `active_turn_id` 단일 상태 의존 구간 분석.
   - thread-스코프 turn 상태 조회/제어 경로 보강:
     - `send_message`, `interrupt`, 이벤트 forward 시 thread 기준 정합성 강화.
   - 필요 시 `UserState`에 thread별 turn 상태 맵 추가.
4. 백엔드 검증
   - stale thread/동시 실행/interrupt 대상 thread 정확성 테스트 추가.
5. 통합 마무리
   - 프론트/백엔드 통합 시나리오 점검.
   - 사용자 가이드(동작 변경점) 간단 문서화.
