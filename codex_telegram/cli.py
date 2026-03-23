import argparse
import logging
import os
import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType


def _get_version() -> str:
    from codex_telegram import __version__

    return __version__


def _load_root_main_module() -> ModuleType:
    root_main = Path(__file__).resolve().parent.parent / "main.py"
    spec = spec_from_file_location("codex_telegram_root_main", root_main)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load entrypoint module from {root_main}")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
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
