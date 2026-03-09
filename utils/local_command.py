import asyncio
import os
import shlex
from asyncio.subprocess import PIPE

from utils.config import get

LOCAL_COMMAND_TIMEOUT_SECONDS = 30


def _truncate_block(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    omitted = len(text) - limit
    return f"{text[:limit]}\n... ({omitted} chars omitted)"


def resolve_command_cwd(preferred_cwd: str | None) -> str:
    if preferred_cwd and os.path.isdir(preferred_cwd):
        return preferred_cwd
    return os.getcwd()


async def run_bang_command(raw_text: str, preferred_cwd: str | None = None) -> str:
    command_text = raw_text[1:].strip()
    if not command_text:
        return "Usage: !<linux command>"

    try:
        argv = shlex.split(command_text)
    except ValueError as exc:
        return f"Invalid command: {exc}"

    if not argv:
        return "Usage: !<linux command>"

    cwd = resolve_command_cwd(preferred_cwd)
    max_length = max(500, int(get("display.max_message_length", 4000)))
    block_limit = max(200, min(1500, (max_length - 200) // 2))

    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=PIPE,
            stderr=PIPE,
            cwd=cwd,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=LOCAL_COMMAND_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return (
                f"Local command timed out after {LOCAL_COMMAND_TIMEOUT_SECONDS}s.\n"
                f"cwd: {cwd}\n"
                f"command: {command_text}"
            )
    except FileNotFoundError:
        return f"Command not found: {argv[0]}"
    except Exception as exc:
        return f"Failed to run local command: {exc}"

    stdout_text = stdout.decode(errors="replace").strip()
    stderr_text = stderr.decode(errors="replace").strip()
    lines = [
        f"$ {command_text}",
        f"cwd: {cwd}",
        f"exit code: {proc.returncode}",
    ]
    if stdout_text:
        lines.append("")
        lines.append("stdout:")
        lines.append(_truncate_block(stdout_text, block_limit))
    if stderr_text:
        lines.append("")
        lines.append("stderr:")
        lines.append(_truncate_block(stderr_text, block_limit))
    if not stdout_text and not stderr_text:
        lines.append("")
        lines.append("(no output)")
    return "\n".join(lines)
