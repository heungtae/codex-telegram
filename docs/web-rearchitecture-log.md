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

## 2026-06-08 18:00 (local)
- Objective:
  - SidebarAgentsPanel의 enabled agents, running subagents, settings card 책임 분리.
- Files changed:
  - web/frontend/src/features/app/components/SidebarAgentsPanel.tsx
  - web/frontend/src/features/app/components/EnabledAgentsList.tsx
  - web/frontend/src/features/app/components/RunningSubagentsList.tsx
  - web/frontend/src/features/app/components/AgentSettingsCard.tsx
  - web/frontend/src/features/app/components/GuardianRulesSummary.tsx
  - web/frontend/src/features/app/components/__tests__/EnabledAgentsList.test.ts
  - web/frontend/src/features/app/components/__tests__/RunningSubagentsList.test.ts
  - web/frontend/src/features/app/components/__tests__/AgentSettingsCard.test.ts
  - web/frontend/src/features/app/components/__tests__/GuardianRulesSummary.test.ts
- Changes:
  - enabled agent 목록과 settings 버튼 렌더를 `EnabledAgentsList`로 추출.
  - running subagent fallback label/title 렌더를 `RunningSubagentsList`로 추출.
  - settings field, refresh/save action, loading state를 `AgentSettingsCard`로 추출.
  - guardian rule summary와 Rules TOML 버튼을 `GuardianRulesSummary`로 추출.
  - `SidebarAgentsPanel`은 `Panel` 내부 조립과 error 표시를 담당하도록 200줄에서 52줄로 축소.
- Validation:
  - Agent 하위 컴포넌트 및 sidebar targeted tests 통과 (9/9).
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (75/75).
  - `npm run build` 통과.
  - `git diff --check` 통과 (line ending warnings only).
- Next step:
  - 브라우저에서 agent toggle, settings refresh/save, guardian summary, running subagent 표시를 수동 확인.

## 2026-06-08 17:42 (local)
- Objective:
  - WorkspacePanel의 헤더, 재귀 트리, 삭제 파일 목록 표시 책임 분리.
- Files changed:
  - web/frontend/src/features/workspace/components/WorkspacePanel.tsx
  - web/frontend/src/features/workspace/components/WorkspacePanelHeader.tsx
  - web/frontend/src/features/workspace/components/WorkspaceTree.tsx
  - web/frontend/src/features/workspace/components/WorkspaceDeletedEntries.tsx
  - web/frontend/src/features/workspace/components/__tests__/WorkspacePanelHeader.test.ts
  - web/frontend/src/features/workspace/components/__tests__/WorkspaceTree.test.ts
  - web/frontend/src/features/workspace/components/__tests__/WorkspaceDeletedEntries.test.ts
- Changes:
  - workspace root label과 refresh action을 `WorkspacePanelHeader`로 추출.
  - compact directory와 재귀 file/directory 렌더를 `WorkspaceTree`로 추출.
  - 삭제 파일 목록과 status badge 렌더를 `WorkspaceDeletedEntries`로 추출.
  - `WorkspacePanel`은 파생 데이터, 경로 복사 callback, 하위 컴포넌트 조립을 담당하도록 231줄에서 106줄로 축소.
  - 외부 props, CSS class, 파일 열기/토글/복사 동작은 유지.
- Validation:
  - Workspace 하위 컴포넌트 및 `AppWorkspacePanelSlot` targeted tests 통과 (4/4).
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (68/68).
  - `npm run build` 통과.
  - `git diff --check` 통과 (line ending warnings only).
- Next step:
  - 브라우저에서 workspace refresh, tree expand, file open, path copy, deleted file 표시를 수동 확인.

## 2026-06-08 15:55 (local)
- Objective:
  - Stage 4 4차: sidebar Panel과 Toast 표시 계층을 UI Kit으로 정리.
- Files changed:
  - web/frontend/src/features/common/components/ui/Panel.tsx
  - web/frontend/src/features/common/components/ui/Toast.tsx
  - web/frontend/src/features/common/components/ui/index.ts
  - web/frontend/src/features/app/components/SidebarProjectsPanel.tsx
  - web/frontend/src/features/app/components/SidebarThreadsPanel.tsx
  - web/frontend/src/features/app/components/SidebarAgentsPanel.tsx
  - web/frontend/src/features/app/components/AppOverlaysPresenter.tsx
  - web/frontend/src/styles.css
  - docs/web-ui-kit.md
- Changes:
  - sidebar Projects/Threads/Agents 컨테이너를 공통 `Panel` 기반으로 교체.
  - Toast 표시 마크업을 `Toast`로 추출하고 info/success/error variant와 live region 접근성 추가.
  - Workspace/Preview panel 레이아웃과 Toast 상태/5초 자동 닫힘 로직은 유지.
- Validation:
  - Panel/Toast 및 적용부 targeted tests 통과 (10/10).
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (65/65).
  - `npm run build` 통과.
  - `git diff --check` 통과 (line ending warnings only).
- Next step:
  - 브라우저에서 sidebar Panel 배치와 info/success/error Toast 표시를 수동 확인.

## 2026-05-29 09:51 (local)
- Objective:
  - Stage 4 3차: Composer 입력/아이콘 액션을 UI Kit 기반으로 정리.
- Files changed:
  - web/frontend/src/features/common/components/ui/Textarea.tsx
  - web/frontend/src/features/common/components/ui/__tests__/Textarea.test.ts
  - web/frontend/src/features/common/components/ui/index.ts
  - web/frontend/src/features/app/components/AppComposerPresenter.tsx
  - web/frontend/src/features/app/components/__tests__/AppComposerPresenter.test.ts
  - web/frontend/src/features/app/components/__tests__/AppConversationPane.test.ts
  - web/frontend/src/styles.css
  - docs/web-ui-kit.md
- Changes:
  - `Textarea` UI Kit 컴포넌트를 추가하고 Composer 입력창에 적용.
  - Composer send/stop/workspace/new chat icon-only 액션을 `IconButton` 기반으로 교체.
  - Composer mode toggle, slash palette, input key handling은 기존 feature-owned 로직 유지.
- Validation:
  - `npx tsx --test src/features/common/components/ui/__tests__/Textarea.test.ts` 통과.
  - `npx tsx --test src/features/app/components/__tests__/AppConversationPane.test.ts` 통과.
  - `npx tsx --test src/features/app/components/__tests__/AppComposerPresenter.test.ts` 통과.
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (61/61).
  - `npm run build` 통과.
  - `git diff --check` 통과 (line ending warnings only).
- Next step:
  - 브라우저에서 Composer 입력/전송/중지/줄바꿈/Tab/slash palette 수동 확인.

## 2026-05-28 17:53 (local)
- Objective:
  - Stage 4 2차: IconButton UI Kit 적용 및 TopTabs/header icon controls 정리.
- Files changed:
  - web/frontend/src/features/common/components/ui/IconButton.tsx
  - web/frontend/src/features/common/components/ui/index.ts
  - web/frontend/src/features/tabs/components/TopTabs.tsx
  - web/frontend/src/features/app/components/SidebarHeaderActions.tsx
  - web/frontend/src/features/app/components/AppMainFrame.tsx
  - web/frontend/src/styles.css
  - docs/web-ui-kit.md
- Changes:
  - `IconButton` 컴포넌트를 추가해 icon-only 버튼의 className/active/aria label 조합을 공통화.
  - project/turn tab close, add thread, notification/theme toggle, mobile menu toggle을 `IconButton` 기반으로 교체.
  - 기존 tab 상태 class와 click handler 동작은 유지.
  - Composer/Toast/Panel 치환은 다음 배치로 유지.
- Validation:
  - `node --import tsx --test src/features/common/components/ui/__tests__/IconButton.test.ts src/features/tabs/components/__tests__/TopTabs.test.ts src/features/app/components/__tests__/SidebarHeaderActions.test.ts src/features/app/components/__tests__/AppMainFrame.test.ts` 통과.
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (58/58).
  - `npm run build` 통과.
- Next step:
  - tab/header icon controls 수동 확인 후 Composer 또는 Toast/Panel 배치 범위 결정.

## 2026-05-28 17:04 (local)
- Objective:
  - Stage 4 1차: UI Kit 기반 컴포넌트와 Project modal 적용.
- Files changed:
  - web/frontend/src/features/common/components/ui/Button.tsx
  - web/frontend/src/features/common/components/ui/Input.tsx
  - web/frontend/src/features/common/components/ui/Modal.tsx
  - web/frontend/src/features/common/components/ui/Badge.tsx
  - web/frontend/src/features/common/components/ui/index.ts
  - web/frontend/src/features/app/components/ProjectModals.tsx
  - web/frontend/src/styles.css
  - docs/web-ui-kit.md
- Changes:
  - `Button`, `Input`, `Modal`, `Badge` 1차 UI Kit 컴포넌트 추가.
  - Project open mode modal과 project picker modal을 UI Kit 기반으로 교체.
  - CSS token alias(color/spacing/radius/typography/layer)와 UI Kit baseline 스타일 추가.
  - Composer/Tabs/Toast/Panel 치환은 다음 배치로 유지.
- Validation:
  - `node --import tsx --test src/features/common/components/ui/__tests__/Button.test.ts src/features/common/components/ui/__tests__/Input.test.ts src/features/common/components/ui/__tests__/Modal.test.ts src/features/common/components/ui/__tests__/Badge.test.ts src/features/app/components/__tests__/ProjectModals.test.ts` 통과.
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (55/55).
  - `npm run build` 통과.
- Next step:
  - Project modal/picker 수동 확인 후 다음 배치(Composer 또는 Tabs/IconButton) 범위 결정.

## 2026-05-28 16:36 (local)
- Objective:
  - 컴포넌트 분리 10차: SSE/turn/session event orchestration 최종 분리.
- Files changed:
  - web/frontend/src/features/app/hooks/useTurnSession.ts
  - web/frontend/src/features/app/events/sseEventUtils.ts
  - web/frontend/src/features/app/events/turnDeltaEvent.ts
  - web/frontend/src/features/app/events/turnLifecycleEvents.ts
  - web/frontend/src/features/app/events/sseMessageEvents.ts
  - web/frontend/src/features/app/events/__tests__/sseEventUtils.test.ts
  - web/frontend/src/features/app/events/__tests__/turnDeltaEvent.test.ts
  - web/frontend/src/features/app/events/__tests__/turnLifecycleEvents.test.ts
  - web/frontend/src/features/app/events/__tests__/sseMessageEvents.test.ts
- Changes:
  - `useTurnSession`의 SSE parse/log/text/item helper를 `sseEventUtils`로 추출.
  - `turn_delta`, started/failed/cancelled lifecycle, system/file/web/image/app event 처리를 event handler 모듈로 이동.
  - `useTurnSession`은 SSE 연결과 event listener wiring을 담당하도록 축소.
  - running 중 Thread 선택 비활성화 등 기존 interaction 동작은 변경하지 않음.
- Validation:
  - `node --import tsx --test src/features/app/events/__tests__/sseEventUtils.test.ts src/features/app/events/__tests__/turnDeltaEvent.test.ts src/features/app/events/__tests__/turnLifecycleEvents.test.ts src/features/app/events/__tests__/sseMessageEvents.test.ts` 통과.
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (50/50).
  - `npm run build` 통과.
- Next step:
  - 브라우저에서 turn lifecycle 수동 확인 후 필요 시 frontend/docs만 스테이징.

## 2026-05-27 17:12 (local)
- Objective:
  - 컴포넌트 분리 9차: app command ref orchestration 정리.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/app/hooks/useAppCommandRefs.ts
  - web/frontend/src/features/app/hooks/useAppUiEffects.ts
  - web/frontend/src/features/app/hooks/useGlobalKeyboardShortcuts.ts
  - web/frontend/src/features/app/hooks/useGlobalKeyboardShortcuts.types.ts
  - web/frontend/src/features/app/hooks/__tests__/useAppCommandRefs.test.ts
- Changes:
  - `sendMessage/startThread/closeThreadTab/viewThread/selectProject/focusComposer/setInputForActiveThread` command refs를 `useAppCommandRefs`로 묶음.
  - command ref 갱신은 `bindAppCommandRefs`로 명시화하고 `useAppUiEffects`는 해당 helper만 호출하도록 정리.
  - `useGlobalKeyboardShortcuts`는 개별 ref props 대신 `commandRefs` 객체를 소비하도록 변경.
  - turn/session lifecycle refs와 SSE/turn 처리 로직은 변경하지 않음.
- Validation:
  - `node --import tsx --test src/features/app/hooks/__tests__/useAppCommandRefs.test.ts` 통과.
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (38/38).
  - `npm run build` 통과.
- Next step:
  - 10번 SSE/turn/session 주변 최종 분리는 별도 계획으로 진행.

## 2026-05-27 17:00 (local)
- Objective:
  - 컴포넌트 분리 8차: `AppSidebarContentPanel` 내부 섹션 분해.
- Files changed:
  - web/frontend/src/features/app/components/AppSidebarContentPanel.tsx
  - web/frontend/src/features/app/components/SidebarHeaderActions.tsx
  - web/frontend/src/features/app/components/SidebarAgentsPanel.tsx
  - web/frontend/src/features/app/components/SidebarProjectsPanel.tsx
  - web/frontend/src/features/app/components/SidebarThreadsPanel.tsx
  - web/frontend/src/features/app/components/__tests__/SidebarHeaderActions.test.ts
  - web/frontend/src/features/app/components/__tests__/SidebarAgentsPanel.test.ts
  - web/frontend/src/features/app/components/__tests__/SidebarProjectsPanel.test.ts
  - web/frontend/src/features/app/components/__tests__/SidebarThreadsPanel.test.ts
- Changes:
  - sidebar header notification/theme controls를 `SidebarHeaderActions`로 분리.
  - agents/subagents/agent settings card를 `SidebarAgentsPanel`로 분리.
  - projects list와 empty/busy state를 `SidebarProjectsPanel`로 분리.
  - threads list와 active/empty state를 `SidebarThreadsPanel`로 분리.
  - `AppSidebarContentPanel`은 하위 sidebar 섹션 조립만 담당하도록 축소.
- Validation:
  - `node --import tsx --test src/features/app/components/__tests__/SidebarHeaderActions.test.ts src/features/app/components/__tests__/SidebarAgentsPanel.test.ts src/features/app/components/__tests__/SidebarProjectsPanel.test.ts src/features/app/components/__tests__/SidebarThreadsPanel.test.ts src/features/app/components/__tests__/AppSidebarPane.test.ts` 통과.
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (36/36).
  - `npm run build` 통과.
- Next step:
  - 9번 ref orchestration 정리 계획을 별도 수립.

## 2026-05-27 16:50 (local)
- Objective:
  - 컴포넌트 분리 4~7차: sidebar pane, floating agent settings, project picker/composer view-model 분리.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/app/components/AppSidebarPane.tsx
  - web/frontend/src/features/app/components/AppFloatingAgentSettingsPane.tsx
  - web/frontend/src/features/app/hooks/useProjectPickerViewModel.ts
  - web/frontend/src/features/app/hooks/useComposerViewModel.ts
  - web/frontend/src/features/app/components/__tests__/AppSidebarPane.test.ts
  - web/frontend/src/features/app/components/__tests__/AppFloatingAgentSettingsPane.test.ts
  - web/frontend/src/features/app/hooks/__tests__/useProjectPickerViewModel.test.ts
  - web/frontend/src/features/app/hooks/__tests__/useComposerViewModel.test.ts
- Changes:
  - sidebar frame/content panel props 조립을 `AppSidebarPane`으로 이동.
  - floating guardian settings 계산/렌더 조립을 `AppFloatingAgentSettingsPane`으로 이동.
  - project picker filter/close/select handler packaging을 `useProjectPickerViewModel`로 이동.
  - composer props와 mode/new-chat/workspace toggle handler packaging을 `useComposerViewModel`로 이동.
  - SSE/turn/session 상태 전이 로직은 변경하지 않음.
- Validation:
  - `node --import tsx --test src/features/app/components/__tests__/AppSidebarPane.test.ts src/features/app/components/__tests__/AppFloatingAgentSettingsPane.test.ts src/features/app/hooks/__tests__/useProjectPickerViewModel.test.ts src/features/app/hooks/__tests__/useComposerViewModel.test.ts` 통과.
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (30/30).
  - `npm run build` 통과.
- Next step:
  - sidebar content 내부 분해 또는 ref orchestration 정리를 별도 단계로 진행.

## 2026-05-27 16:36 (local)
- Objective:
  - 컴포넌트 분리 3차: workspace panel slot, overlay layer, main layout 조립 분리.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/app/components/AppWorkspacePanelSlot.tsx
  - web/frontend/src/features/app/components/AppOverlayLayer.tsx
  - web/frontend/src/features/app/components/AuthenticatedAppLayout.tsx
  - web/frontend/src/features/app/components/__tests__/AppWorkspacePanelSlot.test.ts
  - web/frontend/src/features/app/components/__tests__/AppOverlayLayer.test.ts
  - web/frontend/src/features/app/components/__tests__/AuthenticatedAppLayout.test.ts
- Changes:
  - workspace panel label/style/status item 조립을 `AppWorkspacePanelSlot`으로 이동.
  - project mode/picker modal과 toast overlay 조립을 `AppOverlayLayer`로 이동.
  - root app layout, sidebar/main presenter, mobile main frame 조립을 `AuthenticatedAppLayout`으로 이동.
  - SSE/turn/session 상태 전이 로직은 변경하지 않음.
- Validation:
  - `node --import tsx --test src/features/app/components/__tests__/AppWorkspacePanelSlot.test.ts src/features/app/components/__tests__/AppOverlayLayer.test.ts src/features/app/components/__tests__/AuthenticatedAppLayout.test.ts` 통과.
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (25/25).
  - `npm run build` 통과.
- Next step:
  - 사이드바 props 조립 또는 agent settings view-model 분리를 다음 단위로 진행.

## 2026-05-27 16:24 (local)
- Objective:
  - 컴포넌트 분리 2차: center pane/chat/composer 조립부 분리.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/app/components/AppConversationPane.tsx
  - web/frontend/src/features/app/components/__tests__/AppConversationPane.test.ts
- Changes:
  - `TopTabs`, `WorkspacePreviewOverlay`, `ApprovalStack`, `ChatMessageFeed`, `AppComposerPresenter` 조립을 `AppConversationPane`으로 이동.
  - 컨테이너는 도메인 상태와 핸들러를 props로 전달하는 orchestration만 유지.
  - SSE/turn/session 상태 전이 로직은 변경하지 않음.
- Validation:
  - `node --import tsx --test src/features/app/components/__tests__/AppConversationPane.test.ts` 통과.
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (22/22).
  - `npm run build` 통과.
- Next step:
  - 필요 시 사이드바 내부 패널을 다음 단위로 분리.

## 2026-05-27 15:40 (local)
- Objective:
  - 컴포넌트 분리 1차 진입: 컨테이너 하단 JSX 책임 축소.
- Files changed:
  - web/frontend/src/features/app/containers/AuthenticatedAppContainer.tsx
  - web/frontend/src/features/app/components/ProjectModals.tsx
  - web/frontend/src/features/app/components/AppSidebarFrame.tsx
  - web/frontend/src/features/app/components/AppMainFrame.tsx
  - web/frontend/src/features/app/components/__tests__/ProjectModals.test.ts
- Changes:
  - project mode / project picker modal JSX를 `ProjectModals` 컴포넌트로 분리.
  - sidebar shell/footer/backdrop/resizer 책임을 `AppSidebarFrame`으로 분리.
  - mobile main menu wrapper를 `AppMainFrame`으로 분리.
  - SSE/turn/session 상태 전이 로직은 변경하지 않음.
- Validation:
  - `node --import tsx --test src/features/app/components/__tests__/ProjectModals.test.ts` 통과.
  - `npx tsc -p . --noEmit` 통과.
  - `npm run lint` 통과 (0 errors, 47 warnings).
  - `npm test` 통과 (21/21).
  - `npm run build` 통과.
- Next step:
  - 필요 시 center pane/chat 조립부를 다음 단위로 분리.

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
