from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def projects_keyboard(project_keys: list[str]) -> InlineKeyboardMarkup:
    keyboard: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for idx, key in enumerate(project_keys, 1):
        callback_data = f"projectsel:{key}"
        if len(callback_data.encode("utf-8")) > 64:
            continue
        row.append(InlineKeyboardButton(f"📁 Project {idx}", callback_data=callback_data))
        if len(row) == 2:
            keyboard.append(row)
            row = []
    if row:
        keyboard.append(row)
    return InlineKeyboardMarkup(keyboard)
