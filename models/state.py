import asyncio
from codex import CodexClient, CommandRouter
from codex.approval_guardian import ApprovalGuardianService

codex_client: CodexClient | None = None
command_router: CommandRouter | None = None
approval_guardian: ApprovalGuardianService | None = None
codex_ready = asyncio.Event()
