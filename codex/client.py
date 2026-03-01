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
        self._event_handlers: dict[str, list[Callable]] = {}
        self._any_event_handlers: list[Callable] = []
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
                line = await self._proc.stdout.readline()
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
                line = await self._proc.stderr.readline()
                if not line:
                    break
                logger.debug("app-server stderr: %s", line.decode(errors="replace").rstrip("\n"))
            except Exception as e:
                logger.error(f"Error reading stderr stream: {e}")
                break
    
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

        def _write_result(result: dict[str, Any]):
            response = self.protocol.create_response(req_id=msg.id, result=result)
            self._write(response)

        def _write_error(code: int, message: str):
            response = self.protocol.create_response(
                req_id=msg.id,
                error={"code": code, "message": message},
            )
            self._write(response)

        try:
            if method in ("item/commandExecution/requestApproval", "item/fileChange/requestApproval"):
                if auto_mode in ("approve", "accept", "allow"):
                    _write_result({"decision": "accept"})
                    logger.info("Auto-approved server request method=%s id=%s", method, msg.id)
                    return
                if auto_mode in ("session", "approve_for_session"):
                    _write_result({"decision": "acceptForSession"})
                    logger.info("Auto-approved-for-session server request method=%s id=%s", method, msg.id)
                    return
                _write_result({"decision": "decline"})
                logger.info("Auto-declined server request method=%s id=%s", method, msg.id)
                return

            if method in ("execCommandApproval", "applyPatchApproval"):
                if auto_mode in ("approve", "accept", "allow"):
                    _write_result({"decision": "approved"})
                    logger.info("Auto-approved legacy server request method=%s id=%s", method, msg.id)
                    return
                if auto_mode in ("session", "approve_for_session"):
                    _write_result({"decision": "approved_for_session"})
                    logger.info(
                        "Auto-approved-for-session legacy server request method=%s id=%s",
                        method,
                        msg.id,
                    )
                    return
                _write_result({"decision": "denied"})
                logger.info("Auto-denied legacy server request method=%s id=%s", method, msg.id)
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
