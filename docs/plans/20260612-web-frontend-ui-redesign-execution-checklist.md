# Web Frontend UI Redesign Execution Checklist

작성일: 2026-06-12

기준 문서: `docs/plans/20260612-web-frontend-ui-redesign.md`

대상: Web frontend 사이드바 정보 구조 및 Workspace 시각 체계 개편

범위: 설계 설명과 분리된 실행·검증 체크리스트

## Summary
- 목적: UI redesign 구현을 작은 변경 단위와 명확한 완료 게이트로 관리한다.
- 원칙: API, SSE, 인증, 서버 데이터 형식과 기존 세션 동작은 유지한다.
- 순서: 데이터 계약 → Projects view-model → Projects UI → Threads → 설정 팝오버 → 사이드바 프레임 → Workspace 스타일 → 통합 검증.
- 기록: 의미 있는 파일 변경마다 `docs/web-rearchitecture-log.md`를 갱신한다.

## Always Gate. 상시 적용 기준

### 변경 금지선
- [x] `/api/*` endpoint, request, response 형식을 변경하지 않는다.
- [x] SSE 이벤트 타입과 payload 의미를 변경하지 않는다.
- [x] 인증 쿠키와 Web session 흐름을 변경하지 않는다.
- [x] 프로젝트/스레드 서버 저장 방식과 `conf.toml` 형식을 변경하지 않는다.
- [x] 기존 Telegram 동작과 backend runtime을 변경하지 않는다.
- [x] 관련 없는 리팩터링과 파일 이동을 포함하지 않는다.
- [x] 사용자 작업인 `conf.toml`, `utils/single_instance.py`와 기타 무관 변경을 되돌리지 않는다.

### 구현 규칙
- [x] 기존 domain hook의 세션 전이와 fallback 로직을 UI 컴포넌트에 복제하지 않는다.
- [x] 프로젝트와 스레드 식별에는 기존 `key`, `projectTabId`, 정규화된 `threadId`를 사용한다.
- [x] UI 로컬 상태는 펼침과 팝오버 표시 상태로 제한한다.
- [x] 아이콘은 기존 내부 SVG 컴포넌트 패턴을 사용한다.
- [x] 외부 UI 라이브러리를 추가하지 않는다.
- [x] 접근 가능한 button, `aria-expanded`, `aria-controls`, `aria-label`을 유지한다.
- [x] frontend source 변경 후 반드시 production build를 실행한다.

### 변경 단위별 검증
- [x] 관련 component/state 단위 테스트를 먼저 추가하거나 수정한다.
- [x] 회귀 테스트가 기존 구현에서 의도한 이유로 실패하는지 확인한다.
- [x] 최소 구현 후 대상 테스트가 통과하는지 확인한다.
- [x] Stage 종료 시 전체 frontend test를 실행한다.
- [x] Stage 종료 시 TypeScript 검사를 실행한다.
- [x] Stage 종료 시 lint 오류가 없는지 확인한다.
- [x] Stage 종료 시 frontend production build를 실행한다.
- [x] `git diff --check`로 공백 오류를 확인한다.
- [x] 검증 결과와 다음 단계를 진행 로그에 기록한다.

## Stage 1. Sidebar 데이터 계약 확장

### 진입 조건
- [x] 기준 UI redesign 문서의 Projects 데이터 규칙을 재확인한다.
- [x] 기존 `projectItems`, `projectTabs`, `threadTabsByProjectTabId` 소유 위치를 확인한다.
- [x] Always Gate 항목을 확인한다.

### Context 계약
- [x] sidebar domain context에 전체 `threadTabsByProjectTabId`를 노출한다.
- [x] 활성 프로젝트 전용 `threadTabs`가 다른 화면에서 필요한지 검색한다.
- [x] sidebar 전용 props에서는 활성 프로젝트 전용 `threadTabs` 의존을 제거한다.
- [x] `projectItems`가 TOML 프로젝트 전체라는 계약을 타입 또는 테스트 fixture에 반영한다.
- [x] `projectTabs` 행에 `id`, `key`, `name`, `path`가 전달되는지 확인한다.
- [x] `activeProjectTabId`와 `projectTabStatusById` 전달을 유지한다.
- [x] `threadItems`와 `activeThread` 전달을 유지한다.

### 액션 계약
- [x] 열린 프로젝트 세션 선택 액션이 `projectTabId`를 받도록 유지한다.
- [x] 프로젝트 세션 닫기 액션이 `projectTabId`를 받도록 유지한다.
- [x] 채팅 선택 액션에 소유 `projectTabId`를 명시할 수 있는 wrapper를 정의한다.
- [x] 채팅 닫기 액션에 소유 `projectTabId`와 `threadId`를 모두 전달한다.
- [x] 새 채팅 액션에 대상 `projectTabId`를 명시할 수 있는 wrapper를 정의한다.
- [x] 비활성 프로젝트 세션 채팅 선택 시 프로젝트 활성화가 먼저 수행되도록 순서를 고정한다.
- [x] 비활성 프로젝트 세션 새 채팅 생성 시 프로젝트 활성화 후 기존 생성 동작을 실행한다.
- [x] 모바일에서 프로젝트나 채팅 선택 후 사이드바 닫기 동작을 유지한다.

### 전달 경로
- [x] `useAppRuntimePresentation`의 context value를 갱신한다.
- [x] `AppSidebarContainer`의 domain/runtime 타입을 갱신한다.
- [x] `AppSidebarPane` props를 갱신한다.
- [x] `AppSidebarContentPanel` props를 갱신한다.
- [x] 삭제된 props가 중간 컴포넌트에 남아 있지 않은지 검색한다.
- [x] container/pane/content panel 테스트 fixture를 새 계약에 맞춘다.

### 검증
- [x] context value 테스트가 전체 프로젝트별 채팅 맵을 보존한다.
- [x] container 테스트가 프로젝트별 액션 wrapper를 전달한다.
- [x] TypeScript에서 제거된 props 참조가 없는지 확인한다.

### 완료 조건
- [x] UI 컴포넌트가 프로젝트별 열린 채팅을 추가 조회 없이 렌더링할 수 있다.
- [x] 프로젝트별 선택·닫기·생성 액션의 대상이 모호하지 않다.
- [x] 기존 API/SSE 계약에 변경이 없다.
- [x] 대상 테스트, 전체 test, typecheck, lint, build가 통과한다.

## Stage 2. Projects View-Model 구성

### 진입 조건
- [x] Stage 1 완료.
- [x] TOML 프로젝트와 열린 세션의 병합 규칙을 기준 문서와 대조한다.
- [x] Always Gate 항목을 확인한다.

### 행 타입과 변환 함수
- [x] UI가 소비할 프로젝트 행 타입을 정의한다.
- [x] 기본 프로젝트 행과 열린 세션 행을 식별할 필드를 정의한다.
- [x] 열린 세션 행에 `projectTabId`를 포함한다.
- [x] 열린 세션 행에 상태, 활성 여부와 채팅 배열을 포함한다.
- [x] 기본 프로젝트 행에는 TOML `key`, `name`, `path`, `default` 정보를 포함한다.
- [x] `projectItems.key === projectTabs.key` 기준의 순수 변환 함수를 작성한다.
- [x] 변환 함수가 입력 배열을 변경하지 않도록 한다.

### 병합 규칙
- [x] TOML 프로젝트 순서를 최상위 순서로 유지한다.
- [x] 열리지 않은 프로젝트는 기본 행 하나를 생성한다.
- [x] 열린 세션이 있는 프로젝트는 기본 행을 생성하지 않는다.
- [x] 열린 세션 수만큼 독립 세션 행을 생성한다.
- [x] 동일 프로젝트 세션은 `projectTabs` 순서를 유지한다.
- [x] 동일 프로젝트 이름을 임의로 변경하거나 번호를 붙이지 않는다.
- [x] 각 세션 행에 `threadTabsByProjectTabId[projectTabId]`만 연결한다.
- [x] 프로젝트 상태는 `projectTabStatusById[projectTabId]`에서 계산한다.
- [x] `activeProjectTabId`와 일치하는 세션 행만 활성으로 표시한다.

### 비정상·경계 입력
- [x] `projectItems`가 비어 있을 때 빈 배열을 반환한다.
- [x] `projectTabs`가 비어 있을 때 모든 TOML 프로젝트를 기본 행으로 반환한다.
- [x] TOML에서 제거됐지만 열린 세션으로 남은 프로젝트 처리 방식을 고정한다.
- [x] 열린 orphan 세션은 유실하지 않고 `projectTabs` 순서로 목록 끝에 표시한다.
- [x] `threadTabsByProjectTabId`에 키가 없으면 빈 채팅 배열을 사용한다.
- [x] 빈 프로젝트명은 프로젝트 key로 fallback한다.
- [x] 빈 채팅 제목은 thread ID로 fallback한다.

### 단위 테스트
- [x] 열리지 않은 TOML 프로젝트 기본 행 생성 테스트.
- [x] 열린 프로젝트가 세션 행으로 대체되는 테스트.
- [x] 동일 프로젝트 복수 세션 독립 행 테스트.
- [x] TOML 프로젝트 순서 보존 테스트.
- [x] 동일 프로젝트 세션 순서 보존 테스트.
- [x] 프로젝트별 채팅 배열 격리 테스트.
- [x] 상태와 활성 여부 매핑 테스트.
- [x] orphan 세션 fallback 테스트.
- [x] 빈 입력 테스트.

### 완료 조건
- [x] Projects UI가 조건 분기 없이 행 view-model을 순회할 수 있다.
- [x] 복수 세션과 프로젝트별 채팅 소유권이 보존된다.
- [x] 순수 변환 테스트가 모든 병합 경계를 고정한다.
- [x] 대상 테스트, 전체 test, typecheck, lint, build가 통과한다.

## Stage 3. Projects 평면 목록 UI

### 진입 조건
- [x] Stage 2 완료.
- [x] 기존 프로젝트 선택 모달과 세션 닫기 fallback 동작을 확인한다.
- [x] Always Gate 항목을 확인한다.

### 섹션 구조
- [x] 기존 `SidebarProjectsPanel`을 새 Projects 목록 책임에 맞게 갱신하거나 교체한다.
- [x] Panel 카드 외곽 배경, 테두리와 그림자를 제거한다.
- [x] `Projects` 섹션 제목을 평면 헤더로 표시한다.
- [x] interaction busy 안내를 목록 흐름을 방해하지 않는 위치에 유지한다.
- [x] 프로젝트가 없을 때 기존 빈 상태를 유지한다.

### 기본 프로젝트 행
- [x] 프로젝트 이름과 경로를 표시한다.
- [x] default 프로젝트 표시를 유지한다.
- [x] 이름 클릭 시 기존 `selectProject(projectKey)`를 호출한다.
- [x] interaction busy 중 선택을 비활성화한다.
- [x] 열린 세션 전용 화살표와 닫기 버튼을 표시하지 않는다.
- [x] active project key 표시가 열린 세션 활성 표시와 충돌하지 않게 한다.

### 열린 세션 행
- [x] 프로젝트명, 상태, 화살표와 닫기 버튼을 한 줄 flex로 배치한다.
- [x] 프로젝트명 클릭 시 해당 `projectTabId`를 활성화한다.
- [x] 화살표 클릭은 펼침 상태만 변경한다.
- [x] 화살표 클릭이 프로젝트 선택으로 전파되지 않게 한다.
- [x] 닫기 클릭은 해당 `projectTabId`만 닫는다.
- [x] 닫기 클릭이 프로젝트 선택이나 펼침으로 전파되지 않게 한다.
- [x] active, running, unread, failed, cancelled 상태 스타일을 적용한다.
- [x] 프로젝트명이 길 때 말줄임 처리한다.
- [x] 동일 이름의 복수 세션이 독립 DOM key와 독립 액션을 사용한다.

### 펼침 상태
- [x] 펼침 상태를 `projectTabId` 기준 map/set으로 관리한다.
- [x] 최초 렌더에서 `activeProjectTabId`만 펼친다.
- [x] 새 활성 프로젝트가 생겼을 때 기존 사용자 토글 상태 처리 규칙을 고정한다.
- [x] 사용자가 직접 접은 프로젝트를 활성화만으로 강제 재오픈하지 않는다.
- [x] 새로 추가된 프로젝트 세션이 활성 상태면 최초 한 번 펼친다.
- [x] 닫힌 프로젝트 세션의 펼침 상태를 정리한다.
- [x] 여러 세션을 동시에 펼칠 수 있게 한다.
- [x] 화살표에 `aria-expanded`와 `aria-controls`를 연결한다.

### 열린 채팅 목록
- [x] 펼친 세션 바로 아래에 해당 세션의 채팅만 표시한다.
- [x] 채팅 행을 제목 선택 영역, 상태, 닫기 버튼 flex 구조로 구현한다.
- [x] 채팅 제목을 말줄임 처리한다.
- [x] active thread 표시를 유지한다.
- [x] running, completed, failed, cancelled 상태 표시를 유지한다.
- [x] unread 표시를 유지한다.
- [x] 채팅 선택 시 소유 프로젝트 세션 활성화 후 채팅을 연다.
- [x] 채팅 닫기 시 해당 `projectTabId`와 `threadId`를 전달한다.
- [x] 채팅 닫기 event 전파를 차단한다.
- [x] 열린 채팅이 없을 때 세션 내부 빈 상태를 표시한다.
- [x] 세션별 새 채팅 버튼을 표시한다.
- [x] 새 채팅 버튼이 해당 프로젝트 세션을 대상으로 동작한다.
- [x] interaction busy 또는 유효하지 않은 프로젝트에서 새 채팅을 비활성화한다.

### 테스트
- [x] 기본 프로젝트 행 렌더 테스트.
- [x] 열린 세션 행 렌더 테스트.
- [x] 동일 프로젝트 복수 세션 DOM 렌더 테스트.
- [x] 활성 세션 최초 펼침 테스트.
- [x] 프로젝트별 독립 펼침 테스트.
- [x] 이름 선택과 화살표 토글 분리 테스트.
- [x] 프로젝트 닫기 대상 ID 테스트.
- [x] 세션별 채팅 격리 렌더 테스트.
- [x] 비활성 세션 채팅 선택 순서 테스트.
- [x] 채팅 닫기 대상 `projectTabId` 테스트.
- [x] 빈 채팅 및 새 채팅 버튼 테스트.

### 완료 조건
- [x] TOML 프로젝트와 열린 세션이 하나의 Projects 평면 목록에 표시된다.
- [x] 복수 세션이 기존 TopTabs와 동일하게 독립적으로 선택·닫기된다.
- [x] 모든 열린 채팅이 올바른 세션 아래에 표시된다.
- [x] 대상 테스트, 전체 test, typecheck, lint, build가 통과한다.

## Stage 4. Threads 단일 접이식 목록

### 진입 조건
- [x] Stage 3 완료.
- [x] 기존 `threadItems` 조회와 순서를 확인한다.
- [x] Always Gate 항목을 확인한다.

### 구조 단순화
- [x] `Recent / Projects` 서브탭 UI를 제거한다.
- [x] Projects 렌더 책임이 Threads 컴포넌트에 남아 있지 않게 한다.
- [x] `Threads` 제목을 disclosure button으로 변경한다.
- [x] Threads 펼침 상태를 단일 boolean 로컬 상태로 관리한다.
- [x] 기본 펼침 상태를 열린 상태로 설정한다.
- [x] 제목에 `aria-expanded`와 목록 `aria-controls`를 연결한다.
- [x] 제목 옆 화살표 방향을 상태와 동기화한다.

### 목록 동작
- [x] 기존 `threadItems`를 서버 응답 순서 그대로 렌더한다.
- [x] 프론트엔드 최신순 재정렬을 추가하지 않는다.
- [x] 현재 활성 프로젝트의 열린 채팅 상태와 일치하는 행을 병합한다.
- [x] 열린 행에만 닫기 버튼을 표시한다.
- [x] active thread, running, completed, failed, cancelled, unread 표시를 유지한다.
- [x] 스레드 선택 시 기존 `viewThread` 동작을 사용한다.
- [x] 빈 목록 메시지를 유지한다.
- [x] 새 채팅 버튼을 유지한다.
- [x] 접힌 상태에서는 목록과 새 채팅 버튼을 숨긴다.

### 정리
- [x] `SidebarThreadSubtabs`가 더 이상 필요하지 않으면 제거한다.
- [x] 일부 목록 렌더 helper가 재사용되면 책임에 맞게 이름을 변경한다.
- [x] `ProjectSessionTabs`와 관련 스타일·테스트를 제거한다.
- [x] `thread-subtab*` 미사용 스타일을 제거한다.
- [x] 삭제된 컴포넌트 import와 props를 제거한다.

### 테스트
- [x] Threads 제목과 기본 펼침 렌더 테스트.
- [x] 접힌 상태에서 목록 숨김 테스트.
- [x] `threadItems` 순서 유지 테스트.
- [x] 열린 탭 상태 병합 테스트.
- [x] 열린 탭이 없는 초기 목록 테스트.
- [x] 닫기 버튼 노출 조건 테스트.
- [x] 빈 상태와 새 채팅 버튼 테스트.

### 완료 조건
- [x] Threads에는 단일 접이식 기존 스레드 목록만 남는다.
- [x] Projects 관련 UI와 상태가 Threads에서 제거된다.
- [x] 기존 스레드 선택과 열린 탭 동작에 회귀가 없다.
- [x] 대상 테스트, 전체 test, typecheck, lint, build가 통과한다.

## Stage 5. 에이전트 설정 팝오버

### 진입 조건
- [x] Stage 4 완료.
- [x] 기존 Enabled Agents, Running Subagents와 설정 카드의 props를 확인한다.
- [x] Always Gate 항목을 확인한다.

### 콘텐츠 이동
- [x] 기본 사이드바 본문에서 `SidebarAgentsPanel` 렌더를 제거한다.
- [x] Enabled Agents 목록을 팝오버 내부로 이동한다.
- [x] Running Subagents 목록을 팝오버 내부로 이동한다.
- [x] agent config error를 팝오버 내부에 표시한다.
- [x] `AgentSettingsCard`를 팝오버 내부로 이동한다.
- [x] Guardian summary와 floating settings 진입 동작을 유지한다.
- [x] 에이전트 활성화·비활성화 동작을 유지한다.
- [x] configurable agent별 설정 버튼 동작을 유지한다.
- [x] 설정 로딩·저장 busy 상태를 유지한다.

### 설정 버튼
- [x] 사이드바 하단 왼쪽에 설정 버튼을 추가한다.
- [x] 기존 `SettingsIcon`을 사용한다.
- [x] 버튼에 텍스트 `Settings` 또는 제품 언어 기준 표시명을 제공한다.
- [x] 버튼에 `aria-expanded`, `aria-controls`, active 상태를 연결한다.
- [x] 사이드바 접힘 상태에서 아이콘 전용 표시를 정의한다.

### 팝오버 shell
- [x] 팝오버를 sidebar DOM 밖의 fixed 레이어로 배치한다.
- [x] 설정 버튼 좌표를 기준으로 팝오버를 버튼 위에 배치한다.
- [x] 팝오버 너비를 300px로 고정하고 좁은 viewport에서는 좌우 8px 여백 안으로 줄인다.
- [x] viewport를 넘지 않는 최대 높이를 적용한다.
- [x] 긴 설정 내용은 팝오버 내부에서 스크롤한다.
- [x] sidebar resize와 펼침·접힘 상태가 팝오버 열림 상태를 변경하지 않게 한다.
- [x] 팝오버가 sidebar resizer와 중앙 콘텐츠 위에 올바르게 표시되도록 z-index를 설정한다.
- [ ] light/dark 테마에서 배경, 테두리와 그림자를 확인한다. (Stage 8 수동 확인)

### 열기·닫기
- [x] 설정 버튼 클릭으로 팝오버를 연다.
- [x] 열린 상태에서 설정 버튼 재클릭으로 닫는다.
- [x] 팝오버 바깥 클릭으로 닫는다.
- [x] `Escape`로 닫는다.
- [x] 팝오버 내부 클릭은 닫기로 처리하지 않는다.
- [x] agent floating settings를 열 때 팝오버 유지 여부를 기존 흐름에 맞게 고정한다.
- [x] 모바일에서 설정을 열면 사이드바만 닫고 설정 팝오버는 유지한다.
- [x] desktop sidebar의 펼침·접힘 상태와 설정 팝오버 상태를 독립적으로 유지한다.
- [x] 컴포넌트 unmount 시 document event listener를 정리한다.

### 접근성
- [x] 팝오버에 의미 있는 label 또는 heading을 제공한다.
- [x] 설정 버튼과 팝오버를 `aria-controls`로 연결한다.
- [x] 키보드로 버튼과 내부 control에 접근 가능하게 한다.
- [x] 닫힌 팝오버 콘텐츠가 tab order에 남지 않게 한다.
- [x] Escape 닫기 후 설정 버튼으로 포커스를 반환한다.

### 테스트
- [x] 설정 버튼 기본 렌더 테스트.
- [x] 버튼 클릭 열기·재클릭 닫기 테스트.
- [x] 바깥 클릭 닫기 테스트.
- [x] Escape 닫기 테스트.
- [x] Enabled Agents와 Running Subagents 렌더 테스트.
- [x] AgentSettingsCard 렌더 테스트.
- [x] 기존 toggle/open/save callbacks 전달 테스트.
- [x] 모바일 sidebar 닫기와 접힘 sidebar 독립 팝오버 테스트.
- [x] 300px 폭, viewport clamp와 버튼 위 위치 계산 테스트.

### 완료 조건
- [x] 에이전트 관련 UI가 기본 사이드바 공간을 차지하지 않는다.
- [x] 모든 기존 에이전트 기능을 설정 팝오버에서 사용할 수 있다.
- [x] 팝오버의 닫기와 포커스 동작이 일관된다.
- [x] 대상 테스트, 전체 test, typecheck, lint, build가 통과한다.

## Stage 6. 사이드바 프레임 및 평면 스타일

### 진입 조건
- [x] Stage 5 완료.
- [x] desktop/mobile/collapsed sidebar 구조를 확인한다.
- [x] Always Gate 항목을 확인한다.

### 상단 헤더
- [x] 기존 `Codex Web` 브랜드를 유지한다.
- [x] 알림 toggle을 유지한다.
- [x] 테마 toggle을 유지한다.
- [x] 접기 버튼을 상단 오른쪽 action 영역으로 이동한다.
- [x] action 버튼 간격과 hit area를 통일한다.
- [x] 모바일에서는 접기 버튼이 사이드바 닫기로 동작한다.

### 접기 아이콘
- [x] 분할 패널 형태의 새 SVG icon 컴포넌트를 추가한다.
- [x] 참고 이미지처럼 외곽 사각형과 왼쪽 분할선을 표현한다.
- [x] 펼침·접힘 상태를 색상 또는 방향 변화로 구분한다.
- [x] 16px 전후 크기에서도 선이 뭉개지지 않게 stroke를 조정한다.
- [x] `aria-hidden` SVG와 button label을 분리한다.
- [x] 기존 `SidebarChevronIcon` 사용처를 정리한다.

### collapsed 구조
- [x] desktop 접힘 상태에서도 상단 접기 버튼을 렌더한다.
- [x] 접힘 상태에서 불필요한 sidebar 본문을 렌더하지 않는다.
- [x] 접힘 폭에서 버튼이 잘리지 않게 한다.
- [x] 설정 버튼의 접힘 상태 표시 여부를 기준 문서와 일치시킨다.
- [x] sidebar resizer의 기존 동작을 유지한다.
- [x] collapsed resizer placeholder 동작을 유지한다.

### 하단 footer
- [x] 설정 버튼을 하단 왼쪽에 고정한다.
- [x] 기존 하단 접기 버튼 markup과 스타일을 제거한다.
- [x] footer가 본문 스크롤과 분리되게 한다.
- [x] 설정 팝오버 anchor가 footer 위치를 기준으로 동작하게 한다.

### 평면 목록 스타일
- [x] Projects와 Threads의 Panel 카드 배경을 제거한다.
- [x] 외곽 테두리, radius와 그림자를 제거한다.
- [x] 섹션 간 간격으로 정보 구조를 구분한다.
- [x] 필요하지 않은 Panel padding 중첩을 제거한다.
- [x] 프로젝트, 세션, 채팅, 스레드의 들여쓰기 수준을 고정한다.
- [x] hover와 active 배경을 참고 이미지처럼 낮은 대비로 적용한다.
- [x] 상태와 닫기 버튼이 hover 전후에 레이아웃을 움직이지 않게 한다.
- [ ] 긴 제목과 좁은 sidebar에서 overflow를 확인한다. (Stage 8 수동 확인)

### 반응형
- [x] 900px 이하에서 sidebar overlay 동작을 유지한다.
- [x] backdrop 클릭 닫기를 유지한다.
- [x] 모바일에서 상단 접기 버튼 label을 확인한다.
- [ ] 설정 팝오버가 viewport 밖으로 벗어나지 않게 한다. (Stage 8 수동 확인)
- [x] sidebar resize min/max 범위를 유지한다.

### 테스트
- [x] 상단 브랜드·알림·테마·접기 버튼 렌더 테스트.
- [x] desktop 접기/펼치기 callback 테스트.
- [x] mobile 닫기 callback 테스트.
- [x] 하단 설정 버튼 렌더 테스트.
- [x] 기존 footer 접기 버튼 미렌더 테스트.
- [x] collapsed 상태 shell 테스트.

### 완료 조건
- [x] 사이드바 상단과 하단 액션 배치가 기준 문서와 일치한다.
- [x] Projects와 Threads가 평면 목록 시각 체계를 사용한다.
- [x] desktop/mobile/collapsed 동작에 회귀가 없다.
- [x] 대상 테스트, 전체 test, typecheck, lint, build가 통과한다.

## Stage 7. Workspace 패널 시각 체계 통일

### 진입 조건
- [x] Stage 6 완료.
- [x] Workspace desktop/compact 레이아웃과 resize 구현을 확인한다.
- [x] Always Gate 항목을 확인한다.

### 변경 금지 동작
- [x] Workspace 패널 위치를 변경하지 않는다.
- [x] composer의 Workspace toggle 동작을 변경하지 않는다.
- [x] desktop 너비 조절을 제거하지 않는다.
- [x] compact layout 표시 방식을 변경하지 않는다.
- [x] 파일·디렉터리 선택 동작을 변경하지 않는다.
- [x] 파일 미리보기와 크기 조절 동작을 변경하지 않는다.
- [x] 경로 복사 단축키를 변경하지 않는다.
- [x] git status badge 의미를 변경하지 않는다.

### 패널 shell
- [x] Workspace 배경을 sidebar와 동일한 surface token으로 조정한다.
- [x] 외곽 테두리와 그림자 강도를 sidebar 기준으로 조정한다.
- [x] desktop 상단 margin과 높이 계산은 유지한다.
- [x] compact/desktop class 구조는 유지한다.
- [x] workspace resizer 폭과 cursor를 유지한다.
- [x] resizer hover/active 색상만 새 시각 체계에 맞춘다.

### 헤더
- [x] Workspace 제목 typography를 sidebar 섹션 제목과 통일한다.
- [x] root path subtitle을 읽기 쉬운 크기와 색상으로 조정한다.
- [x] refresh 버튼을 sidebar icon button과 같은 hit area로 맞춘다.
- [x] 헤더 높이와 padding을 sidebar header rhythm에 맞춘다.
- [x] 긴 root path 줄바꿈과 overflow를 확인한다.

### 파일 트리
- [x] 파일/디렉터리 행 높이를 sidebar 목록 행과 맞춘다.
- [x] 좌우 padding과 icon gap을 통일한다.
- [x] hover 배경을 sidebar hover와 통일한다.
- [x] selected 배경과 텍스트를 sidebar active와 통일한다.
- [x] caret, folder, file icon 크기와 색상을 통일한다.
- [x] depth별 padding 계산은 유지한다.
- [x] compact directory label 동작을 유지한다.
- [x] 트리의 가로·세로 overflow를 유지한다.
- [x] Deleted 그룹 구분을 새 스타일과 맞춘다.
- [x] status badge 크기와 배경을 새 스타일에 맞춘다.
- [x] status별 의미 색상을 유지한다.

### 테마와 반응형
- [ ] light theme에서 sidebar와 Workspace surface가 일치하는지 확인한다. (Stage 8 수동 확인)
- [ ] dark theme에서 sidebar와 Workspace surface가 일치하는지 확인한다. (Stage 8 수동 확인)
- [ ] compact Workspace에서 header/tree가 잘리지 않는지 확인한다. (Stage 8 수동 확인)
- [ ] resize 후 tree와 preview가 정상 재배치되는지 확인한다. (Stage 8 수동 확인)
- [ ] 최소·최대 Workspace 너비에서 제목과 행 overflow를 확인한다. (Stage 8 수동 확인)

### 테스트
- [x] Workspace header 기존 callback 테스트 유지.
- [x] directory 펼침과 파일 선택 테스트 유지.
- [x] status badge와 deleted entry 테스트 유지.
- [x] layout selector의 desktop width 테스트 유지.
- [x] compact layout style 테스트 유지.
- [x] resize 관련 회귀 테스트를 실행한다.

### 완료 조건
- [x] Workspace 기능과 resize 동작이 변경되지 않는다.
- [x] Workspace 패널이 sidebar와 동일한 시각 언어를 사용한다.
- [ ] light/dark와 compact/desktop 조합에서 레이아웃이 안정적이다. (Stage 8 수동 확인)
- [x] 대상 테스트, 전체 test, typecheck, lint, build가 통과한다.

## Stage 8. 정리 및 통합 회귀

### 진입 조건
- [ ] Stage 1~7 완료.
- [x] 모든 진행 로그 entry의 next step을 확인한다.
- [x] Always Gate 항목을 확인한다.

### 미사용 코드 정리
- [x] 제거된 `Recent / Projects` 탭 컴포넌트를 검색한다.
- [x] 제거된 project dropdown 임시 구현을 검색한다.
- [x] 사용하지 않는 props와 callback wrapper를 제거한다.
- [x] 사용하지 않는 context field를 제거한다.
- [x] 사용하지 않는 CSS selector를 제거한다.
- [x] 기존 sidebar footer 접기 스타일을 제거한다.
- [x] 기존 project/thread tab chip 스타일 잔여물을 제거한다.
- [x] 삭제된 테스트 import와 fixture field를 제거한다.
- [x] production 코드의 debug markup과 console 출력을 확인한다.

### 타입과 인터페이스
- [x] sidebar domain/runtime/presentation 타입을 실제 props와 대조한다.
- [x] project row view-model 타입에서 `unknown` 사용을 최소화한다.
- [x] 프로젝트별 채팅 액션 signature를 문서와 대조한다.
- [x] 기존 public backend interface가 변경되지 않았는지 diff를 확인한다.
- [x] 프로젝트/스레드 fallback 로직이 domain hook에 남아 있는지 확인한다.

### 자동 검증
- [x] `cd web/frontend && npm test`
- [x] 모든 frontend 테스트 통과 수를 기록한다.
- [x] `cd web/frontend && npx tsc -p . --noEmit`
- [x] TypeScript 오류 0건을 확인한다.
- [x] `cd web/frontend && npm run lint`
- [x] lint 오류 0건을 확인한다.
- [x] 기존 경고 수가 증가하지 않았는지 확인한다.
- [x] `cd web/frontend && npm run build`
- [x] production build 성공과 output 위치를 확인한다.
- [x] repository root에서 관련 Python/web 테스트 필요 여부를 검토한다. (Python 3.14 전체 pytest는 실행 도구가 반복 중단해 미완료)
- [x] `git diff --check`

### 수동 시나리오: Projects
- [ ] TOML 프로젝트 전체가 설정 순서로 표시된다.
- [ ] 열리지 않은 프로젝트가 기본 행으로 표시된다.
- [ ] 프로젝트 선택 모달의 기존 동작이 유지된다.
- [ ] 프로젝트가 열리면 기본 행이 세션 행으로 대체된다.
- [ ] 동일 프로젝트를 여러 세션으로 열면 독립 행이 생성된다.
- [ ] 각 세션의 채팅 목록이 다른 세션과 섞이지 않는다.
- [ ] 여러 프로젝트 세션을 동시에 펼칠 수 있다.
- [ ] 프로젝트 이름 선택과 화살표 토글이 독립적으로 동작한다.
- [ ] 프로젝트 세션 닫기와 fallback이 정상 동작한다.
- [ ] 비활성 프로젝트의 채팅을 선택하면 올바른 프로젝트와 채팅이 활성화된다.
- [ ] 비활성 프로젝트의 채팅 닫기가 다른 세션에 영향을 주지 않는다.
- [ ] 프로젝트별 새 채팅 생성이 올바른 세션에 추가된다.
- [ ] running/unread/failed/cancelled 상태가 올바르게 표시된다.

### 수동 시나리오: Threads
- [ ] Threads가 단일 접이식 목록으로 표시된다.
- [ ] 기존 스레드 목록 순서가 유지된다.
- [ ] 접기·펼치기가 정상 동작한다.
- [ ] 스레드 선택 시 기존 메시지가 로드된다.
- [ ] 열린 스레드의 상태와 닫기 버튼이 표시된다.
- [ ] 새 채팅 버튼이 정상 동작한다.

### 수동 시나리오: 설정
- [ ] 하단 설정 버튼으로 팝오버가 열린다.
- [ ] 재클릭, 바깥 클릭과 Escape로 닫힌다.
- [ ] Enabled Agents를 활성화·비활성화할 수 있다.
- [ ] configurable agent 설정을 열 수 있다.
- [ ] 설정 저장과 새로고침이 정상 동작한다.
- [ ] Running Subagents가 표시된다.
- [ ] Guardian 설정과 floating panel 동작이 유지된다.
- [ ] desktop sidebar 접힘과 독립적으로 팝오버가 유지되고, 모바일에서는 sidebar만 닫힌다.

### 수동 시나리오: 레이아웃과 Workspace
- [ ] 상단 접기 아이콘으로 desktop sidebar를 접고 펼칠 수 있다.
- [ ] 모바일 sidebar를 정상적으로 닫을 수 있다.
- [ ] sidebar 폭 조절이 유지된다.
- [ ] Workspace 패널을 열고 닫을 수 있다.
- [ ] Workspace 패널 너비 조절이 유지된다.
- [ ] 디렉터리 펼침과 파일 미리보기가 정상 동작한다.
- [ ] 파일 경로 복사 단축키가 유지된다.
- [ ] Workspace status badge가 정상 표시된다.
- [ ] light/dark theme에서 시각 체계가 일관된다.
- [ ] 900px 이하와 일반 desktop 너비에서 레이아웃이 깨지지 않는다.

### 문서와 운영 영향
- [x] 기준 UI redesign 문서와 최종 구현을 대조한다.
- [x] `docs/web-rearchitecture-log.md`에 최종 validation을 기록한다.
- [x] API/SSE/config migration이 없음을 기록한다.
- [x] 남은 lint 경고와 수동 확인 제한을 기록한다.
- [ ] UI 변경 스크린샷 또는 GIF 준비 여부를 확인한다.

### 완료 조건
- [ ] 기준 UI redesign 문서의 완료 기준을 모두 충족한다.
- [ ] 자동 검증이 모두 통과한다.
- [ ] 핵심 수동 시나리오가 모두 통과한다.
- [ ] 미사용 코드와 임시 구현이 남아 있지 않다.
- [ ] 문서와 코드가 일치한다.
- [ ] handoff 작성이 가능한 상태다.

## Interfaces

### 변경하는 frontend 내부 계약
- [x] sidebar context가 전체 `threadTabsByProjectTabId`를 제공한다.
- [x] 프로젝트 세션 채팅 액션이 `projectTabId`를 명시적으로 받는다.
- [x] Projects UI는 정규화된 project row view-model을 소비한다.
- [x] 설정 팝오버는 기존 agent props와 callback을 그대로 소비한다.

### 변경하지 않는 외부 계약
- [x] `/api/projects`와 `/api/projects/select` 계약 유지.
- [x] `/api/projects/open-thread` 계약 유지.
- [x] `/api/threads/*` 계약 유지.
- [x] Workspace API 계약 유지.
- [x] SSE 이벤트 계약 유지.
- [x] 인증과 session contract 유지.
- [x] `conf.toml` project profile 형식 유지.

## Handoff Template

```text
[Handoff]
Objective:
Scope completed:
Files changed:
Validation run:
Risks / open questions:
Recommended next step:
```

## Assumptions
- 기준 UI redesign 문서는 설계 기준이고 본 문서는 실행 상태 기준이다.
- 모든 체크 항목은 미완료 상태에서 시작한다.
- Stage는 순서대로 진행하며 이전 Stage의 완료 조건을 충족하기 전 다음 Stage를 시작하지 않는다.
- 프로젝트와 Threads 펼침 상태, 설정 팝오버 상태는 frontend 로컬 상태로 관리하고 저장하지 않는다.
- 동일 프로젝트 복수 세션 기능과 기존 프로젝트 선택 모드는 유지한다.
- 외부 UI 라이브러리를 추가하지 않는다.
