from typing import Any

from .context import RouterContext
from .contracts import CommandResult, text_result


class ReviewCommands:
    def __init__(self, ctx: RouterContext):
        self.ctx = ctx

    async def review_start(self, args: list[str], user_id: int) -> CommandResult:
        from models.user import user_manager

        state = user_manager.get(user_id)
        if not state.active_thread_id:
            return text_result("No active thread. Start or resume a thread first.")

        params: dict[str, Any] = {"threadId": state.active_thread_id}

        if args:
            target_type = args[0]
            if target_type in ["uncommittedChanges", "baseBranch", "commit", "custom"]:
                params["target"] = {"type": target_type}

        await self.ctx.codex.call("review/start", params)
        return text_result("Review started.")
