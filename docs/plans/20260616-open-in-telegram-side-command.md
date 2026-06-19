# Open in Telegram + Side Command Design

**Goal:** Let users explicitly open a Web-visible Codex thread in the Telegram client, and define a separate side-command workspace flow for later implementation.

**Architecture:** v1 is an explicit cross-client action: the current chat header opens a modal, the user picks a thread in the current project, and `POST /api/telegram/open-thread` makes that thread active in Telegram. Merely opening a thread in Web does not change Telegram's active thread. Side command is documented as a separate right-sidebar flow that does not merge into the main thread model.

**Tech Stack:** FastAPI, Python 3.11, React, existing Codex thread/session routing.

---

## Open in Telegram

**Affected areas:**
- Modify: `web/routes.py`
- Modify: `web/frontend/src/features/app/hooks/useThreadSession.ts`
- Modify: `web/frontend/src/features/app/hooks/useThreadSession.types.ts`
- Modify: `web/frontend/src/features/app/components/ChatHeader.tsx`
- Modify: `web/frontend/src/features/app/components/AppConversationPane.tsx`
- Create: `web/frontend/src/features/app/components/OpenInTelegramModal.tsx`
- Modify: `web/frontend/src/styles/_overlays.scss`
- Modify: `tests/test_web_server_local_command.py`

- Add `POST /api/telegram/open-thread` and update Telegram's active-thread binding only when this explicit action is requested.
- Add a header-triggered Open in Telegram modal that shows the active Telegram thread and available threads in the current project.
- Cover route behavior, active-thread isolation, error propagation, and modal rendering with regression tests.

## Side Command

- Reserve the right sidebar for a future side-command workspace flow.
- Keep side command separate from the main thread model and outside the v1 implementation.

## Assumptions
- Open in Telegram v1 targets threads in the current project only.
- The current chat header is the entry point for the Open in Telegram modal.
- Web and Telegram keep independent active-thread selections; only the explicit action changes Telegram's active thread.
- Side command remains a later feature; its current design is documented but not implemented in this branch.
