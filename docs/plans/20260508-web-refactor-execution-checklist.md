# Web Refactor Execution Checklist (Codex Style)

작성일: 2026-05-08
대상: Web UI 전체(frontend 재구성)
범위: 기존 설계 문서와 분리된 실행 체크 중심 관리 문서(상시 게이트 적용)

## Summary
- 목적: 구조 재구성을 설계 설명이 아닌 완료 체크 기준으로 운영한다.
- 원칙: 백엔드 API/SSE 계약은 유지하고, frontend 내부 구조/재사용성만 개선한다.
- 방식: Stage 0를 별도 단계로 두지 않고 상시 게이트를 모든 단계에 적용한다.

## Key Changes

### Always Gate. 상시 적용 기준
- [x] 문서/인코딩 UTF-8 정상 유지
- [x] 회귀 기준 고정(`projectTabThreads`, `turnCompletion`, `workspaceRefresh`)
- [x] 변경 금지선 고정(API/SSE/세션/무관 리팩터링 금지)
- [x] 변경 단위마다 `npm test` + `npm run build` 통과 확인

### Stage 1. 구조 뼈대 분리
- [x] `app`/`features`/`shared` 책임 분리 규칙 문서화
- [x] bootstrap/app shell 분리
- [x] 공통 API 클라이언트 분리
- [x] SSE 수신 단일 라우터 진입점 분리
- [x] 기존 import 호환 레이어 유지 확인

현재 상태 vs Stage 1 종료 상태

| 항목 | 현재 상태(이전) | Stage 1 종료 상태 |
| --- | --- | --- |
| App 책임 | `App.jsx`에 세션/테마/렌더 진입점 집중 | `app/bootstrap` + `app/AppShell`로 분리, `App.jsx`는 호환 레이어 |
| API 구현 위치 | `features/common/api.js` 단일 파일에 구현 | `shared/api/httpClient.js`로 이동, `features/common/api.js` 재export |
| SSE 연결점 | `AuthenticatedApp` 내부에서 직접 `EventSource` 생성/해제 | `shared/events/sseStream.js` 진입점 단일화, 핸들러 로직은 기존 유지 |

진입 조건
- [x] Always Gate 항목 유지

완료 조건
- [x] 앱 동작 동일
- [x] 빌드/테스트 통과

### Stage 2. 상태 도메인 최소 분리
- [x] `session` 상태 분리
- [x] `threads` 상태 분리
- [x] `workspace` 상태 분리
- [x] `ui` 상태 분리
- [x] 상태 변경 action 경유 규칙 적용

진입 조건
- [x] Stage 1 완료
- [x] Always Gate 항목 유지

완료 조건
- [x] 탭/스레드 전환 회귀 없음
- [x] workspace 상태 반영 회귀 없음
- [x] 빌드/테스트 통과

### Stage 3. AuthenticatedApp 해체
- [x] 컨테이너 책임 분리(데이터 로드/이벤트/액션 호출)
- [x] 프리젠터 책임 분리(렌더 전담)
- [x] approval 흐름 feature 모듈 분리
- [x] 기존 유틸/훅 참조 경로 정리

진입 조건
- [x] Stage 2 완료
- [x] Always Gate 항목 유지

완료 조건
- [x] 메시지 송신/중단 정상
- [x] turn 완료/오류/중단 이벤트 처리 정상
- [x] 빌드/테스트 통과

### Stage 3.1. 상호작용 흐름 모듈화
- [x] thread/session/turn 상호작용 흐름의 훅 모듈화 적용
- [x] viewport/resize/keyboard 상호작용 흐름의 훅 모듈화 적용
- [x] 컨테이너는 훅 조립 중심 구조로 정리
- [x] 기존 동작/계약(API/SSE/세션) 유지 확인

진입 조건
- [x] Stage 3 완료
- [x] Always Gate 항목 유지

완료 조건
- [x] 메시지 송신/중단 정상
- [x] turn 완료/오류/중단 이벤트 처리 정상
- [x] 빌드/테스트 통과

### Stage 3.2. UI 적용 전 구조 안정화
- [x] 오버레이 렌더 경계 분리 적용
- [x] 사이드바/센터/컴포저 렌더 조합 경계 분리 적용
- [x] composer palette/입력 이벤트 흐름 모듈화 적용
- [x] UI Kit 적용 전 컨테이너 구조 안정화 확인

진입 조건
- [x] Stage 3.1 완료
- [x] Always Gate 항목 유지

완료 조건
- [x] 주요 UI 회귀 없음
- [x] 빌드/테스트 통과

### Stage 3.3. 도메인 경계 재정렬
- [x] agent 설정 흐름 도메인 훅 분리 적용
- [x] turn/reasoning 메시지 mutation 도메인 분리 적용
- [x] effect orchestration 목적별 훅 분리 적용
- [x] message command 액션 도메인 훅 분리 적용
- [x] 컨테이너 책임 재정렬 후 동작/계약 유지 확인

진입 조건
- [x] Stage 3.2 완료
- [x] Always Gate 항목 유지

완료 조건
- [x] 주요 UI 회귀 없음
- [x] 빌드/테스트 통과

### Stage 3.4. 프리젠테이션 경계 고도화
- [x] workspace 트리 계산 로직 도메인 모델 분리 적용
- [x] workspace 패널 렌더 블록 presenter 분리 적용
- [x] app UI side-effect 흐름 훅 분리 적용
- [x] 컨테이너 책임 축소 후 기존 동작/계약 유지 확인

진입 조건
- [x] Stage 3.3 완료
- [x] Always Gate 항목 유지

완료 조건
- [x] 주요 UI 회귀 없음
- [x] 빌드/테스트 통과

### Stage 4. UI Kit 재사용성 강화
- [ ] 1차 UI Kit 컴포넌트 적용(`Button`, `IconButton`, `Input`, `Textarea`, `Modal`, `Tabs`, `Toast`, `Badge`, `Panel`)
- [ ] 디자인 토큰(CSS 변수) 정의(color/spacing/radius/typography/layer/motion)
- [ ] 중복 스타일 치환
- [ ] 컴포넌트 사용 규칙 문서화

진입 조건
- [x] Stage 3.4 완료
- [x] Always Gate 항목 유지

완료 조건
- [ ] 주요 화면 UI 회귀 없음
- [ ] 키보드/포커스/접근성 기본 요건 통과
- [x] 빌드/테스트 통과

### Stage 5. 정리/종결
- [ ] 미사용 코드 제거
- [ ] 호환 레이어 제거 여부 검토 및 적용
- [ ] 폴더 책임/의존 방향 문서 최종화
- [ ] 최종 회귀 점검 완료

진입 조건
- [ ] Stage 4 완료
- [x] Always Gate 항목 유지

완료 조건
- [ ] 전체 시나리오 점검 통과
- [ ] 문서/코드 일치
- [ ] 종료 보고 가능 상태

## Interfaces
- 고정 체크
  - [x] `/api/*` 계약 변경 없음
  - [x] SSE 이벤트 타입/의미 변경 없음
  - [x] 인증 쿠키/세션 흐름 변경 없음

## Test Plan
- 공통 게이트
  - [x] `web/frontend/src` 변경마다 `npm run build` 통과
  - [x] 단계 종료마다 `npm test` 통과
- 회귀 게이트
  - [x] `projectTabThreads` 테스트 통과
  - [x] `turnCompletion` 테스트 통과
  - [x] `workspaceRefresh` 테스트 통과
- 시나리오 게이트
  - [ ] 로그인 → 프로젝트/스레드 선택 → 메시지 송신/중단 → turn 완료 반영
  - [ ] approval 처리 반영 확인
  - [ ] workspace tree/preview 반영 확인

## Assumptions
- 기존 계획 문서는 설계 기준, 본 문서는 실행 체크 기준으로 분리 운영한다.
- 구현 중 신규 요구가 생겨도 단계 게이트 통과 전 범위 확장은 하지 않는다.
- 외부 UI 라이브러리 도입 없이 내부 UI Kit 중심으로 진행한다.
