import logging
import threading

logger = logging.getLogger("codex-telegram")


class WebServerThread:
    def __init__(self, host: str, port: int, app_factory):
        self.host = host
        self.port = port
        self.app_factory = app_factory
        self.server = None

    def run(self):
        try:
            import uvicorn

            app = self.app_factory()
            config = uvicorn.Config(app, host=self.host, port=self.port, log_level="info", access_log=False)
            self.server = uvicorn.Server(config)
            self.server.run()
        except Exception:
            logger.exception("Failed to start Web UI server")

    def stop(self):
        if self.server is not None:
            self.server.should_exit = True


def stop_web_server(server: WebServerThread | None, thread: threading.Thread | None) -> None:
    if server is not None:
        server.stop()
    if thread is not None:
        thread.join(timeout=3)
