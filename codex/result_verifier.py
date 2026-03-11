import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

from .client import CodexClient


logger = logging.getLogger("codex-telegram.verifier")


@dataclass(slots=True)
class VerifierDecision:
    decision: str
    summary: str
    feedback: str
    missing_requirements: list[str]
    raw_text: str


class ResultVerifierService:
    def __init__(self):
        self._client: CodexClient | None = None
        self._lock = asyncio.Lock()
        self._collecting = False
        self._active_turn_id: str | None = None
        self._active_buffer: list[str] = []
        self._done_event = asyncio.Event()

    async def start(self):
        if self._client is not None:
            return
        client = CodexClient()
        await client.start()
        await client.initialize(
            {
                "name": "codex-telegram-verifier",
                "title": "Codex Telegram Result Verifier",
                "version": "0.1.0",
            }
        )

        def _auto_deny_nested_approvals(payload: dict[str, Any]):
            req_id = payload.get("id")
            if isinstance(req_id, int):
                client.submit_approval_decision(req_id, "deny")
                logger.info("Verifier denied nested approval id=%s", req_id)

        client.on_approval_request(_auto_deny_nested_approvals)
        client.on_any(self._on_verifier_event)
        self._client = client
        logger.info("Result verifier app-server initialized")

    async def stop(self):
        if self._client is None:
            return
        await self._client.stop()
        self._client = None
        logger.info("Result verifier app-server stopped")

    async def verify(self, payload: dict[str, Any], timeout_seconds: int) -> VerifierDecision:
        async with self._lock:
            await self.start()
            if self._client is None:
                raise RuntimeError("Result verifier client is not initialized")

            prompt = self._build_prompt(payload)
            thread_result = await self._client.call("thread/start", {})
            thread_id = thread_result.get("thread", {}).get("id")
            if not isinstance(thread_id, str) or not thread_id:
                raise RuntimeError("Result verifier failed to start thread")

            self._active_buffer = []
            self._active_turn_id = None
            self._done_event.clear()
            self._collecting = True
            try:
                turn_result = await self._client.call(
                    "turn/start",
                    {
                        "threadId": thread_id,
                        "input": [{"type": "text", "text": prompt}],
                    },
                )
                turn_id = turn_result.get("turn", {}).get("id")
                if isinstance(turn_id, str) and turn_id:
                    self._active_turn_id = turn_id
                await asyncio.wait_for(self._done_event.wait(), timeout=max(1, int(timeout_seconds)))
                text = "".join(self._active_buffer).strip()
                if not text:
                    text = await self._fallback_read_turn_text(thread_id)
                if not text:
                    raise ValueError("Result verifier produced an empty response")
                return self._parse_decision(text)
            finally:
                self._collecting = False
                self._active_turn_id = None
                self._done_event.clear()

    def _on_verifier_event(self, method: str, params: dict | None):
        if not self._collecting:
            return
        payload = params or {}
        if method == "item/agentMessage/delta":
            text = self._extract_text(payload)
            if text:
                self._active_buffer.append(text)
            return
        if method in ("turn/completed", "turn/failed", "turn/cancelled"):
            current_turn = self._extract_turn_id(payload)
            if self._active_turn_id and current_turn and current_turn != self._active_turn_id:
                return
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
        review_mode = str(payload.get("review_mode") or "result").strip().lower()
        user_request = str(payload.get("user_request") or "").strip()
        if review_mode == "code_changes":
            changed_files_raw = payload.get("changed_files")
            changed_files = []
            if isinstance(changed_files_raw, list):
                changed_files = [str(item).strip() for item in changed_files_raw if str(item).strip()]
            changed_files_text = "\n".join(f"- {item}" for item in changed_files) if changed_files else "(none)"
            git_status = str(payload.get("git_status") or "").strip() or "(none)"
            diff_stat = str(payload.get("diff_stat") or "").strip() or "(none)"
            diff_excerpt = str(payload.get("diff_excerpt") or "").strip() or "(none)"
            return (
                "You are a strict code-change reviewer.\n"
                "Determine whether the actual workspace changes satisfy the user's request.\n"
                "Focus on correctness, missing edits, obvious regressions, and whether the required code changes are reflected in the diff.\n"
                "Return ONLY valid JSON with keys:\n"
                "decision, summary, feedback, missing_requirements.\n"
                "decision must be pass or fail.\n"
                "feedback must be concrete rewrite guidance for the assistant.\n\n"
                f"user_request:\n{user_request}\n\n"
                f"changed_files:\n{changed_files_text}\n\n"
                f"git_status_delta:\n{git_status}\n\n"
                f"diff_stat:\n{diff_stat}\n\n"
                f"diff_excerpt:\n{diff_excerpt}\n"
            )
        return (
            "You are a strict result verifier.\n"
            "Determine whether the candidate output satisfies the user's request.\n"
            "Return ONLY valid JSON with keys:\n"
            "decision, summary, feedback, missing_requirements.\n"
            "decision must be pass or fail.\n"
            "feedback must be concrete rewrite guidance for the assistant.\n\n"
            f"user_request:\n{user_request}\n\n"
            f"recent_context:\n{context_text}\n\n"
            f"candidate_output:\n{candidate_output}\n"
        )

    def _parse_decision(self, text: str) -> VerifierDecision:
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
            raise ValueError("Result verifier response is not valid JSON")

        decision_raw = str(parsed.get("decision") or "").strip().lower()
        if decision_raw not in {"pass", "fail"}:
            raise ValueError(f"Result verifier response has invalid decision: {parsed.get('decision')}")

        missing_raw = parsed.get("missing_requirements", [])
        missing_requirements = []
        if isinstance(missing_raw, list):
            missing_requirements = [str(item).strip() for item in missing_raw if str(item).strip()]

        return VerifierDecision(
            decision=decision_raw,
            summary=str(parsed.get("summary") or "").strip(),
            feedback=str(parsed.get("feedback") or "").strip(),
            missing_requirements=missing_requirements,
            raw_text=text.strip(),
        )

    def _extract_json_candidate(self, text: str) -> str | None:
        start = -1
        depth = 0
        candidates: list[str] = []
        for i, ch in enumerate(text):
            if ch == "{":
                if depth == 0:
                    start = i
                depth += 1
            elif ch == "}":
                if depth == 0:
                    continue
                depth -= 1
                if depth == 0 and start >= 0:
                    candidates.append(text[start : i + 1])
                    start = -1
        if not candidates:
            return None
        return candidates[-1]
