import asyncio
import unittest
import threading
from unittest.mock import patch
from types import SimpleNamespace

from codex.client import CodexClient
from codex.protocol import JSONRPCRequest, JSONRPCNotification


class CodexClientServerRequestTests(unittest.IsolatedAsyncioTestCase):
    def test_write_does_not_require_flush_on_asyncio_stream_writer(self):
        client = CodexClient()
        written = []

        class _DummyStdin:
            def write(self, data):
                written.append(data)

        client._proc = SimpleNamespace(stdin=_DummyStdin())

        client._write(JSONRPCNotification(method="initialized"))

        self.assertEqual([b'{"method": "initialized"}\n'], written)

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

    async def test_submit_approval_decision_is_thread_safe(self):
        client = CodexClient()
        written = []
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]
        req = JSONRPCRequest(
            method="item/commandExecution/requestApproval",
            id=42,
            params={"threadId": "thread-1"},
        )

        with patch(
            "codex.client.get",
            side_effect=lambda key, default=None: "interactive" if key == "approval.mode" else "approve" if key == "approval.auto_response" else default,
        ):
            task = asyncio.create_task(client._handle_server_request(req))
            for _ in range(100):
                if 42 in client._pending_approvals:
                    break
                await asyncio.sleep(0.01)
            else:
                self.fail("approval request was not registered")

            accepted = {}

            def approve_from_thread():
                accepted["value"] = client.submit_approval_decision(42, "approve")

            thread = threading.Thread(target=approve_from_thread)
            thread.start()
            thread.join()

            await asyncio.wait_for(task, timeout=1.0)

        self.assertTrue(accepted["value"])
        self.assertEqual(1, len(written))
        response = written[0].to_dict()
        self.assertEqual(42, response.get("id"))
        self.assertEqual({"decision": "accept"}, response.get("result"))

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

    async def test_tool_request_user_input_maps_mcp_label_for_session(self):
        client = CodexClient()
        written = []
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]
        req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=14,
            params={
                "questions": [
                    {
                        "id": "q8",
                        "options": [
                            {"label": "Run the tool and continue.", "description": "Approve once."},
                            {
                                "label": "Run the tool and remember this choice for this session.",
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
                "auto" if key == "approval.mode" else "session" if key == "approval.auto_response" else default
            ),
        ):
            await client._handle_server_request(req)

        response = written[0].to_dict()
        answers = ((response.get("result") or {}).get("answers") or {})
        self.assertEqual(
            {"answers": ["Run the tool and remember this choice for this session."]},
            answers.get("q8"),
        )

    async def test_mcp_session_auto_approve_is_enabled_after_session_choice(self):
        client = CodexClient()
        written = []
        approval_handler_calls = {"count": 0}
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]

        def approval_handler(payload):
            approval_handler_calls["count"] += 1
            client.submit_approval_decision(payload["id"], "session")

        client.on_approval_request(approval_handler)

        first_req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=15,
            params={
                "questions": [
                    {
                        "id": "mcp_tool_call_approval_call_first",
                        "options": [
                            {"label": "Run the tool and continue.", "description": "Approve once."},
                            {
                                "label": "Run the tool and remember this choice for this session.",
                                "description": "Remember choice for this session.",
                            },
                            {"label": "Decline this tool call and continue.", "description": "Skip tool call."},
                        ],
                    }
                ]
            },
        )
        second_req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=16,
            params={
                "questions": [
                    {
                        "id": "mcp_tool_call_approval_call_second",
                        "options": [
                            {"label": "Run the tool and continue.", "description": "Approve once."},
                            {
                                "label": "Run the tool and remember this choice for this session.",
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
                "interactive" if key == "approval.mode" else "approve" if key == "approval.auto_response" else default
            ),
        ):
            await client._handle_server_request(first_req)
            await client._handle_server_request(second_req)

        self.assertTrue(client._mcp_session_auto_approve_enabled)
        self.assertEqual(1, approval_handler_calls["count"])

        first_answers = ((written[0].to_dict().get("result") or {}).get("answers") or {})
        second_answers = ((written[1].to_dict().get("result") or {}).get("answers") or {})
        expected = {"answers": ["Run the tool and remember this choice for this session."]}
        self.assertEqual(expected, first_answers.get("mcp_tool_call_approval_call_first"))
        self.assertEqual(expected, second_answers.get("mcp_tool_call_approval_call_second"))

    async def test_mcp_session_auto_approve_does_not_apply_to_non_mcp_question(self):
        client = CodexClient()
        client._mcp_session_auto_approve_enabled = True
        written = []
        approval_handler_calls = {"count": 0}
        client._write = lambda msg: written.append(msg)  # type: ignore[method-assign]

        def approval_handler(payload):
            approval_handler_calls["count"] += 1
            client.submit_approval_decision(payload["id"], "approve")

        client.on_approval_request(approval_handler)

        req = JSONRPCRequest(
            method="item/tool/requestUserInput",
            id=17,
            params={
                "questions": [
                    {
                        "id": "q9",
                        "options": [
                            {"label": "A", "description": "option A"},
                            {"label": "B", "description": "option B"},
                        ],
                    }
                ]
            },
        )

        with patch(
            "codex.client.get",
            side_effect=lambda key, default=None: (
                "interactive" if key == "approval.mode" else "approve" if key == "approval.auto_response" else default
            ),
        ):
            await client._handle_server_request(req)

        self.assertEqual(1, approval_handler_calls["count"])
        answers = ((written[0].to_dict().get("result") or {}).get("answers") or {})
        self.assertEqual({"answers": ["A"]}, answers.get("q9"))


if __name__ == "__main__":
    unittest.main()
