from telegram import InlineKeyboardButton, InlineKeyboardMarkup


REVIEWER_MAX_ATTEMPT_CHOICES = [1, 2, 3, 4, 5]
REVIEWER_TIMEOUT_CHOICES = [3, 8, 20]
REVIEWER_RECENT_TURN_PAIR_CHOICES = [1, 2, 3, 5]


def reviewer_panel_text(current: dict, draft: dict) -> str:
    enabled = bool(draft.get("enabled", False))
    max_attempts_raw = draft.get("max_attempts", 1)
    timeout_raw = draft.get("timeout_seconds", 8)
    recent_raw = draft.get("recent_turn_pairs", 3)
    max_attempts = max_attempts_raw if isinstance(max_attempts_raw, int) and max_attempts_raw > 0 else 1
    timeout_seconds = timeout_raw if isinstance(timeout_raw, int) and timeout_raw > 0 else 8
    recent_turn_pairs = recent_raw if isinstance(recent_raw, int) and recent_raw > 0 else 3

    lines = [
        "Reviewer settings (local bot config):",
        "",
        f"- enabled: {'ON' if enabled else 'OFF'}",
        f"- max_attempts: {max_attempts}",
        f"- timeout_seconds: {timeout_seconds}",
        f"- recent_turn_pairs: {recent_turn_pairs}",
    ]

    changed: list[str] = []
    for key in ("enabled", "max_attempts", "timeout_seconds", "recent_turn_pairs"):
        if current.get(key) != draft.get(key):
            changed.append(key)
    if changed:
        lines.append("")
        lines.append("Pending changes: " + ", ".join(changed))
    return "\n".join(lines)


def reviewer_keyboard(draft: dict) -> InlineKeyboardMarkup:
    enabled = bool(draft.get("enabled", False))
    max_attempts_raw = draft.get("max_attempts", 1)
    timeout_raw = draft.get("timeout_seconds", 8)
    recent_raw = draft.get("recent_turn_pairs", 3)
    max_attempts = max_attempts_raw if isinstance(max_attempts_raw, int) and max_attempts_raw > 0 else 1
    timeout_seconds = timeout_raw if isinstance(timeout_raw, int) and timeout_raw > 0 else 8
    recent_turn_pairs = recent_raw if isinstance(recent_raw, int) and recent_raw > 0 else 3

    keyboard = [
        [
            InlineKeyboardButton(
                f"{'☑' if enabled else '☐'} Enabled",
                callback_data="reviewer_toggle:enabled",
            )
        ],
        [
            InlineKeyboardButton(
                f"🔁 Max Attempts: {max_attempts}",
                callback_data="reviewer_cycle:max_attempts",
            )
        ],
        [
            InlineKeyboardButton(
                f"⏱ Timeout: {timeout_seconds}s",
                callback_data="reviewer_cycle:timeout_seconds",
            )
        ],
        [
            InlineKeyboardButton(
                f"🧵 Context: {recent_turn_pairs} pairs",
                callback_data="reviewer_cycle:recent_turn_pairs",
            )
        ],
        [
            InlineKeyboardButton("✅ Apply", callback_data="reviewer_apply"),
            InlineKeyboardButton("🔄 Refresh", callback_data="reviewer_refresh"),
        ],
        [
            InlineKeyboardButton("⬅ Back", callback_data="cmd:config"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)
