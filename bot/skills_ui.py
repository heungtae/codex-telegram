from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def extract_skill_names(skills_result: str) -> list[str]:
    names: list[str] = []
    for raw_line in (skills_result or "").splitlines():
        line = raw_line.strip()
        if not line.startswith("•"):
            continue
        # Expected examples:
        # - "• ✓ clean-code"
        # - "• ✗ some-skill"
        # - "• plain-name"
        body = line[1:].strip()
        if not body:
            continue
        while body and body[0] in ("✓", "✗", "•", "-", "*"):
            body = body[1:].strip()
        if body:
            names.append(body)
    return names


def skills_keyboard(skill_names: list[str]) -> InlineKeyboardMarkup:
    keyboard: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for name in skill_names:
        callback_data = f"skillpick:{name}"
        if len(callback_data.encode("utf-8")) > 64:
            continue
        row.append(InlineKeyboardButton(name, callback_data=callback_data))
        if len(row) == 2:
            keyboard.append(row)
            row = []
    if row:
        keyboard.append(row)
    return InlineKeyboardMarkup(keyboard)
