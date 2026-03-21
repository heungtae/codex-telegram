# Thread별 Workspace Layout 분리 설계

## Summary
- `thread tab` 개수만큼 `workspace-layout` 컨테이너를 동적으로 렌더링하고, `activeThread`에 해당하는 컨테이너만 노출되도록 변경한다.
- 현재 project tab 단위로 공유되는 workspace 상태를 thread 단위로 분리해, 파일 트리 확장/프리뷰/에러 상태를 각 thread가 독립적으로 유지하게 만든다.
- 비활성 thread 레이아웃은 언마운트하지 않고 숨김 처리해 상태를 보존한다.

## Key Changes
- 상태 모델 전환
  - `workspaceByProjectTabId` 중심 구조를 `workspaceByThreadId` 중심 구조로 변경.
  - 기본 워크스페이스 상태 생성 함수(`createEmptyWorkspaceState`)는 재사용하고, 저장/복원 키를 thread id로 통일.
- 렌더 구조 전환
  - 기존 단일 `<div className="workspace-layout">`를 thread tab 목록 기반 반복 렌더로 변경.
  - 각 레이아웃에 thread 식별 가능한 class/data 속성을 부여하고, active 여부에 따라 `display`/`visibility` 클래스로 제어.
- 동기화/수명주기
  - thread 전환 시 해당 thread의 workspace 상태를 복원.
  - workspace 트리/프리뷰/status 변경 시 active thread 버킷만 업데이트.
  - thread tab close 시 해당 thread의 `messages`, `threadUi`, `workspace` 버킷까지 함께 정리.
- 워크스페이스 API 컨텍스트
  - `workspaceContextQuery()`는 기존처럼 thread 우선 컨텍스트를 유지하되, active layout의 thread id를 기준으로 동작하도록 정합성 보장.

## Test Plan
- 수동 시나리오
  - thread A/B를 열고 각기 다른 파일 트리 확장, 파일 프리뷰를 만든 뒤 탭 전환 시 상태가 서로 섞이지 않는지 확인.
  - inactive thread는 숨김이고 active thread만 표시되는지 확인.
  - thread close 시 해당 thread의 workspace 상태가 제거되고 다른 thread에 영향 없는지 확인.
  - project tab 전환/복귀 시 thread별 workspace 상태가 유지되는지 확인.
- 자동 테스트(가능 시)
  - 렌더링 테스트: active thread만 노출 클래스 적용 확인.
  - 상태 테스트: thread id 키 기반 저장/복원, close 시 정리 로직 검증.

## Public Interfaces / Types
- 백엔드 API 변경 없음.
- 프론트엔드 내부 상태 구조 변경
  - `workspaceByProjectTabId` -> `workspaceByThreadId` (내부 구현 상세).
- 이벤트 모델(`turn_*`, `plan_*`, `file_change`)은 기존 유지.

## Assumptions
- 숨김 유지 방식으로 구현한다.
- thread별 workspace 제어 범위는 파일 트리, 확장 상태, status, preview, error를 포함한다.
- 레이아웃 수는 현재 열린 thread tab 수를 기준으로 한다.
- 주요 변경 대상 파일은 `web/static/app.jsx`, `web/static/styles.css` 이다.
