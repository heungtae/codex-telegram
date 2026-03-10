import asyncio
from codex import CodexClient, CommandRouter
from codex.approval_guardian import ApprovalGuardianService
from codex.result_verifier import ResultVerifierService

codex_client: CodexClient | None = None
command_router: CommandRouter | None = None
approval_guardian: ApprovalGuardianService | None = None
result_verifier: ResultVerifierService | None = None
codex_ready = asyncio.Event()
