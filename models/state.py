import asyncio
from codex import CodexClient, CommandRouter

codex_client: CodexClient | None = None
command_router: CommandRouter | None = None
codex_ready = asyncio.Event()
