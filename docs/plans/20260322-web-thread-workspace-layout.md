# Thread별 Workspace 상태 분리 적용 설계 (현 구조 정합)

## Summary
- 현재 코드 구조(`web/frontend/src/*`) 기준으로 `workspace` 상태를 project tab 단위에서 thread 단위로 분리한다.
- `workspace-layout`은 단일 렌더 구조를 유지하고, thread 전환 시 상태 버킷을 복원하는 방식으로 적용한다.
- 목표는 thread 간 파일 트리 확장/프리뷰/status/error 상태가 섞이지 않고 독립적으로 유지되는 것이다.

## Key Changes
- 상태 모델 전환
  - `workspaceByProjectTabId`를 `workspaceByThreadId`로 전환한다.
  - `createEmptyWorkspaceState`는 재사용하고 저장/복원 키를 thread id로 통일한다.
  - `useWorkspaceBrowser`의 버킷 API를 thread 기준으로 재정의한다.
    - `ensureWorkspaceBucket(threadId)`
    - `resetWorkspaceBucket(threadId)`
    - `removeWorkspaceBucket(threadId)`
    - `restoreWorkspaceForThread(threadId)`
- 수명주기 동기화
  - `activeThread` 변경 시 해당 thread의 workspace 상태를 복원한다.
  - workspace 트리/프리뷰/status/error 변경 시 active thread 버킷만 갱신한다.
  - thread tab close 시 `messages`, `threadUi`와 함께 workspace 버킷도 정리한다.
  - project tab close 시 해당 탭 소유 thread들의 workspace 버킷을 일괄 정리한다.
- 렌더 구조 원칙
  - 기존 단일 `<div className="workspace-layout">` 구조는 유지한다.
  - thread 수만큼 `workspace-layout`을 반복 렌더하는 방식은 채택하지 않는다.
- 워크스페이스 API 컨텍스트
  - `workspaceContextQuery()`의 thread 우선 컨텍스트를 유지한다.
  - active thread가 유효하지 않거나 현재 project tab과 소유 관계가 맞지 않으면 project key로 fallback한다.

## Test Plan
- 수동 시나리오
  - thread A/B 각각 다른 디렉터리 확장/파일 프리뷰 상태를 만든 뒤 탭 전환 시 상태 분리 여부 확인.
  - thread close 시 닫힌 thread의 workspace 상태만 제거되고 나머지는 유지되는지 확인.
  - project tab 전환/복귀 시 각 thread의 workspace 상태가 유지되는지 확인.
  - active thread가 없는 상태에서 workspace 패널이 기본 상태로 동작하는지 확인.
- 자동 테스트(가능 시)
  - `useWorkspaceBrowser` 단위 테스트: thread 키 저장/복원, close 정리, project tab close 시 일괄 정리 검증.
  - `AuthenticatedApp` 상호작용 테스트: thread 전환 시 복원 로직과 close 시 cleanup 호출 검증.

## Public Interfaces / Types
- 백엔드 API 변경 없음.
- 이벤트 모델(`turn_*`, `plan_*`, `file_change`) 유지.
- 프론트엔드 내부 상태 인터페이스 변경
  - `workspaceByProjectTabId` -> `workspaceByThreadId`
  - `restoreWorkspaceForProjectTab` -> `restoreWorkspaceForThread`
  - workspace cleanup 함수들의 주요 입력 키를 projectTabId 기준에서 threadId 기준으로 조정

## Assumptions
- 안정성 우선으로 단일 레이아웃 구조를 유지한다.
- thread별 workspace 제어 범위는 `tree`, `expandedDirs`, `status`, `preview`, `error` 전체를 포함한다.
- 주요 변경 대상 파일은 다음이다.
  - `web/frontend/src/features/workspace/hooks/useWorkspaceBrowser.js`
  - `web/frontend/src/features/app/AuthenticatedApp.jsx`
  - `web/frontend/src/styles.css` (필요 시 최소 변경)
