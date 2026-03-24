import asyncio
import os
from typing import Any

from fastapi import HTTPException

from models import state
from models.user import user_manager


def workspace_suggestions(workspace: str, prefix: str, limit: int) -> list[str]:
    def normalize_for_match(value: str) -> str:
        return "".join(ch for ch in value.lower() if ch.isalnum())

    def is_subsequence(query: str, target: str) -> bool:
        if not query:
            return True
        it = iter(target)
        return all(ch in it for ch in query)

    def fuzzy_score(name: str, query: str) -> int:
        if not query:
            return 1
        lowered_name = name.lower()
        lowered_query = query.lower()
        if lowered_name.startswith(lowered_query):
            return 500 - min(len(lowered_name), 200)
        direct_index = lowered_name.find(lowered_query)
        if direct_index >= 0:
            return 420 - min(direct_index, 200)

        normalized_name = normalize_for_match(lowered_name)
        normalized_query = normalize_for_match(lowered_query)
        if not normalized_query:
            return 1

        normalized_index = normalized_name.find(normalized_query)
        if normalized_index >= 0:
            return 340 - min(normalized_index, 200)
        if is_subsequence(normalized_query, normalized_name):
            return 260 - min(len(normalized_name), 200)
        return 0

    normalized_prefix = prefix.replace("\\", "/").lstrip("/")
    parts = [part for part in normalized_prefix.split("/") if part and part != "."]
    if any(part == ".." for part in parts):
        return []

    base_rel = ""
    partial = normalized_prefix
    if "/" in normalized_prefix:
        if normalized_prefix.endswith("/"):
            base_rel = normalized_prefix.rstrip("/")
            partial = ""
        else:
            base_rel, partial = normalized_prefix.rsplit("/", 1)
    scan_dir = os.path.join(workspace, base_rel) if base_rel else workspace
    if not os.path.isdir(scan_dir):
        return []

    scored: list[tuple[int, str, str]] = []
    partial_lower = partial.lower()
    recursive_mode = not base_rel and "/" not in normalized_prefix and bool(partial_lower)

    if recursive_mode or (base_rel and partial_lower):
        max_scan = 4000
        scanned = 0
        try:
            for root, dirnames, filenames in os.walk(workspace):
                dirnames[:] = [directory for directory in dirnames if not directory.startswith(".")]
                rel_root = os.path.relpath(root, workspace)
                if rel_root == ".":
                    rel_root = ""
                names = [(directory, True) for directory in dirnames] + [
                    (filename, False) for filename in filenames if not filename.startswith(".")
                ]
                for name, is_dir in names:
                    scanned += 1
                    if scanned > max_scan:
                        break
                    rel = f"{rel_root}/{name}" if rel_root else name
                    if is_dir:
                        rel += "/"
                    score_name = fuzzy_score(name, partial_lower)
                    score_rel = fuzzy_score(rel, partial_lower)
                    score = max(score_name, score_rel)
                    if score <= 0:
                        continue
                    scored.append((score, rel.lower(), rel))
                if scanned > max_scan:
                    break
        except OSError:
            return []
        scored.sort(key=lambda row: (-row[0], row[1]))
        return [row[2] for row in scored[:limit]]

    try:
        with os.scandir(scan_dir) as entries:
            rows = sorted(entries, key=lambda entry: entry.name.lower())
            for entry in rows:
                name = entry.name
                if name.startswith("."):
                    continue
                score = fuzzy_score(name, partial_lower)
                if partial and score <= 0:
                    continue
                rel = f"{base_rel}/{name}" if base_rel else name
                if entry.is_dir():
                    rel += "/"
                scored.append((score, name.lower(), rel))
    except OSError:
        return []
    scored.sort(key=lambda row: (-row[0], row[1]))
    return [row[2] for row in scored[:limit]]


def _project_path_from_profiles(project_key: str) -> str | None:
    if state.command_router is None or not hasattr(state.command_router, "projects"):
        return None
    loader = getattr(state.command_router.projects, "load_project_profiles", None)
    if not callable(loader):
        return None
    profiles, _default_key = loader()
    for profile in profiles:
        if not isinstance(profile, dict):
            continue
        key = profile.get("key")
        path = profile.get("path")
        if key == project_key and isinstance(path, str) and path:
            return path
    return None


def resolve_workspace_for_context(
    user_id: int,
    *,
    thread_id: str | None = None,
    project_key: str | None = None,
    ensure_exists: bool = True,
) -> str:
    state_user = user_manager.get(user_id)
    normalized_thread_id = thread_id if isinstance(thread_id, str) and thread_id else None
    normalized_project_key = project_key if isinstance(project_key, str) and project_key else None
    workspace: str | None = None

    if normalized_thread_id:
        mapped_key = user_manager.get_thread_project(normalized_thread_id)
        if mapped_key:
            workspace = _project_path_from_profiles(mapped_key)

    if not workspace and normalized_project_key:
        workspace = _project_path_from_profiles(normalized_project_key)

    if not workspace:
        workspace = state_user.selected_project_path

    if not workspace and state.command_router is not None:
        effective = state.command_router.projects.resolve_effective_project(user_id)
        if effective and isinstance(effective.get("path"), str):
            workspace = effective["path"]
    if not workspace:
        raise HTTPException(status_code=400, detail="No active workspace is selected")
    real_workspace = os.path.realpath(workspace)
    if ensure_exists and not os.path.isdir(real_workspace):
        raise HTTPException(status_code=400, detail="Workspace path does not exist")
    return real_workspace


def resolve_workspace_for_user(user_id: int) -> str:
    return resolve_workspace_for_context(user_id)


def resolve_workspace_path(
    workspace: str,
    raw_path: str = "",
    *,
    allow_missing: bool = False,
    expect_dir: bool | None = None,
) -> tuple[str, str]:
    normalized = str(raw_path or "").replace("\\", "/").strip()
    normalized = normalized.lstrip("/")
    parts = [part for part in normalized.split("/") if part and part != "."]
    if any(part == ".." for part in parts):
        raise HTTPException(status_code=400, detail="Path must stay inside the workspace")
    rel_path = "/".join(parts)
    target = os.path.realpath(os.path.join(workspace, rel_path)) if rel_path else workspace
    try:
        if os.path.commonpath([workspace, target]) != workspace:
            raise HTTPException(status_code=400, detail="Path must stay inside the workspace")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid workspace path") from exc
    if not allow_missing and not os.path.exists(target):
        raise HTTPException(status_code=404, detail="Workspace path was not found")
    if expect_dir is True and os.path.exists(target) and not os.path.isdir(target):
        raise HTTPException(status_code=400, detail="Path is not a directory")
    if expect_dir is False and os.path.exists(target) and not os.path.isfile(target):
        raise HTTPException(status_code=400, detail="Path is not a file")
    return rel_path, target


def has_visible_children(path: str) -> bool:
    try:
        with os.scandir(path) as entries:
            for entry in entries:
                if entry.name == ".git":
                    continue
                return True
    except OSError:
        return False
    return False


def workspace_tree_items(workspace: str, rel_path: str, depth: int) -> list[dict[str, Any]]:
    _, directory = resolve_workspace_path(workspace, rel_path, expect_dir=True)
    safe_depth = max(1, min(4, depth))
    try:
        with os.scandir(directory) as entries:
            rows = sorted(
                entries,
                key=lambda entry: (0 if entry.is_dir(follow_symlinks=False) else 1, entry.name.lower()),
            )
    except OSError:
        return []

    items: list[dict[str, Any]] = []
    for entry in rows:
        if entry.name == ".git":
            continue
        child_rel = f"{rel_path}/{entry.name}" if rel_path else entry.name
        is_dir = entry.is_dir(follow_symlinks=False)
        item: dict[str, Any] = {
            "name": entry.name,
            "path": child_rel,
            "type": "directory" if is_dir else "file",
        }
        if is_dir:
            item["has_children"] = has_visible_children(entry.path)
            if safe_depth > 1:
                item["children"] = workspace_tree_items(workspace, child_rel, safe_depth - 1)
        items.append(item)
    return items


async def run_process(argv: list[str], cwd: str | None = None) -> tuple[int, str, str]:
    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )
    except FileNotFoundError:
        return 127, "", f"Command not found: {argv[0]}"
    except Exception as exc:
        return 1, "", str(exc)
    stdout, stderr = await proc.communicate()
    return (
        proc.returncode,
        stdout.decode(errors="replace"),
        stderr.decode(errors="replace"),
    )


async def git_is_repo(workspace: str) -> bool:
    code, _stdout, _stderr = await run_process(["git", "-C", workspace, "rev-parse", "--show-toplevel"])
    return code == 0


def status_code_from_porcelain(xy: str) -> str:
    status = (xy or "").strip()
    if status == "??":
        return "??"
    letters = [char for char in xy if char not in {" ", "?"}]
    if "R" in letters:
        return "R"
    if "D" in letters:
        return "D"
    if "A" in letters:
        return "A"
    if "M" in letters:
        return "M"
    if "C" in letters:
        return "C"
    return letters[0] if letters else ""


async def workspace_git_status(workspace: str) -> dict[str, dict[str, str]]:
    if not await git_is_repo(workspace):
        return {}
    code, stdout, _stderr = await run_process(
        ["git", "-C", workspace, "status", "--porcelain=v1", "--untracked-files=all"]
    )
    if code != 0:
        return {}

    items: dict[str, dict[str, str]] = {}
    for raw_line in stdout.splitlines():
        line = raw_line.rstrip("\n")
        if len(line) < 4:
            continue
        xy = line[:2]
        payload = line[3:]
        path_text = payload
        original_path = ""
        if " -> " in payload:
            original_path, path_text = payload.split(" -> ", 1)
        normalized_path = path_text.replace("\\", "/").strip()
        if not normalized_path:
            continue
        items[normalized_path] = {
            "code": status_code_from_porcelain(xy),
            "xy": xy,
            "original_path": original_path.replace("\\", "/").strip(),
        }
    return items


def read_text_file(path: str, limit: int = 200_000) -> tuple[str, bool, bool]:
    with open(path, "rb") as handle:
        raw = handle.read(limit + 1)
    if b"\x00" in raw[:8192]:
        return "", True, False
    truncated = len(raw) > limit
    text = raw[:limit].decode("utf-8", errors="replace")
    return text, False, truncated


async def workspace_file_diff(workspace: str, rel_path: str, abs_path: str) -> tuple[str, str]:
    status_items = await workspace_git_status(workspace)
    status = status_items.get(rel_path, {}).get("code", "")
    if not status:
        return "", ""

    if status == "??":
        if not os.path.isfile(abs_path):
            return "", status
        code, stdout, _stderr = await run_process(
            ["git", "-C", workspace, "diff", "--no-index", "--", "/dev/null", abs_path]
        )
        if code in {0, 1}:
            return stdout.strip(), status
        return "", status

    segments: list[str] = []
    for argv in (
        ["git", "-C", workspace, "diff", "--no-ext-diff", "--", rel_path],
        ["git", "-C", workspace, "diff", "--no-ext-diff", "--cached", "--", rel_path],
    ):
        code, stdout, _stderr = await run_process(argv)
        if code == 0 and stdout.strip():
            segments.append(stdout.strip())
    merged = "\n".join(segment for segment in segments if segment).strip()
    return merged, status
