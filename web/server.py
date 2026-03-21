import logging

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from codex_telegram import __version__
from utils.config import get_guardian_settings, save_guardian_settings
from utils.local_command import run_bang_command
from web import routes as route_module
from web.dependencies import resolved_assets_dir

logger = logging.getLogger("codex-telegram.web")


def create_web_app() -> FastAPI:
    route_module.run_bang_command = run_bang_command
    route_module.get_guardian_settings = get_guardian_settings
    route_module.save_guardian_settings = save_guardian_settings
    app = FastAPI(title="Codex Web", version=__version__)
    app.mount("/assets", StaticFiles(directory=str(resolved_assets_dir())), name="assets")
    route_module.register_web_routes(app)
    return app
