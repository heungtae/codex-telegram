import logging
import threading

logger = logging.getLogger("codex-telegram")


class WebServerThread:
    def __init__(self, host: str, port: int, app_factory, ssl_enabled: bool = False, ssl_certfile: str = "", ssl_keyfile: str = ""):
        self.host = host
        self.port = port
        self.app_factory = app_factory
        self.ssl_enabled = ssl_enabled
        self.ssl_certfile = ssl_certfile
        self.ssl_keyfile = ssl_keyfile
        self.server = None

    def run(self):
        try:
            import uvicorn

            app = self.app_factory()
            ssl_args = {}
            if self.ssl_enabled and self.ssl_certfile and self.ssl_keyfile:
                ssl_args["ssl_certfile"] = self.ssl_certfile
                ssl_args["ssl_keyfile"] = self.ssl_keyfile
                logger.info("Web UI HTTPS enabled with cert=%s key=%s", self.ssl_certfile, self.ssl_keyfile)
            config = uvicorn.Config(
                app, host=self.host, port=self.port, log_level="info", access_log=False, **ssl_args
            )
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
