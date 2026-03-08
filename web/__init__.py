def create_web_app():
    from .server import create_web_app as _create_web_app

    return _create_web_app()


__all__ = ["create_web_app"]
