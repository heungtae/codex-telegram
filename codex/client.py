import asyncio
import subprocess
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
        self._pending: dict[int, asyncio.Future[JSONRPCResponse]] = {}
        self._event_handlers: dict[str, list[Callable]] = {}
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
        
        self._reader_task = asyncio.create_task(self._read_stream())
        logger.info("Codex app-server started")
    
    async def stop(self):
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
        
        if self._proc:
            self._proc.terminate()
            await self._proc.wait()
            logger.info("Codex app-server stopped")
    
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
        request = self.protocol.create_request(method, params)
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
    
    def _write(self, msg: JSONRPCRequest | JSONRPCNotification):
        data = self.protocol.serialize(msg)
        if self._proc and self._proc.stdin:
            self._proc.stdin.write(data.encode() + b"\n")
    
    async def _read_stream(self):
        while True:
            try:
                if not self._proc or not self._proc.stdout:
                    break
                line = await self._proc.stdout.readline()
                if not line:
                    break
                
                msg = self.protocol.deserialize(line.decode())
                if msg:
                    await self._handle_message(msg)
            except Exception as e:
                logger.error(f"Error reading stream: {e}")
                break
    
    async def _handle_message(self, msg: JSONRPCRequest | JSONRPCResponse | JSONRPCNotification):
        if isinstance(msg, JSONRPCResponse) and msg.id is not None:
            future = self._pending.pop(msg.id, None)
            if future and not future.done():
                future.set_result(msg)
        
        elif isinstance(msg, JSONRPCNotification):
            handlers = self._event_handlers.get(msg.method, [])
            for handler in handlers:
                try:
                    handler(msg.params)
                except Exception as e:
                    logger.error(f"Error in event handler for {msg.method}: {e}")


class CodexError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"Codex error {code}: {message}")
