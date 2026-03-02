import asyncio
import inspect
from typing import Any, Callable
import logging

from .protocol import Protocol, JSONRPCRequest, JSONRPCNotification, JSONRPCResponse
from utils.config import get


logger = logging.getLogger("codex-telegram.codex")


class CodexClient:
    def __init__(self):
        self.protocol = Protocol()
        self._proc: asyncio.subprocess.Process | None = None
        self._reader_task: asyncio.Task | None = None
        self._stderr_task: asyncio.Task | None = None
        self._pending: dict[int, asyncio.Future[JSONRPCResponse]] = {}
        self._pending_approvals: dict[int, asyncio.Future[str]] = {}
        self._event_handlers: dict[str, list[Callable]] = {}
        self._any_event_handlers: list[Callable] = []
        self._approval_handlers: list[Callable] = []
        self._mcp_session_auto_approve_enabled = False
        self._initialized = False
    
    async def start(self):
        command = get("codex.command", "codex")
        args = get("codex.args", ["app-server"])
        
        self._proc = await asyncio.create_subprocess_exec(
            command, *args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        self._reader_task = asyncio.create_task(self._read_stdout_stream())
        self._stderr_task = asyncio.create_task(self._read_stderr_stream())
        logger.info("Codex app-server started")
    
    async def stop(self):
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
            self._reader_task = None

        if self._stderr_task:
            self._stderr_task.cancel()
            try:
                await self._stderr_task
            except asyncio.CancelledError:
                pass
            self._stderr_task = None
        
        if self._proc:
            if self._proc.returncode is None:
                try:
                    self._proc.terminate()
                except ProcessLookupError:
                    # Process already exited between state check and terminate call.
                    pass
            try:
                await self._proc.wait()
            except ProcessLookupError:
                # Transport may already be gone; treat as stopped.
                pass
            logger.info("Codex app-server stopped")
            self._proc = None
    
    async def initialize(self, client_info: dict[str, Any]):
        result = await self.call("initialize", {
            "clientInfo": client_info,
            "capabilities": {
                "experimentalApi": True
            }
        })
        
        notification = self.protocol.create_notification("initialized")
        self._write(notification)
        
        self._initialized = True
        logger.info("Initialized with Codex app-server")
        return result
    
    async def call(self, method: str, params: dict[str, Any] | None = None) -> Any:
        request = self.protocol.create_request(method, {} if params is None else params)
        req_id = request.id
        if req_id is None:
            raise ValueError("Request ID is None")
        future: asyncio.Future[JSONRPCResponse] = asyncio.Future()
        self._pending[req_id] = future
        
        self._write(request)
        
        response = await future
        if response.error:
            raise CodexError(response.error["code"], response.error["message"])
        return response.result
    
    def on(self, method: str, handler: Callable):
        if method not in self._event_handlers:
            self._event_handlers[method] = []
        self._event_handlers[method].append(handler)

    def on_any(self, handler: Callable):
        self._any_event_handlers.append(handler)

    def on_approval_request(self, handler: Callable):
        self._approval_handlers.append(handler)

    def submit_approval_decision(self, request_id: int, decision: str) -> bool:
        future = self._pending_approvals.get(request_id)
        if future is None or future.done():
            return False
        future.set_result(decision)
        return True
    
    def _write(self, msg: JSONRPCRequest | JSONRPCNotification | JSONRPCResponse):
        data = self.protocol.serialize(msg)
        logger.debug("app-server stdin: %s", data)
        if self._proc and self._proc.stdin:
            self._proc.stdin.write(data.encode() + b"\n")
    
    async def _read_stdout_stream(self):
        while True:
            try:
                if not self._proc or not self._proc.stdout:
                    break
                line = await self._readline_unbounded(self._proc.stdout)
                if not line:
                    break

                raw = line.decode(errors="replace").rstrip("\n")
                logger.debug("app-server stdout: %s", raw)
                msg = self.protocol.deserialize(raw)
                if msg:
                    await self._handle_message(msg)
                else:
                    logger.debug("app-server stdout (non-json): %s", raw)
            except Exception as e:
                logger.error(f"Error reading stream: {e}")
                break

    async def _read_stderr_stream(self):
        while True:
            try:
                if not self._proc or not self._proc.stderr:
                    break
                line = await self._readline_unbounded(self._proc.stderr)
                if not line:
                    break
                logger.debug("app-server stderr: %s", line.decode(errors="replace").rstrip("\n"))
            except Exception as e:
                logger.error(f"Error reading stderr stream: {e}")
                break

    async def _readline_unbounded(self, stream: asyncio.StreamReader) -> bytes:
        chunks: list[bytes] = []
        while True:
            try:
                part = await stream.readuntil(b"\n")
                if chunks:
                    chunks.append(part)
                    return b"".join(chunks)
                return part
            except asyncio.LimitOverrunError as exc:
                if exc.consumed > 0:
                    chunks.append(await stream.readexactly(exc.consumed))
                    continue
                one = await stream.read(1)
                if not one:
                    return b"".join(chunks)
                chunks.append(one)
            except asyncio.IncompleteReadError as exc:
                if exc.partial:
                    chunks.append(exc.partial)
                return b"".join(chunks)
    
    async def _handle_message(self, msg: JSONRPCRequest | JSONRPCResponse | JSONRPCNotification):
        if isinstance(msg, JSONRPCResponse) and msg.id is not None:
            future = self._pending.pop(msg.id, None)
            if future and not future.done():
                future.set_result(msg)
        elif isinstance(msg, JSONRPCRequest):
            await self._handle_server_request(msg)
        
        elif isinstance(msg, JSONRPCNotification):
            for handler in self._any_event_handlers:
                try:
                    result = handler(msg.method, msg.params)
                    if inspect.isawaitable(result):
                        await result
                except Exception as e:
                    logger.error(f"Error in wildcard event handler for {msg.method}: {e}")

            handlers = self._event_handlers.get(msg.method, [])
            for handler in handlers:
                try:
                    result = handler(msg.params)
                    if inspect.isawaitable(result):
                        await result
                except Exception as e:
                    logger.error(f"Error in event handler for {msg.method}: {e}")

    async def _handle_server_request(self, msg: JSONRPCRequest):
        method = msg.method
        params = msg.params or {}
        auto_mode = str(get("approval.auto_response", "approve")).strip().lower()
        approval_mode = str(get("approval.mode", "interactive")).strip().lower()

        def _write_result(result: dict[str, Any]):
            response = self.protocol.create_response(req_id=msg.id, result=result)
            self._write(response)

        def _write_error(code: int, message: str):
            response = self.protocol.create_response(
                req_id=msg.id,
                error={"code": code, "message": message},
            )
            self._write(response)

        def _default_choice() -> str:
            if auto_mode in ("session", "approve_for_session"):
                return "session"
            if auto_mode in ("deny", "decline", "denied"):
                return "deny"
            return "approve"

        def _is_mcp_request_user_input(payload: dict[str, Any]) -> bool:
            questions = payload.get("questions")
            if not isinstance(questions, list):
                return False

            for q in questions:
                if not isinstance(q, dict):
                    continue
                question_id = q.get("id")
                if isinstance(question_id, str) and question_id.startswith("mcp_tool_call_approval_"):
                    return True

                options = q.get("options")
                if not isinstance(options, list):
                    continue

                labels: list[str] = []
                for option in options:
                    if isinstance(option, str) and option.strip():
                        labels.append(option.strip().lower())
                        continue
                    if not isinstance(option, dict):
                        continue
                    for key in ("label", "text", "title", "name"):
                        raw = option.get(key)
                        if isinstance(raw, str) and raw.strip():
                            labels.append(raw.strip().lower())
                            break

                has_once = any("run the tool and continue" in label for label in labels)
                has_session = any("remember this choice for this session" in label for label in labels)
                if has_once and has_session:
                    return True

            return False

        def _result_from_choice(choice: str) -> dict[str, Any]:
            normalized = choice.strip().lower()
            def _normalize_option_text(text: str) -> str:
                compact = " ".join(text.strip().lower().split())
                if compact.endswith("(recommended)"):
                    compact = compact[: -len("(recommended)")].strip()
                return compact

            def _collect_options(question: dict[str, Any]) -> list[Any]:
                collected: list[Any] = []

                def _add_from(raw: Any):
                    if isinstance(raw, list):
                        collected.extend(raw)
                        return
                    if isinstance(raw, dict):
                        for nested_key in ("options", "choices", "items", "values", "enum"):
                            nested = raw.get(nested_key)
                            if isinstance(nested, list):
                                collected.extend(nested)
                                return
                        for map_key, map_value in raw.items():
                            if isinstance(map_value, str):
                                collected.append({"id": str(map_key), "label": map_value, "value": str(map_key)})
                            elif isinstance(map_value, dict):
                                option_obj = dict(map_value)
                                if "id" not in option_obj:
                                    option_obj["id"] = str(map_key)
                                collected.append(option_obj)

                for key in ("options", "choices", "items", "enum", "allowedValues", "enumValues"):
                    _add_from(question.get(key))
                _add_from(question.get("input"))
                return collected

            if method in ("item/commandExecution/requestApproval", "item/fileChange/requestApproval"):
                if normalized == "session":
                    return {"decision": "acceptForSession"}
                if normalized == "deny":
                    return {"decision": "decline"}
                return {"decision": "accept"}
            if method in ("execCommandApproval", "applyPatchApproval"):
                if normalized == "session":
                    return {"decision": "approved_for_session"}
                if normalized == "deny":
                    return {"decision": "denied"}
                return {"decision": "approved"}
            if method == "item/tool/requestUserInput":
                questions = params.get("questions")
                if not isinstance(questions, list):
                    return {"answers": {}}

                # v2 app-server protocol expects an answers map keyed by question id.
                # Each question answer carries an "answers" array for future multi-select support.
                answers: dict[str, dict[str, list[str]]] = {}
                preferred_tokens = {
                    "approve": {
                        "approve",
                        "approve once",
                        "run the tool and continue.",
                        "run the tool and continue",
                        "accept",
                        "allow",
                        "yes",
                    },
                    "session": {
                        "session",
                        "approve this session",
                        "run the tool and remember this choice for this session.",
                        "run the tool and remember this choice for this session",
                        "acceptforsession",
                    },
                    "deny": {
                        "deny",
                        "decline",
                        "decline this tool call and continue.",
                        "decline this tool call and continue",
                        "cancel this tool call",
                        "reject",
                        "no",
                    },
                }
                fallback = {
                    "approve": "Approve Once",
                    "session": "Approve this Session",
                    "deny": "Deny",
                }.get(normalized, "Approve Once")
                expected = preferred_tokens.get(normalized, preferred_tokens["approve"])

                for q in questions:
                    if not isinstance(q, dict):
                        continue
                    question_id = q.get("id")
                    if not isinstance(question_id, str) or not question_id:
                        continue
                    selected_answer = fallback
                    options = _collect_options(q)
                    if not options:
                        logger.info(
                            "requestUserInput question has no parsable options; question_id=%s keys=%s",
                            question_id,
                            ",".join(sorted(q.keys())),
                        )
                    if isinstance(options, list):
                        matched_option: Any | None = None
                        first_option: Any | None = None
                        for option in options:
                            if first_option is None:
                                first_option = option
                            label: str | None = None
                            value: str | None = None
                            option_id: str | None = None
                            if isinstance(option, str):
                                if option.strip():
                                    label = option.strip()
                                    value = option.strip()
                            elif isinstance(option, dict):
                                raw_label = option.get("label")
                                raw_text = option.get("text")
                                raw_title = option.get("title")
                                raw_name = option.get("name")
                                raw_value = option.get("value")
                                raw_id = option.get("id")
                                if raw_id is None:
                                    raw_id = option.get("optionId")
                                if raw_id is None:
                                    raw_id = option.get("key")
                                if isinstance(raw_label, str) and raw_label.strip():
                                    label = raw_label.strip()
                                elif isinstance(raw_text, str) and raw_text.strip():
                                    label = raw_text.strip()
                                elif isinstance(raw_title, str) and raw_title.strip():
                                    label = raw_title.strip()
                                elif isinstance(raw_name, str) and raw_name.strip():
                                    label = raw_name.strip()
                                if isinstance(raw_value, str) and raw_value.strip():
                                    value = raw_value.strip()
                                if isinstance(raw_id, str) and raw_id.strip():
                                    option_id = raw_id.strip()
                            else:
                                continue
                            tokens: set[str] = set()
                            if label:
                                tokens.add(_normalize_option_text(label))
                            if value:
                                tokens.add(_normalize_option_text(value))
                            if option_id:
                                tokens.add(_normalize_option_text(option_id))
                            if tokens & expected:
                                matched_option = option
                                break
                        chosen = matched_option if matched_option is not None else first_option
                        if isinstance(chosen, str) and chosen.strip():
                            selected_answer = chosen.strip()
                        elif isinstance(chosen, dict):
                            raw_label = chosen.get("label")
                            raw_text = chosen.get("text")
                            raw_title = chosen.get("title")
                            raw_name = chosen.get("name")
                            raw_value = chosen.get("value")
                            raw_option_id = chosen.get("id")
                            if raw_option_id is None:
                                raw_option_id = chosen.get("optionId")
                            if raw_option_id is None:
                                raw_option_id = chosen.get("key")
                            if isinstance(raw_label, str) and raw_label.strip():
                                selected_answer = raw_label.strip()
                            elif isinstance(raw_text, str) and raw_text.strip():
                                selected_answer = raw_text.strip()
                            elif isinstance(raw_title, str) and raw_title.strip():
                                selected_answer = raw_title.strip()
                            elif isinstance(raw_name, str) and raw_name.strip():
                                selected_answer = raw_name.strip()
                            elif isinstance(raw_value, str) and raw_value.strip():
                                selected_answer = raw_value.strip()
                            elif isinstance(raw_option_id, str) and raw_option_id.strip():
                                selected_answer = raw_option_id.strip()
                    answers[question_id] = {"answers": [selected_answer]}
                return {"answers": answers}
            return {}

        def _extract_thread_id() -> str | None:
            thread_id = params.get("threadId")
            if isinstance(thread_id, str) and thread_id:
                return thread_id
            conversation_id = params.get("conversationId")
            if isinstance(conversation_id, str) and conversation_id:
                return conversation_id
            return None

        try:
            if method in (
                "item/commandExecution/requestApproval",
                "item/fileChange/requestApproval",
                "execCommandApproval",
                "applyPatchApproval",
                "item/tool/requestUserInput",
            ):
                req_id = msg.id
                if req_id is None:
                    _write_result(_result_from_choice(_default_choice()))
                    return

                if approval_mode in ("auto", "automatic"):
                    choice = _default_choice()
                    result_payload = _result_from_choice(choice)
                    _write_result(result_payload)
                    logger.info(
                        "Auto-mode approval resolved method=%s id=%s choice=%s payload=%s",
                        method,
                        req_id,
                        choice,
                        result_payload,
                    )
                    return

                if method == "item/tool/requestUserInput":
                    if self._mcp_session_auto_approve_enabled and _is_mcp_request_user_input(params):
                        choice = "session"
                        result_payload = _result_from_choice(choice)
                        _write_result(result_payload)
                        logger.info(
                            "Session auto-approval resolved method=%s id=%s choice=%s payload=%s",
                            method,
                            req_id,
                            choice,
                            result_payload,
                        )
                        return

                future: asyncio.Future[str] = asyncio.Future()
                self._pending_approvals[req_id] = future
                payload = {
                    "id": req_id,
                    "method": method,
                    "threadId": _extract_thread_id(),
                    "params": params,
                }

                for handler in self._approval_handlers:
                    try:
                        result = handler(payload)
                        if inspect.isawaitable(result):
                            await result
                    except Exception:
                        logger.exception("Error in approval request handler method=%s id=%s", method, req_id)

                decision_choice = _default_choice()
                try:
                    decision_choice = await asyncio.wait_for(future, timeout=120.0)
                except asyncio.TimeoutError:
                    logger.info(
                        "Approval request timeout; using default decision method=%s id=%s default=%s",
                        method,
                        req_id,
                        decision_choice,
                    )
                finally:
                    self._pending_approvals.pop(req_id, None)

                if method == "item/tool/requestUserInput" and _is_mcp_request_user_input(params):
                    if decision_choice == "session":
                        if not self._mcp_session_auto_approve_enabled:
                            logger.info(
                                "Enabled MCP session auto-approval after request id=%s",
                                req_id,
                            )
                        self._mcp_session_auto_approve_enabled = True
                    elif decision_choice == "deny" and self._mcp_session_auto_approve_enabled:
                        self._mcp_session_auto_approve_enabled = False
                        logger.info(
                            "Disabled MCP session auto-approval after deny decision id=%s",
                            req_id,
                        )

                result_payload = _result_from_choice(decision_choice)
                _write_result(result_payload)
                logger.info(
                    "Resolved approval request method=%s id=%s choice=%s payload=%s",
                    method,
                    req_id,
                    decision_choice,
                    result_payload,
                )
                return

            logger.warning(
                "Unhandled server request method=%s id=%s params=%s",
                method,
                msg.id,
                params,
            )
            _write_error(-32601, f"Unsupported server request method: {method}")
        except Exception:
            logger.exception("Failed to handle server request method=%s id=%s", method, msg.id)
            _write_error(-32000, f"Failed to handle server request: {method}")


class CodexError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"Codex error {code}: {message}")
