from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType
from typing import Callable


def _load_root_main_module() -> ModuleType:
    root_main = Path(__file__).resolve().parent.parent / "main.py"
    spec = spec_from_file_location("codex_telegram_root_main", root_main)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load entrypoint module from {root_main}")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    module = _load_root_main_module()
    target = getattr(module, "main", None)
    if not callable(target):
        raise RuntimeError("Entrypoint module does not expose callable main()")
    runner = target
    return int(runner())
