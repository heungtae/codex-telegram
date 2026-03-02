import errno
import hashlib
import os
import signal
import time
from pathlib import Path

import fcntl


def token_lock_key(token: str) -> str:
    normalized = (token or "").strip().encode("utf-8")
    return hashlib.sha256(normalized).hexdigest()[:16]


class SingleInstanceLock:
    def __init__(self, name: str, directory: str = "/tmp"):
        self.path = Path(directory) / f"{name}.lock"
        self._file = None

    def acquire(self) -> bool:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._file = self.path.open("a+", encoding="utf-8")
        try:
            fcntl.flock(self._file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            if exc.errno in (errno.EACCES, errno.EAGAIN):
                self._file.close()
                self._file = None
                return False
            raise
        self._file.seek(0)
        self._file.truncate(0)
        self._file.write(str(os.getpid()))
        self._file.flush()
        return True

    def release(self):
        if self._file is None:
            return
        fcntl.flock(self._file.fileno(), fcntl.LOCK_UN)
        self._file.close()
        self._file = None

    def read_owner_pid(self) -> int | None:
        if not self.path.exists():
            return None
        try:
            raw = self.path.read_text(encoding="utf-8").strip()
            if not raw:
                return None
            pid = int(raw)
            return pid if pid > 0 else None
        except (OSError, ValueError):
            return None

    def is_owner_alive(self) -> bool:
        pid = self.read_owner_pid()
        if pid is None:
            return False
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False

    def terminate_owner(self, timeout_seconds: float = 5.0) -> bool:
        pid = self.read_owner_pid()
        if pid is None or pid == os.getpid():
            return False
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            return True
        except OSError:
            return False
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            if not self.is_owner_alive():
                return True
            time.sleep(0.1)
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            return True
        except OSError:
            return False
        return not self.is_owner_alive()


def _read_proc_cmdline(pid: int) -> str:
    try:
        raw = Path(f"/proc/{pid}/cmdline").read_bytes()
    except OSError:
        return ""
    return raw.replace(b"\x00", b" ").decode("utf-8", errors="replace").strip()


def _read_proc_environ(pid: int) -> str:
    try:
        raw = Path(f"/proc/{pid}/environ").read_bytes()
    except OSError:
        return ""
    return raw.replace(b"\x00", b"\n").decode("utf-8", errors="replace")


def _is_same_user_process(pid: int) -> bool:
    try:
        st = Path(f"/proc/{pid}").stat()
    except OSError:
        return False
    return st.st_uid == os.getuid()


def find_local_conflict_candidates(token: str, exclude_pid: int | None = None) -> list[tuple[int, str]]:
    token = (token or "").strip()
    if not token:
        return []

    candidates: list[tuple[int, str]] = []
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        pid = int(entry.name)
        if exclude_pid is not None and pid == exclude_pid:
            continue
        if not _is_same_user_process(pid):
            continue

        cmdline = _read_proc_cmdline(pid)
        if not cmdline:
            continue
        environ = _read_proc_environ(pid)
        token_match = f"TELEGRAM_BOT_TOKEN={token}" in environ
        lowered = cmdline.lower()
        bot_pattern_match = "python3 main.py" in lowered or "python main.py" in lowered or "codex-telegram" in lowered
        token_poller_match = token_match and (
            ("python" in lowered and "main.py" in lowered)
            or "telegram" in lowered
        )
        if not token_poller_match and not bot_pattern_match:
            continue
        reason = "env-token" if token_poller_match else "cmd-pattern"
        candidates.append((pid, f"{reason}: {cmdline}"))

    candidates.sort(key=lambda item: item[0])
    return candidates


def terminate_pid(pid: int, timeout_seconds: float = 5.0) -> bool:
    if pid <= 0 or pid == os.getpid():
        return False
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return True
    except OSError:
        return False

    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return True
        except OSError:
            return False
        time.sleep(0.1)
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        return True
    except OSError:
        return False
    try:
        os.kill(pid, 0)
        return False
    except ProcessLookupError:
        return True
