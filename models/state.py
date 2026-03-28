import asyncio
from typing import Any

from codex import CommandRouter
from codex.approval_guardian import ApprovalGuardianService

codex_client: Any | None = None
command_router: CommandRouter | None = None
approval_guardian: ApprovalGuardianService | None = None
codex_ready = asyncio.Event()
update_notified: bool = False
