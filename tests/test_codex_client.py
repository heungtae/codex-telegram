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
        answers = ((response.get("result") or {}).get("answers") or {})
        self.assertEqual({"answers": ["Approve Once"]}, answers.get("q1"))

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
        answers = ((response.get("result") or {}).get("answers") or {})
        self.assertEqual({"answers": ["Approve this Session"]}, answers.get("q2"))

    async def test_tool_request_user_input_prefers_option_value_when_present(self):
        client = CodexClient()
        written = []
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]
        req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=9,
            params={
                "questions": [
                    {
                        "id": "q3",
                        "options": [
                            {"id": "opt_deny", "label": "Deny", "value": "deny"},
                            {
                                "id": "opt_approve",
                                "label": "Approve Once (Recommended)",
                                "value": "approve_once",
                            },
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

        response = written[0].to_dict()
        answers = ((response.get("result") or {}).get("answers") or {})
        self.assertEqual({"answers": ["Approve Once (Recommended)"]}, answers.get("q3"))

    async def test_tool_request_user_input_supports_string_options(self):
        client = CodexClient()
        written = []
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]
        req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=10,
            params={
                "questions": [
                    {
                        "id": "q4",
                        "options": [
                            "Deny",
                            "Approve Once",
                            "Approve this Session",
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

        response = written[0].to_dict()
        answers = ((response.get("result") or {}).get("answers") or {})
        self.assertEqual({"answers": ["Approve Once"]}, answers.get("q4"))

    async def test_tool_request_user_input_supports_choices_dict_shape(self):
        client = CodexClient()
        written = []
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]
        req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=11,
            params={
                "questions": [
                    {
                        "id": "q5",
                        "choices": [
                            {"id": "deny", "title": "Deny", "value": "deny"},
                            {
                                "id": "approve_once",
                                "title": "Approve Once (Recommended)",
                                "value": "approve_once",
                            },
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

        response = written[0].to_dict()
        answers = ((response.get("result") or {}).get("answers") or {})
        self.assertEqual({"answers": ["Approve Once (Recommended)"]}, answers.get("q5"))

    async def test_tool_request_user_input_supports_option_id_alias(self):
        client = CodexClient()
        written = []
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]
        req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=12,
            params={
                "questions": [
                    {
                        "id": "q6",
                        "options": [
                            {"optionId": "deny", "label": "Deny", "value": "deny"},
                            {
                                "optionId": "approve_once",
                                "label": "Approve Once",
                                "value": "approve_once",
                            },
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

        response = written[0].to_dict()
        answers = ((response.get("result") or {}).get("answers") or {})
        self.assertEqual({"answers": ["Approve Once"]}, answers.get("q6"))

    async def test_tool_request_user_input_maps_mcp_label_for_approve(self):
        client = CodexClient()
        written = []
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]
        req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=13,
            params={
                "questions": [
                    {
                        "id": "q7",
                        "options": [
                            {"label": "Run the tool and continue.", "description": "Approve once."},
                            {
                                "label": "Approve this Session",
                                "description": "Remember choice for this session.",
                            },
                            {"label": "Decline this tool call and continue.", "description": "Skip tool call."},
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

        response = written[0].to_dict()
        answers = ((response.get("result") or {}).get("answers") or {})
        self.assertEqual({"answers": ["Run the tool and continue."]}, answers.get("q7"))


if __name__ == "__main__":
    unittest.main()
