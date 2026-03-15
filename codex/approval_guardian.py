import asyncio
import json
import logging
import time
from dataclasses import dataclass
from typing import Any

from codex_telegram import __version__

from .client import CodexClient


logger = logging.getLogger("codex-telegram.guardian")


@dataclass(slots=True)
class GuardianDecision:
    choice: str
    risk_level: str
    confidence: str
    summary: str
    chain: str
    raw_text: str


class ApprovalGuardianService:
    def __init__(self):
        self._client: CodexClient | None = None
        self._lock = asyncio.Lock()
        self._collecting = False
        self._active_turn_id: str | None = None
        self._active_buffer: list[str] = []
        self._done_event = asyncio.Event()
        self._active_thread_id: str | None = None
        self._delta_count = 0
        self._last_delta_preview = ""

    async def start(self):
        if self._client is not None:
            return
        client = CodexClient()
        await client.start()
        await client.initialize(
            {
                "name": "codex-telegram-guardian",
                "title": "Codex Telegram Guardian",
                "version": __version__,
            }
        )

        def _auto_deny_nested_approvals(payload: dict[str, Any]):
            req_id = payload.get("id")
            if isinstance(req_id, int):
                client.submit_approval_decision(req_id, "deny")
                logger.info("Guardian denied nested approval id=%s", req_id)

        client.on_approval_request(_auto_deny_nested_approvals)
        client.on_any(self._on_guardian_event)
        self._client = client
        logger.info("Guardian app-server initialized")

    async def stop(self):
        if self._client is None:
            return
        await self._client.stop()
        self._client = None
        logger.info("Guardian app-server stopped")

    async def review(self, payload: dict[str, Any], timeout_seconds: int) -> GuardianDecision:
        async with self._lock:
            started_at = time.monotonic()
            await self.start()
            if self._client is None:
                raise RuntimeError("Guardian client is not initialized")

            prompt = self._build_prompt(payload)
            prompt_preview = prompt[:400] + ("...(truncated)" if len(prompt) > 400 else "")
            logger.debug(
                "Guardian review start timeout=%ss method=%s request_id=%s prompt=%s",
                timeout_seconds,
                payload.get("method"),
                payload.get("id"),
                prompt_preview,
            )
            thread_result = await self._client.call("thread/start", {})
            thread_started_at = time.monotonic()
            thread_id = thread_result.get("thread", {}).get("id")
            if not isinstance(thread_id, str) or not thread_id:
                raise RuntimeError("Guardian failed to start thread")
            self._active_thread_id = thread_id
            logger.debug(
                "Guardian thread started thread_id=%s elapsed_ms=%s",
                thread_id,
                int((thread_started_at - started_at) * 1000),
            )

            self._active_buffer = []
            self._active_turn_id = None
            self._done_event.clear()
            self._collecting = True
            self._delta_count = 0
            self._last_delta_preview = ""
            try:
                turn_result = await self._client.call(
                    "turn/start",
                    {
                        "threadId": thread_id,
                        "input": [{"type": "text", "text": prompt}],
                    },
                )
                turn_started_at = time.monotonic()
                turn_id = turn_result.get("turn", {}).get("id")
                if isinstance(turn_id, str) and turn_id:
                    self._active_turn_id = turn_id
                logger.debug(
                    "Guardian turn started thread_id=%s turn_id=%s elapsed_ms=%s wait_timeout_s=%s",
                    thread_id,
                    self._active_turn_id,
                    int((turn_started_at - started_at) * 1000),
                    max(1, int(timeout_seconds)),
                )

                try:
                    await asyncio.wait_for(self._done_event.wait(), timeout=max(1, int(timeout_seconds)))
                except asyncio.TimeoutError:
                    logger.debug(
                        "Guardian wait timeout thread_id=%s turn_id=%s waited_s=%s delta_count=%s last_delta=%s total_elapsed_ms=%s",
                        thread_id,
                        self._active_turn_id,
                        max(1, int(timeout_seconds)),
                        self._delta_count,
                        self._last_delta_preview,
                        int((time.monotonic() - started_at) * 1000),
                    )
                    raise
                text = "".join(self._active_buffer).strip()
                if not text:
                    logger.debug(
                        "Guardian response buffer empty; reading thread thread_id=%s turn_id=%s delta_count=%s",
                        thread_id,
                        self._active_turn_id,
                        self._delta_count,
                    )
                    text = await self._fallback_read_turn_text(thread_id)
                if not text:
                    raise ValueError("Guardian produced an empty response")
                decision = self._parse_decision(text)
                logger.debug(
                    "Guardian decision thread_id=%s turn_id=%s choice=%s risk=%s confidence=%s total_elapsed_ms=%s",
                    thread_id,
                    self._active_turn_id,
                    decision.choice,
                    decision.risk_level,
                    decision.confidence,
                    int((time.monotonic() - started_at) * 1000),
                )
                return decision
            finally:
                self._collecting = False
                self._active_turn_id = None
                self._active_thread_id = None
                self._delta_count = 0
                self._last_delta_preview = ""
                self._done_event.clear()

    def _on_guardian_event(self, method: str, params: dict | None):
        if not self._collecting:
            return
        payload = params or {}
        if method == "item/agentMessage/delta":
            text = self._extract_text(payload)
            if text:
                self._active_buffer.append(text)
                self._delta_count += 1
                self._last_delta_preview = text[:200] + ("...(truncated)" if len(text) > 200 else "")
                logger.debug(
                    "Guardian delta thread_id=%s turn_id=%s delta_count=%s text=%s",
                    self._active_thread_id,
                    self._active_turn_id,
                    self._delta_count,
                    self._last_delta_preview,
                )
            return
        if method in ("turn/completed", "turn/failed", "turn/cancelled"):
            current_turn = self._extract_turn_id(payload)
            if self._active_turn_id and current_turn and current_turn != self._active_turn_id:
                logger.debug(
                    "Guardian ignoring terminal event method=%s active_turn_id=%s event_turn_id=%s",
                    method,
                    self._active_turn_id,
                    current_turn,
                )
                return
            logger.debug(
                "Guardian terminal event method=%s thread_id=%s turn_id=%s delta_count=%s",
                method,
                self._active_thread_id,
                current_turn or self._active_turn_id,
                self._delta_count,
            )
            self._done_event.set()

    def _extract_text(self, payload: dict[str, Any]) -> str | None:
        for key in ("delta", "text", "message"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value
        item = payload.get("item")
        if isinstance(item, dict):
            value = item.get("text")
            if isinstance(value, str) and value.strip():
                return value
        msg = payload.get("msg")
        if isinstance(msg, dict):
            for key in ("message", "text"):
                value = msg.get(key)
                if isinstance(value, str) and value.strip():
                    return value
        return None

    def _extract_turn_id(self, payload: dict[str, Any]) -> str | None:
        turn = payload.get("turn")
        if isinstance(turn, dict):
            turn_id = turn.get("id")
            if isinstance(turn_id, str) and turn_id:
                return turn_id
        turn_id = payload.get("turnId")
        if isinstance(turn_id, str) and turn_id:
            return turn_id
        event_id = payload.get("id")
        if isinstance(event_id, str) and event_id:
            return event_id
        return None

    async def _fallback_read_turn_text(self, thread_id: str) -> str:
        if self._client is None:
            return ""
        try:
            result = await self._client.call("thread/read", {"threadId": thread_id, "includeTurns": True})
        except Exception:
            return ""

        thread = result.get("thread", {})
        turns = result.get("turns")
        turn_entries: list[dict[str, Any]] = []
        if isinstance(turns, list):
            turn_entries.extend([t for t in turns if isinstance(t, dict)])
        thread_turns = thread.get("turns")
        if isinstance(thread_turns, list):
            turn_entries.extend([t for t in thread_turns if isinstance(t, dict)])
        for turn in reversed(turn_entries):
            text = self._extract_text(turn)
            if text:
                return text.strip()
            items = turn.get("items")
            if isinstance(items, list):
                for item in reversed(items):
                    if isinstance(item, dict):
                        item_text = self._extract_text(item)
                        if item_text:
                            return item_text.strip()
        preview = thread.get("preview")
        if isinstance(preview, str):
            return preview.strip()
        return ""

    def _build_prompt(self, payload: dict[str, Any]) -> str:
        method = str(payload.get("method") or "")
        req_id = payload.get("id")
        params = payload.get("params")
        thread_id = payload.get("threadId")
        reason = ""
        question_text = ""
        if isinstance(params, dict):
            raw_reason = params.get("reason")
            if isinstance(raw_reason, str) and raw_reason.strip():
                reason = raw_reason.strip()
            questions = params.get("questions")
            if isinstance(questions, list) and questions:
                first = questions[0]
                if isinstance(first, dict):
                    raw_question = first.get("question")
                    if isinstance(raw_question, str) and raw_question.strip():
                        question_text = raw_question.strip()

        raw_payload = json.dumps(params if params is not None else {}, ensure_ascii=False)
        if len(raw_payload) > 2000:
            raw_payload = raw_payload[:2000] + "...(truncated)"

        return (
            "You are a strict approval guardian.\n"
            "Decide one of: approve, session, deny.\n"
            "Prefer deny when uncertain or risky.\n"
            "Never request or use any tool.\n"
            "Return ONLY valid JSON with keys:\n"
            'decision, risk_level, confidence, summary, chain.\n\n'
            f"request_id: {req_id}\n"
            f"method: {method}\n"
            f"thread_id: {thread_id}\n"
            f"reason: {reason}\n"
            f"question: {question_text}\n"
            f"params_json: {raw_payload}\n"
        )

    def _normalize_choice(self, value: Any) -> str | None:
        raw = str(value or "").strip().lower()
        if raw in {"approve", "approved", "approve_once", "allow"}:
            return "approve"
        if raw in {"session", "approve_for_session", "approved_for_session"}:
            return "session"
        if raw in {"deny", "decline", "denied", "reject"}:
            return "deny"
        return None

    def _parse_decision(self, text: str) -> GuardianDecision:
        candidate = self._extract_json_candidate(text)
        parsed: dict[str, Any] | None = None
        if candidate is not None:
            try:
                parsed_json = json.loads(candidate)
                if isinstance(parsed_json, dict):
                    parsed = parsed_json
            except json.JSONDecodeError:
                parsed = None
        if parsed is None:
            raise ValueError("Guardian response is not valid JSON")

        choice = self._normalize_choice(parsed.get("decision"))
        if choice is None:
            raise ValueError(f"Guardian response has invalid decision: {parsed.get('decision')}")

        risk_level = str(parsed.get("risk_level") or parsed.get("risk") or "unknown").strip().lower()
        if not risk_level:
            risk_level = "unknown"
        confidence_value = parsed.get("confidence")
        if isinstance(confidence_value, (int, float)):
            confidence = f"{confidence_value:.2f}"
        else:
            confidence = str(confidence_value or "unknown").strip() or "unknown"
        summary = str(parsed.get("summary") or "").strip()
        chain = str(parsed.get("chain") or "").strip()
        return GuardianDecision(
            choice=choice,
            risk_level=risk_level,
            confidence=confidence,
            summary=summary,
            chain=chain,
            raw_text=text.strip(),
        )

    def _extract_json_candidate(self, text: str) -> str | None:
        candidates: list[str] = []
        depth = 0
        start = -1
        in_string = False
        escape = False

        for idx, ch in enumerate(text):
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == "\"":
                    in_string = False
                continue

            if ch == "\"":
                in_string = True
                continue
            if ch == "{":
                if depth == 0:
                    start = idx
                depth += 1
                continue
            if ch == "}" and depth > 0:
                depth -= 1
                if depth == 0 and start >= 0:
                    candidates.append(text[start : idx + 1])
                    start = -1

        if not candidates:
            return None
        return candidates[-1]
