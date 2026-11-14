import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI, HTTPException

from web.routes import register_project_routes


class ProjectRouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        register_project_routes(app)
        self.modify = next(route.endpoint for route in app.routes if "PUT" in getattr(route, "methods", set()))
        self.add = next(route.endpoint for route in app.routes if getattr(route, "path", "") == "/api/projects" and "POST" in route.methods)

    def test_modify_saves_default_and_reloads(self):
        with (
            patch("web.routes.session_from_request", new=AsyncMock(return_value=SimpleNamespace(user_id=1))),
            patch("web.routes.update_project_profile") as save,
            patch("web.routes.reload") as reload_config,
            patch("web.routes.route_command", new=AsyncMock(return_value={"ok": True})),
        ):
            result = asyncio.run(self.modify("alpha", {"name": "Alpha", "path": "/alpha", "default": True}, object()))
        save.assert_called_once_with("alpha", "Alpha", "/alpha", make_default=True)
        reload_config.assert_called_once()
        self.assertTrue(result["ok"])

    def test_add_can_set_default(self):
        with (
            patch("web.routes.session_from_request", new=AsyncMock(return_value=SimpleNamespace(user_id=1))),
            patch("web.routes.save_project_profile") as save,
            patch("web.routes.reload"),
            patch("web.routes.route_command", new=AsyncMock(return_value={})),
        ):
            asyncio.run(self.add({"key": "alpha", "name": "Alpha", "path": "/alpha", "default": True}, object()))
        save.assert_called_once_with("alpha", "Alpha", "/alpha", make_default=True)

    def test_modify_reports_invalid_project(self):
        with (
            patch("web.routes.session_from_request", new=AsyncMock(return_value=SimpleNamespace(user_id=1))),
            patch("web.routes.update_project_profile", side_effect=ValueError("not found")),
            patch("web.routes.reload") as reload_config,
        ):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(self.modify("missing", {"name": "Name", "path": "/path"}, object()))
        self.assertEqual(400, raised.exception.status_code)
        reload_config.assert_not_called()

    def test_modify_requires_authentication_before_writing(self):
        with (
            patch("web.routes.session_from_request", new=AsyncMock(side_effect=HTTPException(401))),
            patch("web.routes.update_project_profile") as save,
        ):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(self.modify("alpha", {"name": "Name", "path": "/path"}, object()))
        self.assertEqual(401, raised.exception.status_code)
        save.assert_not_called()
