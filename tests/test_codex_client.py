import unittest
from unittest.mock import patch

from codex.client import CodexClient
from codex.protocol import JSONRPCRequest


class CodexClientServerRequestTests(unittest.IsolatedAsyncioTestCase):
    async def test_tool_request_user_input_auto_approve_maps_to_approve_once(self):
        client = CodexClient()
        written = []
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]
        req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=7,
            params={
                "questions": [
                    {
                        "id": "q1",
                        "options": [
                            {"label": "Approve Once"},
                            {"label": "Approve this Session"},
                            {"label": "Deny"},
                        ],
                    }
                ]
            },
        )

        with patch(
            "codex.client.get",
            side_effect=lambda key, default=None: (
                "auto" if key == "approval.mode" else "approve" if key == "approval.auto_response" else default
            ),
        ):
            await client._handle_server_request(req)

        self.assertEqual(1, len(written))
        response = written[0].to_dict()
        self.assertEqual(7, response.get("id"))
        answers = ((response.get("result") or {}).get("answers") or [])
        self.assertEqual("q1", answers[0].get("id"))
        self.assertEqual("Approve Once", answers[0].get("answer"))

    async def test_tool_request_user_input_auto_session_maps_to_session_option(self):
        client = CodexClient()
        written = []
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]
        req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=8,
            params={
                "questions": [
                    {
                        "id": "q2",
                        "options": [
                            {"label": "Approve Once"},
                            {"label": "Approve this Session"},
                            {"label": "Deny"},
                        ],
                    }
                ]
            },
        )

        with patch(
            "codex.client.get",
            side_effect=lambda key, default=None: (
                "auto" if key == "approval.mode" else "session" if key == "approval.auto_response" else default
            ),
        ):
            await client._handle_server_request(req)

        response = written[0].to_dict()
        answers = ((response.get("result") or {}).get("answers") or [])
        self.assertEqual("Approve this Session", answers[0].get("answer"))


if __name__ == "__main__":
    unittest.main()
