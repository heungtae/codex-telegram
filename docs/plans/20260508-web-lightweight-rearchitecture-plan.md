# 20260508 Web Lightweight Rearchitecture Plan

복구본: assistant 실수로 원본 삭제 후 복구 작성.

## 배경
현재 프론트엔드는 단일 컨테이너에 세션 상태, SSE 이벤트 처리, 레이아웃 제어, 입력/단축키 처리, 워크스페이스 상호작용이 함께 결합되어 있다. 이 구조는 변경 영향 범위를 넓히고, UI 확장 및 회귀 검증 비용을 높인다. 본 변경안은 책임 경계를 재정의해 유지보수성과 확장성을 확보하는 것을 목표로 한다.

## 목표 아키텍처
프론트엔드 구조를 다음 4계층으로 재편한다.

- `Container (Orchestration)`
  - 화면 단위 조립, 의존성 주입, 도메인 훅 호출 순서 관리만 담당한다.
  - 도메인 상태 전이 및 이벤트 처리 로직을 직접 소유하지 않는다.
- `Domain Hooks`
  - 세션, 스레드, 턴, 레이아웃, 리사이즈, 키보드 등 도메인 단위 상태/행위를 캡슐화한다.
  - 훅의 입력/출력을 명시적 타입 계약으로 관리한다.
- `UI Components`
  - 프리젠테이션 중심 컴포넌트로 분해한다.
  - 도메인 의존은 props/view-model을 통해서만 받는다.
- `Infrastructure (API/SSE)`
  - 네트워크 호출과 이벤트 스트림 수신을 어댑터 레이어로 고립한다.
  - 도메인 레이어에는 정규화된 데이터만 전달한다.

## 도메인 분리 원칙
다음 책임을 도메인 단위로 분리한다.

- Project/Thread 세션 책임
  - 탭 상태, 활성 스레드, 스레드 전환과 세션 동기화.
- Turn/SSE 책임
  - `turn_*`, `plan_*`, `reasoning_*`, `approval_required`, `file_change`, `app_event` 처리.
- Workspace 책임
  - 트리/상태/미리보기 조회, 경로 컨텍스트, refresh 동작.
- Viewport/Resize/Keyboard 책임
  - 반응형 레이아웃, 패널 리사이즈, 전역 단축키, 모달 키 이벤트.

## 데이터 흐름
데이터 흐름은 아래 단일 경로를 따른다.

1. 입력 수신
   - 사용자 액션(클릭, 입력, 단축키) 및 SSE 이벤트 수신.
2. 도메인 상태 전환
   - 각 도메인 훅이 상태를 갱신하고 파생 데이터를 계산.
3. View-model 생성
   - UI가 직접 소비 가능한 형태로 상태를 정규화.
4. 프리젠테이션 렌더
   - UI 컴포넌트는 view-model 기반으로만 렌더.

상태 경계(thread/project/workspace)는 분리 유지하며, 경계 간 영향은 명시적 액션 호출로만 허용한다.

## UI 구성 변경안
UI는 기능 단위 컴포넌트 중심으로 분해한다.

- App Shell: 전역 레이아웃, 패널 배치, 공통 chrome.
- Session Panel: 프로젝트/스레드 탐색 및 전환.
- Conversation Panel: 메시지 스트림, 입력, 실행 상태.
- Workspace Panel: 파일 트리/상태/미리보기.
- Feedback Layer: toast, error, approval-required 상태 표현.

상태 표현 규약은 `loading/running/error/approval-required`로 통일하고, 상태 전이 트리거는 도메인 훅에서만 발생시킨다.

## 마이그레이션 전략
- Phase 1: 상태 경계와 인터페이스 계약 정의.
- Phase 2: 도메인 훅 추출 및 컨테이너 책임 축소.
- Phase 3: UI 컴포넌트 분해와 프리젠테이션 계층 정리.
- Phase 4: SSE/turn 파이프라인 정규화 및 회귀 검증.

## 타입/인터페이스 정책
- 외부 API 계약은 유지한다.
- 내부 타입 정책:
  - 도메인 훅 입력/출력 타입 명세.
  - UI 컴포넌트 props 계약 표준화.
  - 이벤트 payload -> view-model 변환 타입 계층화.

## 검증 전략
회귀 검증은 다음 시나리오를 기준으로 수행한다.

- thread/project 전환
- command 실행 및 상태 전이
- SSE turn 반영
- approval flow 처리
- workspace preview/resize 상호작용

품질 게이트:
- `tsc --noEmit`
- `lint`
- `test --runInBand`
- `build`

## 완료 기준
- 컨테이너는 orchestration 책임만 수행한다.
- 도메인 책임이 hook 단위로 분리된다.
- UI 컴포넌트가 view-model 소비 구조로 정리된다.
- 핵심 시나리오 회귀 없이 품질 게이트를 통과한다.
