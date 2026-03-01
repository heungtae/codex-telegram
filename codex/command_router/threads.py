from typing import Any

from .common import first_text
from .context import RouterContext
from .contracts import CommandResult, text_result, usage_result


class ThreadCommands:
    def __init__(self, ctx: RouterContext):
        self.ctx = ctx

    def _resolve_thread_arg(self, arg: str, user_id: int) -> tuple[str | None, CommandResult | None]:
        from models.user import user_manager

        candidate = (arg or "").strip()
        if not candidate:
            return None, usage_result("Usage: missing thread identifier.")
        if candidate.isdigit():
            idx = int(candidate)
            listed = user_manager.get(user_id).last_listed_thread_ids
            if idx < 1 or idx > len(listed):
                return None, text_result(f"Invalid thread number: {candidate}. Run /threads first.")
            return listed[idx - 1], None
        return candidate, None

    def _thread_conversation(self, thread: dict[str, Any] | None) -> str:
        t = thread or {}
        value = (
            t.get("preview")
            or t.get("conversation")
            or t.get("name")
            or t.get("title")
            or t.get("summary")
        )
        if isinstance(value, str) and value.strip():
            return value.strip()
        return "Untitled"

    def _extract_turns(self, result: dict[str, Any], thread: dict[str, Any]) -> list[dict[str, Any]]:
        def to_turn_list(value: Any) -> list[dict[str, Any]]:
            if isinstance(value, list):
                return [v for v in value if isinstance(v, dict)]
            if isinstance(value, dict):
                data = value.get("data")
                if isinstance(data, list):
                    return [v for v in data if isinstance(v, dict)]
            return []

        turns = to_turn_list(result.get("turns"))
        if turns:
            return turns
        return to_turn_list(thread.get("turns"))

    def _extract_preview(self, result: dict[str, Any], thread: dict[str, Any], turns: list[dict[str, Any]]) -> str:
        direct = (
            first_text(thread.get("preview"))
            or first_text(thread.get("summary"))
            or first_text(result.get("preview"))
            or first_text(result.get("summary"))
        )
        if direct:
            return direct

        for turn in reversed(turns):
            text = (
                first_text(turn.get("summary"))
                or first_text(turn.get("preview"))
                or first_text(turn.get("text"))
                or first_text(turn.get("items"))
                or first_text(turn.get("output"))
            )
            if text:
                return text
        return "(no preview)"

    async def start(self, args: list[str], user_id: int, project: dict[str, str] | None) -> CommandResult:
        from models.user import user_manager

        params: dict[str, Any] = {}
        if args:
            params["model"] = args[0]
        if project:
            params["cwd"] = project["path"]

        result = await self.ctx.codex.call("thread/start", params)
        thread_id = result.get("thread", {}).get("id")

        if thread_id:
            user_manager.set_active_thread(user_id, thread_id)

        if project:
            return text_result(
                f"Thread started: {thread_id}\n"
                f"Project: {project['key']} - {project['name']}\n"
                f"Workspace: {project['path']}",
                thread_id=thread_id,
                project=project,
            )
        return text_result(f"Thread started: {thread_id}", thread_id=thread_id)

    async def resume(self, args: list[str], user_id: int) -> CommandResult:
        from models.user import user_manager

        if not args:
            return usage_result("Usage: /resume <thread_id|number>")

        thread_id, err = self._resolve_thread_arg(args[0], user_id)
        if err:
            return err

        await self.ctx.codex.call("thread/resume", {"threadId": thread_id})
        user_manager.set_active_thread(user_id, thread_id)
        return text_result(f"Thread resumed: {thread_id}", thread_id=thread_id)

    async def fork(self, args: list[str], user_id: int) -> CommandResult:
        from models.user import user_manager

        if not args:
            return usage_result("Usage: /fork <thread_id>")

        thread_id = args[0]
        result = await self.ctx.codex.call("thread/fork", {"threadId": thread_id})
        new_thread_id = result.get("thread", {}).get("id")
        if isinstance(new_thread_id, str) and new_thread_id:
            user_manager.bind_thread_owner(user_id, new_thread_id)
        return text_result(f"Thread forked: {new_thread_id}", thread_id=new_thread_id)

    async def list_threads(self, args: list[str], user_id: int) -> CommandResult:
        from models.user import user_manager

        def _normalize_flag(arg: str) -> str:
            value = (arg or "").strip()
            if value.startswith("\u2014"):
                return "--" + value[1:]
            if value.startswith("\u2013"):
                return "--" + value[1:]
            return value

        usage = "Usage: /threads [--archived] [--full] [--limit N] [--offset N]"
        params: dict[str, Any] = {"limit": 5}
        show_full_id = True
        offset: int | None = None
        archived_mode = False
        i = 0
        while i < len(args):
            arg = _normalize_flag(args[i])
            if arg in ("--archived", "-a", "archived"):
                params["archived"] = True
                archived_mode = True
            elif arg in ("--full", "--full-id"):
                show_full_id = True
            elif arg == "--limit":
                if i + 1 >= len(args) or not args[i + 1].isdigit():
                    return usage_result(usage)
                params["limit"] = max(1, min(100, int(args[i + 1])))
                i += 1
            elif arg == "--offset":
                if i + 1 >= len(args) or not args[i + 1].isdigit():
                    return usage_result(usage)
                offset = max(0, int(args[i + 1]))
                i += 1
            else:
                return usage_result(usage)
            i += 1

        original_limit = int(params["limit"])
        if offset is not None:
            params["limit"] = min(100, original_limit + offset)

        result = await self.ctx.codex.call("thread/list", params)
        threads = result.get("data", [])

        def _is_archived_thread(thread: dict[str, Any]) -> bool | None:
            archived_value = thread.get("archived")
            if isinstance(archived_value, bool):
                return archived_value
            status = thread.get("status")
            if isinstance(status, dict):
                status_text = str(status.get("type") or status.get("status") or "").strip().lower()
                if status_text and "archiv" in status_text:
                    return True
            for key in ("state", "threadState", "lifecycle"):
                value = thread.get(key)
                if isinstance(value, str) and "archiv" in value.strip().lower():
                    return True
            return None

        recognized = [_is_archived_thread(t) for t in threads if isinstance(t, dict)]
        if any(v is True or v is False for v in recognized):
            filtered: list[dict[str, Any]] = []
            for t in threads:
                if not isinstance(t, dict):
                    continue
                archived_state = _is_archived_thread(t)
                if archived_mode and archived_state is True:
                    filtered.append(t)
                if not archived_mode and archived_state is not True:
                    filtered.append(t)
            threads = filtered

        if offset is not None:
            threads = threads[offset:]
            if original_limit < len(threads):
                threads = threads[:original_limit]

        state = user_manager.get(user_id)
        listed_ids: list[str] = []
        page_number = (offset // original_limit) + 1 if offset is not None else 1
        row_start = (offset or 0) + 1
        row_end = (offset or 0) + len(threads)
        title = "Archived Threads:" if archived_mode else "Threads:"
        lines = [title, f"Page {page_number} (rows {row_start}-{row_end})", ""]
        lines.append(f"{'no':>3}  {'created at':<20}  {'threadId':<36}  conversation")
        lines.append(f"{'-' * 3}  {'-' * 20}  {'-' * 36}  {'-' * 12}")
        for idx, t in enumerate(threads, 1):
            name = self._thread_conversation(t)
            tid = t.get("id", "")
            created_at = t.get("createdAt") or t.get("created_at") or "-"
            if isinstance(tid, str) and tid:
                listed_ids.append(tid)
            row_no = (offset or 0) + idx
            status = " [active]" if state.active_thread_id and tid == state.active_thread_id else ""
            display_id = tid if show_full_id else (f"{tid[:12]}..." if tid else "unknown")
            created_display = str(created_at).replace("\n", " ")[:20]
            conversation_display = str(name).replace("\n", " ").strip()[:120]
            lines.append(
                f"{row_no:>3}  {created_display:<20}  {display_id:<36}  {conversation_display}{status}"
            )

        state.set_last_listed_threads(listed_ids)
        if not threads:
            return CommandResult(
                kind="threads",
                text="No threads found.",
                meta={"thread_ids": [], "offset": offset or 0, "limit": original_limit, "archived": archived_mode},
            )

        lines.append("")
        lines.append(
            "Tip: Use the buttons below (Unarchive/Read, Prev/Next)."
            if archived_mode
            else "Tip: Use the buttons below (Resume/Read/Archive, Prev/Next)."
        )
        return CommandResult(
            kind="threads",
            text="\n".join(lines),
            meta={"thread_ids": listed_ids, "offset": offset or 0, "limit": original_limit, "archived": archived_mode},
        )

    async def read(self, args: list[str], user_id: int) -> CommandResult:
        if not args:
            return usage_result("Usage: /read <thread_id|number>")

        thread_id, err = self._resolve_thread_arg(args[0], user_id)
        if err:
            return err
        result = await self.ctx.codex.call("thread/read", {"threadId": thread_id, "includeTurns": True})

        thread = result.get("thread", {})
        name = self._thread_conversation(thread)
        status = thread.get("status", {}).get("type", "unknown")
        turns = self._extract_turns(result, thread)
        preview = self._extract_preview(result, thread, turns).replace("\n", " ").strip()[:500]

        return text_result(
            f"Thread: {name}\n"
            f"Status: {status}\n"
            f"ID: {thread_id}\n"
            f"Turns: {len(turns)}\n"
            f"Preview: {preview}",
            thread_id=thread_id,
        )

    async def archive(self, args: list[str], user_id: int) -> CommandResult:
        if not args:
            return usage_result("Usage: /archive <thread_id|number>")

        thread_id, err = self._resolve_thread_arg(args[0], user_id)
        if err:
            return err
        await self.ctx.codex.call("thread/archive", {"threadId": thread_id})
        return text_result(f"Thread archived: {thread_id}", thread_id=thread_id)

    async def unarchive(self, args: list[str]) -> CommandResult:
        if not args:
            return usage_result("Usage: /unarchive <thread_id>")

        thread_id = args[0]
        await self.ctx.codex.call("thread/unarchive", {"threadId": thread_id})
        return text_result(f"Thread unarchived: {thread_id}", thread_id=thread_id)

    async def compact(self, args: list[str]) -> CommandResult:
        if not args:
            return usage_result("Usage: /compact <thread_id>")

        thread_id = args[0]
        await self.ctx.codex.call("thread/compact/start", {"threadId": thread_id})
        return text_result(f"Compaction started: {thread_id}", thread_id=thread_id)

    async def rollback(self, args: list[str]) -> CommandResult:
        if not args:
            return usage_result("Usage: /rollback <n_turns>")

        n = int(args[0])
        result = await self.ctx.codex.call("thread/rollback", {"n": n})
        thread = result.get("thread", {})
        return text_result(f"Rolled back. Thread: {thread.get('id', 'unknown')}")

    async def interrupt(self, user_id: int) -> CommandResult:
        from models.user import user_manager

        state = user_manager.get(user_id)
        if not state.active_thread_id:
            return text_result("No active thread.")

        if not state.active_turn_id:
            return text_result("No running turn to interrupt.")

        await self.ctx.codex.call(
            "turn/interrupt",
            {"threadId": state.active_thread_id, "turnId": state.active_turn_id},
        )
        state.clear_turn()

        return text_result("Turn interrupted.")
