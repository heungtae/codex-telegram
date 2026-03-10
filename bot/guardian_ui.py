from telegram import InlineKeyboardButton, InlineKeyboardMarkup


GUARDIAN_TIMEOUT_CHOICES = [3, 8, 20, 60]
GUARDIAN_FAILURE_POLICY_CHOICES = ["manual_fallback", "deny", "approve", "session"]
GUARDIAN_EXPLAINABILITY_CHOICES = ["decision_only", "summary", "full_chain"]


def _failure_policy_label(value: str) -> str:
    return {
        "manual_fallback": "manual fallback",
        "deny": "deny",
        "approve": "approve",
        "session": "session",
    }.get(value, value)


def _explainability_label(value: str) -> str:
    return {
        "decision_only": "decision only",
        "summary": "summary",
        "full_chain": "summary + debug logs",
    }.get(value, value)


def guardian_panel_text(current: dict, draft: dict) -> str:
    enabled = bool(draft.get("enabled", False))
    timeout_raw = draft.get("timeout_seconds", 20)
    timeout_seconds = timeout_raw if isinstance(timeout_raw, int) and timeout_raw > 0 else 20
    failure_policy = str(draft.get("failure_policy", "manual_fallback"))
    explainability = str(draft.get("explainability", "full_chain"))

    lines = [
        "Guardian settings (local bot config):",
        "",
        f"- enabled: {'ON' if enabled else 'OFF'}",
        f"- timeout_seconds: {timeout_seconds}",
        f"- failure_policy: {_failure_policy_label(failure_policy)}",
        f"- explainability: {_explainability_label(explainability)}",
    ]

    changed: list[str] = []
    for key in ("enabled", "timeout_seconds", "failure_policy", "explainability"):
        if current.get(key) != draft.get(key):
            changed.append(key)
    if changed:
        lines.append("")
        lines.append("Pending changes: " + ", ".join(changed))
    return "\n".join(lines)


def guardian_keyboard(draft: dict) -> InlineKeyboardMarkup:
    enabled = bool(draft.get("enabled", False))
    timeout_raw = draft.get("timeout_seconds", 20)
    timeout_seconds = timeout_raw if isinstance(timeout_raw, int) and timeout_raw > 0 else 20
    failure_policy = str(draft.get("failure_policy", "manual_fallback"))
    explainability = str(draft.get("explainability", "full_chain"))

    keyboard = [
        [
            InlineKeyboardButton(
                f"{'☑' if enabled else '☐'} Enabled",
                callback_data="guardian_toggle:enabled",
            )
        ],
        [
            InlineKeyboardButton(
                f"⏱ Timeout: {timeout_seconds}s",
                callback_data="guardian_cycle:timeout",
            )
        ],
        [
            InlineKeyboardButton(
                f"🧯 Failure: {_failure_policy_label(failure_policy)}",
                callback_data="guardian_cycle:failure_policy",
            )
        ],
        [
            InlineKeyboardButton(
                f"🔎 Explain: {_explainability_label(explainability)}",
                callback_data="guardian_cycle:explainability",
            )
        ],
        [
            InlineKeyboardButton("✅ Apply", callback_data="guardian_apply"),
            InlineKeyboardButton("🔄 Refresh", callback_data="guardian_refresh"),
        ],
        [
            InlineKeyboardButton("⬅ Back", callback_data="cmd:config"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)
