import asyncio
import os
from asyncio.subprocess import PIPE
from dataclasses import dataclass


@dataclass(slots=True)
class GitStatusEntry:
    code: str
    path: str
    raw: str


@dataclass(slots=True)
class WorkspaceChangeReview:
    workspace_path: str
    changed_files: list[str]
    git_status: str
    diff_stat: str
    diff_excerpt: str


def parse_git_status_entries(status_text: str) -> list[GitStatusEntry]:
    entries: list[GitStatusEntry] = []
    for line in str(status_text or "").splitlines():
        if len(line) < 4:
            continue
        code = line[:2]
        path = line[3:].strip()
        if not path:
            continue
        entries.append(GitStatusEntry(code=code, path=path, raw=line))
    return entries


def changed_entries_since(before_status: str, after_status: str) -> list[GitStatusEntry]:
    before_raw = {entry.raw for entry in parse_git_status_entries(before_status)}
    return [entry for entry in parse_git_status_entries(after_status) if entry.raw not in before_raw]


def clip_text(value: str, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[: max(1, limit - 3)].rstrip() + "..."


async def _run_git(workspace_path: str, args: list[str]) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        "git",
        "-C",
        workspace_path,
        *args,
        stdout=PIPE,
        stderr=PIPE,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace")


async def capture_git_status_snapshot(workspace_path: str | None) -> str:
    if not workspace_path:
        return ""
    if not os.path.isdir(workspace_path):
        return ""
    code, stdout, _stderr = await _run_git(
        workspace_path,
        ["status", "--porcelain=v1", "--untracked-files=all"],
    )
    if code != 0:
        return ""
    return stdout.strip()


async def collect_workspace_change_review(
    workspace_path: str | None,
    before_status: str,
) -> WorkspaceChangeReview | None:
    if not workspace_path:
        return None
    after_status = await capture_git_status_snapshot(workspace_path)
    if not after_status or after_status == before_status:
        return None

    changed_entries = changed_entries_since(before_status, after_status)
    if not changed_entries:
        return None

    changed_files: list[str] = []
    tracked_files: list[str] = []
    for entry in changed_entries:
        if entry.path not in changed_files:
            changed_files.append(entry.path)
        if entry.code != "??" and entry.path not in tracked_files:
            tracked_files.append(entry.path)

    diff_parts: list[str] = []
    diff_stat_parts: list[str] = []
    if tracked_files:
        code, stdout, _stderr = await _run_git(workspace_path, ["diff", "--stat", "--", *tracked_files])
        if code == 0 and stdout.strip():
            diff_stat_parts.append(stdout.strip())
        code, stdout, _stderr = await _run_git(workspace_path, ["diff", "--", *tracked_files])
        if code == 0 and stdout.strip():
            diff_parts.append(stdout.strip())
        code, stdout, _stderr = await _run_git(workspace_path, ["diff", "--cached", "--stat", "--", *tracked_files])
        if code == 0 and stdout.strip():
            diff_stat_parts.append(stdout.strip())
        code, stdout, _stderr = await _run_git(workspace_path, ["diff", "--cached", "--", *tracked_files])
        if code == 0 and stdout.strip():
            diff_parts.append(stdout.strip())

    untracked_files = [entry.path for entry in changed_entries if entry.code == "??"]
    if untracked_files:
        diff_stat_parts.append("Untracked files:\n" + "\n".join(untracked_files))

    diff_stat = "\n\n".join(part for part in diff_stat_parts if part).strip()
    diff_excerpt = clip_text("\n\n".join(part for part in diff_parts if part).strip(), 6000)
    git_status = clip_text(
        "\n".join(entry.raw for entry in changed_entries),
        2000,
    )
    return WorkspaceChangeReview(
        workspace_path=workspace_path,
        changed_files=changed_files,
        git_status=git_status,
        diff_stat=diff_stat,
        diff_excerpt=diff_excerpt,
    )
