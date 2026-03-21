# Web 다중 Project/Turn 탭 + Turn 종료 알림 설계

## Summary
- Web UI를 `Project 탭(상단 1행) -> Turn 탭(상단 2행)` 2계층으로 재구성한다.
- Project 클릭 시 최초 1회만 `새 Project 탭 열기 vs 현재 탭 교체`를 묻고, 선택을 `localStorage`에 저장해 이후 자동 적용한다.
- 각 Turn 탭은 독립 threadId로 turn을 실행하며, 탭별 동시 실행을 지원한다.
- `Workspace Files`는 전역 공유가 아니라 활성 `Project 탭`과 함께 이동하며, 파일 트리/선택 파일 컨텍스트도 프로젝트 단위로 분리한다.
- turn 종료 시 알림 토글(이미지 버튼)을 `Codex Web` 우측에 추가하고, 종료된 Project/Turn 탭 색상 변경 + 사운드 알림을 제공한다.

## Implementation Changes
- 프론트 상태 모델 재설계 (`web/static/app.jsx`):
  - `projectTabs[]`, `activeProjectTabId`, `threadTabsByProjectTabId`, `activeThreadTabIdByProjectTabId` 도입.
  - `workspaceByProjectTabId`(트리/선택 파일/확장 상태 등) 도입으로 Workspace UI를 프로젝트 탭 단위로 분리.
  - Turn 탭 상태: `idle|running|completed|failed|cancelled`, `hasUnreadCompletion`.
  - Project 탭 상태는 하위 Thread 상태 집계(우선순위: running > unread completion > idle).
  - 기존 단일 `activeThread`, `threadItems`, `projectItems.selected` 중심 렌더링을 탭 기반 렌더링으로 전환.
- UI 구조/스타일 (`web/static/app.jsx`, `web/static/styles.css`):
  - 상단 1행에 Project 가로 탭 바, 상단 2행에 Turn 가로 탭 바 추가.
  - 공간 활용을 위해 Project 탭(약 36px), Turn 탭(약 32px) 높이로 구성하고 가로 스크롤 방식(줄바꿈 없음)을 적용.
  - 상태 표현은 탭 전체 색칠보다 `상태 점(dot)` 또는 얇은 강조선 우선으로 적용해 본문 가독성을 유지.
  - `Codex Web` 라벨 우측에 알림 토글 버튼(내장 SVG 아이콘) 배치.
  - 완료/실패/취소 상태 탭 색상 분리(프로젝트/턴 모두).
- 프로젝트 클릭 UX:
  - 최초 클릭 시 선택 모달(새 탭 열기/기존 탭 교체) 표시.
  - 선택 결과를 `localStorage`(`codex-web-project-click-mode`)에 저장하고 이후 자동 적용.
- 이벤트/알림 처리:
  - SSE의 `turn_started`, `turn_completed`, `turn_failed`, `turn_cancelled`를 `thread_id` 기준으로 탭 상태에 반영.
  - 종료 이벤트에서 알림 활성화 시 짧은 사운드 재생(WebAudio), 비활성 시 무음.
  - 종료된 탭의 `hasUnreadCompletion`은 해당 탭 활성화 시 해제.
- 백엔드 API 확장 (`web/routes.py`, `web/workspace.py`, `models/user.py`, `codex/event_forwarding.py`):
  - `POST /api/projects/open-thread` 추가: `project_key`로 해당 workspace에서 새 thread 생성(전역 selected project 강제 변경 없음).
  - `GET /api/threads/summaries`에 `project_key` 필터 추가(현재 selected project 의존 제거).
  - `POST /api/chat/messages`를 `thread_id` 중심으로 동작하도록 보강, 전역 단일 active turn 차단 로직 제거.
  - workspace API(`tree/status/file/diff/suggestions`)에 `thread_id` 또는 `project_key` 컨텍스트 지원 추가.
  - 프론트는 Workspace API 호출 시 항상 활성 Project 탭 컨텍스트를 전달하여, 탭 전환 시 해당 프로젝트 파일만 노출.
  - turn 동시 실행 라우팅 안정화를 위해 `turn_id -> user_id/thread_id` 매핑을 `UserManager`에 추가(기존 단일 `active_turn_id` 의존 최소화).

## Public API / Interface Changes
- 신규:
  - `POST /api/projects/open-thread` (`{ project_key }` -> `{ thread_id, project_key, project_name, workspace }`)
- 변경:
  - `GET /api/threads/summaries?project_key=...`
  - `POST /api/chat/messages`에서 `thread_id` 명시 사용을 기본 경로로 처리
  - `GET /api/workspace/*`에 `thread_id`(우선) 또는 `project_key` 파라미터 추가
- 하위호환:
  - 기존 단일 프로젝트/스레드 UI 흐름은 fallback으로 유지

## Test Plan
- 백엔드 단위/통합 (`pytest`):
  - `projects/open-thread`가 project별 올바른 cwd로 thread 생성하는지.
  - `threads/summaries(project_key)`가 프로젝트별 스레드만 반환하는지.
  - `chat/messages`가 여러 thread_id에 대해 동시 turn 시작 가능한지.
  - workspace API가 `thread_id` 컨텍스트에 맞는 경로만 노출하는지.
  - turn 완료 이벤트가 올바른 사용자/탭(thread_id)로 전달되는지.
- 프론트 수동 시나리오:
  - 프로젝트 클릭 최초 팝업 1회 + 이후 자동 동작.
  - 여러 Project 탭, 각 Project 내 여러 Turn 탭 생성/전환.
  - 탭별 동시 turn 실행 중 상태/색상/알림 정확성.
  - 종료 후 미확인 색상 표시 및 탭 진입 시 해제.
  - 모바일/데스크톱에서 상단 2행 탭 레이아웃(Project/Turn) 유지.

## Assumptions / Defaults
- 구현 범위는 Web 전용(Telegram UX 변경 없음).
- Project 클릭 선택은 브라우저 재시작 후에도 유지(`localStorage`).
- 알림 버튼 아이콘은 외부 파일 없이 내장 SVG 사용.
- 알림 방식은 기본 `탭 색상 변경 + 사운드`; 토글로 on/off 가능.

## Phase Plan (Checklist)

### Phase 1. 백엔드 컨텍스트 분리
- 목표: `project_key`/`thread_id` 기반으로 API가 독립 동작하고, 기존 단일 흐름과 하위호환을 유지한다.
- 작업 체크리스트:
  - [x] `POST /api/projects/open-thread` 추가 (`project_key -> thread 생성 + workspace 반환`)
  - [x] `GET /api/threads/summaries`에 `project_key` 필터 추가
  - [x] `POST /api/chat/messages`를 `thread_id` 우선 처리로 보강
  - [x] `GET /api/workspace/*`에 `thread_id` 또는 `project_key` 컨텍스트 지원 추가
  - [x] `turn_id -> user_id/thread_id` 매핑 추가로 동시 turn 라우팅 안정화
  - [x] 기존 단일 프로젝트/스레드 fallback 동작 확인
- 검증 체크리스트:
  - [ ] `python3 -m pytest -k "projects or threads or chat or workspace" -q`
  - [x] 최소 수동 확인: 서로 다른 `thread_id` 2개에서 turn 동시 시작 가능

### Phase 2. 프론트 상태 모델 전환
- 목표: 단일 스레드 중심 상태를 Project/Turn 탭 구조로 교체한다.
- 작업 체크리스트:
  - [x] `projectTabs[]`, `activeProjectTabId` 도입
  - [x] `threadTabsByProjectTabId`, `activeThreadTabIdByProjectTabId` 도입
  - [x] Thread 상태(`idle|running|completed|failed|cancelled`, `hasUnreadCompletion`) 반영
  - [x] `workspaceByProjectTabId` 상태(파일 트리/선택 파일/로딩 상태) 분리
  - [x] Project 상태 집계(우선순위: `running > unread completion > idle`) 구현
  - [x] 기존 렌더/이벤트 연결을 탭 기반으로 전환
- 검증 체크리스트:
  - [x] 프로젝트 탭 전환 시 올바른 Turn(thread) 컨텍스트 유지
  - [x] Project별 Turn 목록/활성 탭 분리 유지
  - [x] 프로젝트 탭 전환 시 Workspace Files가 해당 프로젝트 컨텍스트로 함께 전환

### Phase 3. UI 배치 + 프로젝트 클릭 UX
- 목표: 2계층 탭 UI와 최초 1회 클릭 정책 선택 UX를 완성한다.
- 작업 체크리스트:
  - [x] 상단 Project 탭(1행) + 상단 Turn 탭(2행) 레이아웃 반영
  - [x] 탭 가로 스크롤/말줄임/높이(36px/32px) 적용으로 공간 활용 최적화
  - [x] `Codex Web` 우측 알림 토글 버튼(내장 SVG) 배치
  - [x] 프로젝트 클릭 시 최초 1회 모달(`새 탭 열기/현재 탭 교체`) 구현
  - [x] 선택값 `localStorage(codex-web-project-click-mode)` 저장/재사용 구현
  - [x] 모바일/데스크톱 레이아웃 점검 및 CSS 보정
- 검증 체크리스트:
  - [x] 최초 1회만 모달 노출되고 이후 자동 동작
  - [x] 레이아웃 깨짐 없이 Project/Turn 탭 조작 가능
  - [x] 활성 Project 탭 변경 시 Workspace 파일 목록/선택 파일이 즉시 동기화

### Phase 4. 종료 알림 + 미확인 상태 처리
- 목표: turn 종료 알림과 탭 상태 표시를 정확히 동기화한다.
- 작업 체크리스트:
  - [x] SSE `turn_started`/`turn_completed`/`turn_failed`/`turn_cancelled` 상태 반영
  - [x] 종료 시 `hasUnreadCompletion` 설정, 해당 탭 활성화 시 해제
  - [x] 알림 토글 ON 시 WebAudio 재생, OFF 시 무음 처리
  - [x] 완료/실패/취소 상태 색상 분리(프로젝트/턴 모두)
- 검증 체크리스트:
  - [x] 동시 실행 중 탭별 상태/색상/알림이 올바르게 분리 동작
  - [x] 미확인 표시가 탭 진입 시 정상 해제

## Execution Tracking
- [x] Phase 1 완료
- [x] Phase 2 완료
- [x] Phase 3 완료
- [x] Phase 4 완료
- [ ] 회귀 테스트 완료 (`python3 -m pytest -q`)
- [ ] 최종 수동 시나리오 점검 완료 (데스크톱/모바일)
