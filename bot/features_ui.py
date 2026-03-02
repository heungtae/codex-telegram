from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def features_panel_text(
    feature_keys: list[str],
    feature_names: dict[str, str],
    feature_draft: dict[str, bool],
) -> str:
    if not feature_keys:
        return "No beta features found."

    lines = ["Beta features (toggle checkboxes, then Apply):", ""]
    for key in feature_keys:
        enabled = bool(feature_draft.get(key, False))
        mark = "☑" if enabled else "☐"
        name = feature_names.get(key, key)
        lines.append(f"{mark} {name} ({key})")
    return "\n".join(lines)


def features_keyboard(
    feature_keys: list[str],
    feature_names: dict[str, str],
    feature_draft: dict[str, bool],
) -> InlineKeyboardMarkup:
    keyboard: list[list[InlineKeyboardButton]] = []
    for idx, key in enumerate(feature_keys):
        enabled = bool(feature_draft.get(key, False))
        mark = "☑" if enabled else "☐"
        name = feature_names.get(key, key)
        label = f"{mark} {name}"
        callback_data = f"feature_toggle:{idx}"
        keyboard.append([InlineKeyboardButton(label[:40], callback_data=callback_data)])

    keyboard.append(
        [
            InlineKeyboardButton("✅ Apply", callback_data="feature_apply"),
            InlineKeyboardButton("🔄 Refresh", callback_data="feature_refresh"),
        ]
    )
    return InlineKeyboardMarkup(keyboard)
