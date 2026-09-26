import argparse
import json
import logging
import os
import sys
import urllib.error
import urllib.request
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType


def _get_version() -> str:
    from codex_telegram import __version__

    return __version__


def _check_for_update(current_version: str) -> str | None:
    """Check PyPI for the latest version. Returns latest version if newer, else None."""
    url = "https://pypi.org/pypi/codex-telegram/json"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "codex-telegram"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.load(resp)
            latest = data["info"]["version"]
            if _version_gt(latest, current_version):
                return latest
    except (urllib.error.URLError, json.JSONDecodeError, KeyError, TimeoutError):
        pass
    return None


def _version_gt(v1: str, v2: str) -> bool:
    """Compare version strings (simple tuple comparison)."""
    def parse(v: str):
        return tuple(int(x) for x in v.split(".") if x.isdigit())
    return parse(v1) > parse(v2)


def _is_venv() -> bool:
    """Check if running inside a virtual environment."""
    return hasattr(sys, "real_prefix") or (hasattr(sys, "base_prefix") and sys.base_prefix != sys.prefix)


def _prompt_update(latest: str) -> bool:
    """Prompt user to update. Returns True if user chooses to update."""
    print(f"\n✨ Update available! {_get_version()} -> {latest}")
    print("  Release notes: https://github.com/heungtae/codex-telegram/releases/latest")
    print()
    in_venv = _is_venv()
    if in_venv:
        print("  1. Update now and exit (runs `pip install -U codex-telegram`)")
    else:
        print("  1. Update now and exit (runs `pip install -U codex-telegram --break-system-packages`)")
        print("     Note: Not in a virtual environment. Consider using `pipx install codex-telegram` instead.")
    print("  2. Skip this run")
    print("  3. Skip this version")
    print()
    try:
        choice = input("  Choose [1/2/3] (default: 2): ").strip() or "2"
    except (EOFError, KeyboardInterrupt):
        return False
    return choice == "1"


def _load_root_main_module() -> ModuleType:
    root_main = Path(__file__).resolve().parent.parent / "main.py"
    spec = spec_from_file_location("codex_telegram_root_main", root_main)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load entrypoint module from {root_main}")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    if "--version" not in sys.argv and "--validate-config" not in sys.argv and "--debug" not in sys.argv:
        current = _get_version()
        latest = _check_for_update(current)
        if latest and _prompt_update(latest):
            in_venv = _is_venv()
            pip_args = [sys.executable, "-m", "pip", "install", "-U", "codex-telegram"]
            if not in_venv:
                pip_args.append("--break-system-packages")
            print(f"Running: {' '.join(pip_args)}")
            os.execvpe(sys.executable, pip_args, os.environ)
            return 0

    parser = argparse.ArgumentParser(
        prog="codex-telegram",
        description="Codex Telegram Bot - Bridges Codex App Server with Telegram and Web UI.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  codex-telegram                  Run with default config
  codex-telegram --config /path/to/conf.toml
  codex-telegram --web-only        Run web UI only (no Telegram polling)
  codex-telegram --validate-config Validate configuration and exit
  codex-telegram --debug           Enable debug logging
        """,
    )
    parser.add_argument(
        "-c",
        "--config",
        type=str,
        metavar="PATH",
        help="Path to configuration file (default: ~/.config/codex-telegram/conf.toml or ./conf.toml)",
    )
    parser.add_argument(
        "--web-only",
        action="store_true",
        help="Run web UI only, without Telegram bot polling",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug level logging",
    )
    parser.add_argument(
        "--validate-config",
        action="store_true",
        help="Validate configuration file and exit (no startup)",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {_get_version()}",
    )

    args = parser.parse_args()

    if args.config:
        os.environ["CODEX_CONFIG_PATH"] = args.config

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.validate_config:
        return _validate_config()

    if args.web_only:
        os.environ["CODEX_WEB_ONLY"] = "1"

    module = _load_root_main_module()
    target = getattr(module, "main", None)
    if not callable(target):
        raise RuntimeError("Entrypoint module does not expose callable main()")
    runner = target
    return int(runner())


def _validate_config() -> int:
    try:
        from utils.config import load
        from utils.config import get_config_path

        config_path = get_config_path()
        print(f"Validating config file: {config_path}")
        config = load()
        print(f"Config loaded successfully: {len(config)} top-level keys")
        return 0
    except Exception as e:
        print(f"Config validation failed: {e}", file=sys.stderr)
        return 1
