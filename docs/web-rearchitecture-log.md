# Progress Updates

Purpose: periodic implementation log for in-progress work.

Rule:
- Write updates in this file under `docs/` (not `docs/plans/`).
- Append new entries in reverse chronological order (latest first).

## Entry Template
```
## YYYY-MM-DD HH:MM (local)
- Objective:
- Files changed:
  - path/to/file
- Changes:
  - ...
- Validation:
  - command/result
- Next step:
  - ...
```

## 2026-05-26 17:19 (local)
- Objective:
  - `AuthenticatedAppContainer` 추가 분리: workspace 패널 경계와 UI effect 경계를 도메인 단위로 재정렬.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/app/hooks/useAppUiEffects.ts
  - web/frontend/src/features/workspace/components/WorkspacePanel.tsx
  - web/frontend/src/features/workspace/workspaceTreeModel.ts
- Changes:
  - workspace 트리 표시용 계산/가공 로직을 `workspaceTreeModel`로 이동해 컨테이너에서 도메인 계산 책임을 축소.
  - workspace 렌더 블록을 `WorkspacePanel`로 분리해 presenter 경계를 명확화.
  - 앱 레벨 UI side-effect를 `useAppUiEffects`로 분리해 컨테이너의 effect 밀도를 완화.
- Validation:
  - `cd web/frontend && npx tsc -p . --noEmit` 통과.
  - `cd web/frontend && npm run lint` 통과 (0 errors, warnings only).
  - `cd web/frontend && npm test -- --runInBand` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - 남은 대형 렌더 블록을 도메인 presenter로 순차 분리해 UI Kit 적용 전 컨테이너 길이를 추가 축소.

## 2026-05-26 15:35 (local)
- Objective:
  - `AuthenticatedAppContainer` 추가 분리 1~4단계(도메인 훅/메시지 mutation/effect orchestration/메시지 액션) 적용.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/app/hooks/useAgentConfigDomain.ts
  - web/frontend/src/features/app/hooks/useTurnMessageMutations.ts
  - web/frontend/src/features/app/hooks/useChatScrollEffects.ts
  - web/frontend/src/features/app/hooks/useComposerFocusEffects.ts
  - web/frontend/src/features/app/hooks/usePaletteEffects.ts
  - web/frontend/src/features/app/hooks/useThreadBootstrapEffects.ts
  - web/frontend/src/features/app/hooks/useMessageCommandActions.ts
- Changes:
  - agent 설정 흐름(`load/toggle/open/save`)을 `useAgentConfigDomain`으로 이동해 컨테이너의 설정 도메인 책임을 축소.
  - plan/reasoning 메시지 mutation 로직을 `useTurnMessageMutations`로 이동.
  - 컨테이너 useEffect 군을 목적별 훅(`chat scroll`, `composer focus`, `palette`, `thread bootstrap`)으로 분리.
  - 메시지 액션(`sendMessage`, `toggleComposerMode`, `interrupt`, `focus`, `selection`, `palette apply`)을 `useMessageCommandActions`로 이동.
- Validation:
  - `cd web/frontend && npm run lint` 통과 (0 errors, 47 warnings).
  - `cd web/frontend && npm test -- --runInBand` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - 분리된 훅별 단위 테스트 보강 여부 결정 및 필요 시 추가.

## 2026-05-26 14:50 (local)
- Objective:
  - TopTabs+Center 조합 분리 및 Composer 분리 1~3단계(렌더/팔레트/키입력) 반영.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/app/components/AppCenterPanePresenter.tsx
  - web/frontend/src/features/app/components/AppComposerPresenter.tsx
  - web/frontend/src/features/app/hooks/useComposerPalette.ts
  - web/frontend/src/features/app/hooks/useComposerInputHandlers.ts
- Changes:
  - `TopTabs + workspace-layout + center-pane` 조합을 `AppCenterPanePresenter`로 추출해 컨테이너의 레이아웃 JSX를 축소.
  - composer 렌더 블록을 `AppComposerPresenter`로 추출하고, 기존 상태/핸들러는 주입 방식으로 유지.
  - palette 계산(`activeToken/paletteItems/visiblePaletteItems`)을 `useComposerPalette` 훅으로 이동.
  - textarea 입력 이벤트 분기(모드 토글, palette 탐색/적용, 히스토리 탐색, Enter/Shift+Enter 처리)를 `useComposerInputHandlers` 훅으로 이동.
- Validation:
  - `cd web/frontend && npm run lint` 통과 (0 errors, 52 warnings).
  - `cd web/frontend && npm test -- --runInBand` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - composer focus/selection 관련 effect를 별도 훅으로 추가 분리할지, 현재 수준에서 UI Kit 적용으로 넘어갈지 결정.

## 2026-05-26 14:25 (local)
- Objective:
  - UI Kit 전 컨테이너 분리 2차: 사이드바 콘텐츠 패널을 별도 presenter로 추출.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/app/components/AppSidebarContentPanel.tsx
- Changes:
  - 에이전트/프로젝트/스레드 목록과 상단 토글(알림/테마)을 `AppSidebarContentPanel`로 이동.
  - 컨테이너는 사이드바 데이터/액션 주입과 레이아웃 셸 유지 역할로 축소.
- Validation:
  - `cd web/frontend && npm run lint` 통과 (0 errors, 52 warnings).
  - `cd web/frontend && npm test -- --runInBand` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - 다음 소배치로 composer 블록 또는 top tabs + center pane 조합 영역 분리.

## 2026-05-26 14:05 (local)
- Objective:
  - UI Kit 적용 전 소배치 분리: `AuthenticatedAppContainer`에서 독립 오버레이 렌더 블록 추출.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/app/components/FloatingGuardianSettingsPanel.tsx
  - web/frontend/src/features/app/components/WorkspacePreviewOverlay.tsx
- Changes:
  - Guardian 규칙 편집 플로팅 패널 렌더를 `FloatingGuardianSettingsPanel`로 분리하고 기존 상태/핸들러를 주입 방식으로 유지.
  - Workspace preview backdrop/panel 렌더 및 리사이즈 시작 이벤트를 `WorkspacePreviewOverlay`로 분리.
  - 컨테이너는 도메인 상태/행동 소유를 유지하고, 렌더 조합 책임만 축소.
- Validation:
  - `cd web/frontend && npm run lint` 통과 (0 errors, 52 warnings).
  - `cd web/frontend && npm test -- --runInBand` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - 다음 소배치로 sidebar content 또는 composer 블록을 presenter 컴포넌트로 추가 분리.

## 2026-05-11 14:55 (local)
- Objective:
  - Stage 4 4차 분해: 키보드/레이아웃/리사이즈 effect를 3개 훅으로 분리.
- Files changed:
  - web/frontend/src/features/app/hooks/useViewportLayout.ts
  - web/frontend/src/features/app/hooks/useViewportLayout.types.ts
  - web/frontend/src/features/app/hooks/useResizeInteractions.ts
  - web/frontend/src/features/app/hooks/useResizeInteractions.types.ts
  - web/frontend/src/features/app/hooks/useGlobalKeyboardShortcuts.ts
  - web/frontend/src/features/app/hooks/useGlobalKeyboardShortcuts.types.ts
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
- Changes:
  - viewport/mobile/layout 동기화와 sidebar/body overflow 제어를 `useViewportLayout`로 이동.
  - sidebar/workspace panel/workspace preview 리사이즈 및 preview size persist/reset을 `useResizeInteractions`로 이동.
  - 전역 단축키와 project picker modal 키 이벤트를 `useGlobalKeyboardShortcuts`로 이동.
  - 컨테이너는 훅 호출/의존성 주입 형태로 정리하고 기존 동작 로직은 유지.
- Validation:
  - `cd web/frontend && npx tsc -p . --noEmit` 통과.
  - `cd web/frontend && npm run lint` 통과 (0 errors, warnings only).
  - `cd web/frontend && npm test -- --runInBand` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - hook dependency warnings(exhaustive-deps) 단계적 정리 또는 현 상태 유지 결정.

## 2026-05-08 17:05 (local)
- Objective:
  - Stage 4 3차 분해: SSE/turn 이벤트 처리 흐름을 `useTurnSession` 훅으로 추출.
- Files changed:
  - web/frontend/src/features/app/hooks/useTurnSession.ts
  - web/frontend/src/features/app/hooks/useTurnSession.types.ts
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
- Changes:
  - 컨테이너의 대형 SSE `useEffect` 블록을 `useTurnSession`으로 이동하고, 기존 상태/액션/ref를 의존성 주입 방식으로 연결.
  - `turn_delta/turn_started/turn_completed/turn_failed/turn_cancelled`, `plan_*`, `reasoning_*`, `approval_required`, `file_change`, `app_event` 처리 로직을 훅으로 이관.
  - 컨테이너에서는 `useTurnSession({...})` 호출만 남기고, 불필요 import를 정리.
- Validation:
  - `cd web/frontend && npx tsc -p . --noEmit` 통과.
  - `cd web/frontend && npm run lint` 통과 (0 errors, warnings only).
  - `cd web/frontend && npm test -- --runInBand` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - 4차 분해 대상으로 키보드/레이아웃/리사이즈 effect 군을 도메인별 훅으로 추가 분리 검토.

## 2026-05-08 16:36 (local)
- Objective:
  - Stage 4 2차 분해: thread 세션 흐름 전체를 `useThreadSession`으로 추출.
- Files changed:
  - web/frontend/src/features/app/hooks/useThreadSession.ts
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
- Changes:
  - `loadThreads/loadProjects/loadSessionSummary/resolveCurrentThreadId/syncThreadMessagesFromServer/startThread/selectProject/viewThread/runCommand`를 `useThreadSession`으로 이동.
  - 컨테이너는 thread 세션 훅 반환 액션을 조립해 사용하는 구조로 변경.
  - `normalizeCollaborationMode`는 컨테이너 함수 선언으로 유지해 session 훅에 주입.
- Validation:
  - `cd web/frontend && npx tsc -p . --noEmit` 통과.
  - `cd web/frontend && npm run lint` 통과 (0 errors, warnings only).
  - `cd web/frontend && npm test` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - 3차 분해로 SSE/turn 이벤트 처리 흐름을 `useTurnSession`으로 추출.

## 2026-05-08 16:01 (local)
- Objective:
  - Stage 4 선행 작업으로 `AuthenticatedAppContainer`의 project/thread tab 도메인 로직 1차 분리.
- Files changed:
  - web/frontend/src/features/app/hooks/useProjectThreadTabs.ts
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
- Changes:
  - project tab upsert/active thread 전환/thread tab open/update/close project tab 책임을 `useProjectThreadTabs` 훅으로 추출.
  - 컨테이너는 해당 도메인 훅을 조립해 사용하도록 변경.
  - 동작 회귀 리스크가 큰 SSE/turn 처리 로직은 이번 단계에서 유지.
- Validation:
  - `cd web/frontend && npx tsc -p . --noEmit` 통과.
  - `cd web/frontend && npm run lint` 통과 (0 errors, warnings only).
  - `cd web/frontend && npm test` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - 2차 분해로 thread load/view/start/select 흐름을 별도 세션 훅으로 추출.

## 2026-05-08 15:45 (local)
- Objective:
  - workspace 훅의 타입 선언 분리.
- Files changed:
  - web/frontend/src/features/workspace/types.ts
  - web/frontend/src/features/workspace/hooks/useWorkspaceBrowser.ts
- Changes:
  - `useWorkspaceBrowser.ts` 내부 타입 alias를 `features/workspace/types.ts`로 이동.
  - 훅 파일은 분리된 타입을 import 하도록 정리.
- Validation:
  - `cd web/frontend && npx tsc -p . --noEmit` 통과.
- Next step:
  - 필요 시 다른 도메인 훅도 동일 방식으로 타입 선언 파일 분리.

## 2026-05-08 15:37 (local)
- Objective:
  - THREADS 세션 `Failed to fetch` 회귀 의심 구간의 동작 안정화 복구.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/thread/hooks/useThreadScopedState.ts
- Changes:
  - SSE effect dependency 확장을 원복하여 렌더 시 재연결 가능성 제거.
  - `useThreadScopedState`의 `threadUiByThreadId` dependency 추가를 원복하여 상태 동기화 부작용 가능성 최소화.
  - 단계 주석(`Stage 1 TS migration note`) 제거.
- Validation:
  - `cd web/frontend && npx tsc -p . --noEmit` 통과.
  - `cd web/frontend && npm run lint` 통과 (0 errors, 49 warnings).
  - `cd web/frontend && npm test` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - 실제 브라우저에서 THREADS 진입 시 네트워크 탭으로 실패 endpoint를 확인해 잔여 문제 여부 확정.

## 2026-05-08 15:32 (local)
- Objective:
  - 타입 정밀화(레드 에러 해소) 및 핵심 Hook 경고 완화.
- Files changed:
  - web/frontend/src/features/workspace/hooks/useWorkspaceBrowser.ts
  - web/frontend/src/features/thread/hooks/useThreadScopedState.ts
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
- Changes:
  - `useWorkspaceBrowser`에 최소 옵션/응답 타입(alias) 추가로 `TS2339` red error 제거.
  - `useThreadScopedState`의 effect dependency 누락 1건 보정.
  - `AuthenticatedAppContainer`에서 `showToast`, `debugLog`, `debugError`를 안정화하고 `workspaceStatusItems`를 `useMemo`로 분리.
  - 대형 SSE bootstrap effect는 동작 변경 리스크를 피하기 위해 의도적 제한 의존성 전략을 코드 주석으로 명시.
- Validation:
  - `cd web/frontend && npx tsc -p . --noEmit` 통과.
  - `cd web/frontend && npm run lint` 통과 (0 errors, 48 warnings).
  - `cd web/frontend && npm test` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - 잔여 `react-hooks/exhaustive-deps` 경고를 effect 군별로 분리/메모화해 단계적으로 축소.

## 2026-05-08 15:21 (local)
- Objective:
  - `AuthenticatedAppContainer.tsx` TypeScript 빨간 에러(Severity 8)만 우선 해소.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/vite-env.d.ts
- Changes:
  - `window.__CODEX_WEB_DEBUG__`, `window.webkitAudioContext` 전역 타입 선언 추가.
  - `options = {}` 패턴 함수들에 최소 옵션 타입을 부여해 `{}` property access 에러 제거.
  - `ApprovalStack` 호출에 누락된 `onClose` prop 전달.
  - `KeyboardEvent`의 `isComposing` 접근을 `e.nativeEvent.isComposing`으로 변경.
- Validation:
  - `cd web/frontend && npx tsc -p . --noEmit` 재실행 결과, `AuthenticatedAppContainer.tsx` 관련 빨간 에러는 사라짐.
  - 남은 에러는 `useWorkspaceBrowser.ts`, `workspaceRefresh.test.ts`의 기존 타입 이슈.
- Next step:
  - 요청 시 `workspace` 도메인 TS 빨간 에러만 동일 방식으로 최소 수정.

## 2026-05-08 15:19 (local)
- Objective:
  - TypeScript CSS side-effect import 에러 해소.
- Files changed:
  - web/frontend/src/vite-env.d.ts
- Changes:
  - `vite/client` 참조와 `declare module "*.css"` 선언을 추가해 `import "./styles.css"` 타입 해석 문제를 해결.
- Validation:
  - `cd web/frontend && npx tsc -p . --noEmit` 실행 시 CSS 관련 모듈 에러는 재발하지 않음.
  - 현재는 다른 기존 TS 타입 오류들(`AuthenticatedAppContainer`, `useWorkspaceBrowser` 등)이 남아 있음.
- Next step:
  - 남은 TS 오류를 도메인별로 정리(윈도우 전역 확장, payload 타입, props 누락, 테스트 중복 키 수정).

## 2026-05-08 15:10 (local)
- Objective:
  - TypeScript 1단계 전환(진입/도메인/테스트) 및 ESLint 기본 게이트 도입.
- Files changed:
  - web/frontend/package.json
  - web/frontend/package-lock.json
  - web/frontend/index.html
  - web/frontend/tsconfig.json
  - web/frontend/eslint.config.js
  - web/frontend/scripts/run-tests.mjs
  - web/frontend/src/**/*.js -> .ts, web/frontend/src/**/*.jsx -> .tsx (테스트 포함)
- Changes:
  - TypeScript/React type 패키지와 ESLint(Flat config) 패키지 추가, `lint`/`lint:fix`/`test` 스크립트 구성.
  - `tsconfig.json`을 `strict: false`, `noEmit: true`, `moduleResolution: bundler`, `jsx: react-jsx` 기준으로 추가.
  - `src/main.jsx` 엔트리를 `src/main.tsx`로 전환하고 index 엔트리 경로를 갱신.
  - Node 환경에서 `.test.ts`를 안정적으로 실행하도록 `scripts/run-tests.mjs` 추가.
  - ESLint는 오류만 실패하도록 유지하고 기존 코드 이슈는 경고 레벨로 통과 가능하게 구성.
- Validation:
  - `cd web/frontend && npm run lint` 통과 (0 errors, warnings only).
  - `cd web/frontend && npm test` 통과 (19/19).
  - `cd web/frontend && npm run build` 통과.
- Next step:
  - 2단계에서 타입 정밀화(`any`/암시 타입 축소)와 Hook dependency 경고 해소를 점진 진행.
