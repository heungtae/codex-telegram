import json
from typing import Any, Callable
from dataclasses import dataclass


@dataclass
class JSONRPCRequest:
    method: str
    params: dict[str, Any] | None = None
    id: int | None = None

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"method": self.method}
        if self.params:
            result["params"] = self.params
        if self.id is not None:
            result["id"] = self.id
        return result
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "JSONRPCRequest":
        return cls(
            method=data.get("method", ""),
            params=data.get("params"),
            id=data.get("id"),
        )


@dataclass
class JSONRPCResponse:
    id: int | None
    result: Any = None
    error: dict[str, Any] | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "JSONRPCResponse":
        return cls(
            id=data.get("id"),
            result=data.get("result"),
            error=data.get("error"),
        )


@dataclass
class JSONRPCNotification:
    method: str
    params: dict[str, Any] | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "JSONRPCNotification":
        return cls(
            method=data.get("method", ""),
            params=data.get("params"),
        )
    
    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"method": self.method}
        if self.params:
            result["params"] = self.params
        return result


class Protocol:
    def __init__(self):
        self._request_id = 0
    
    def next_id(self) -> int:
        self._request_id += 1
        return self._request_id
    
    def create_request(self, method: str, params: dict[str, Any] | None = None) -> JSONRPCRequest:
        return JSONRPCRequest(
            method=method,
            params=params,
            id=self.next_id(),
        )
    
    def create_notification(self, method: str, params: dict[str, Any] | None = None) -> JSONRPCNotification:
        return JSONRPCNotification(method=method, params=params)
    
    def serialize(self, msg: JSONRPCRequest | JSONRPCNotification) -> str:
        return json.dumps(msg.to_dict())
    
    def deserialize(self, data: str) -> JSONRPCRequest | JSONRPCResponse | JSONRPCNotification | None:
        try:
            obj = json.loads(data)
        except json.JSONDecodeError:
            return None
        
        if "id" not in obj:
            return JSONRPCNotification.from_dict(obj)
        
        if "result" in obj or "error" in obj:
            return JSONRPCResponse.from_dict(obj)
        
        return JSONRPCRequest.from_dict(obj)
