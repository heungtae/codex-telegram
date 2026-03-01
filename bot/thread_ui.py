from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def parse_threads_options(args: list[str]) -> tuple[int, int]:
    limit = 5
    offset = 0
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--limit" and i + 1 < len(args) and args[i + 1].isdigit():
            limit = max(1, min(100, int(args[i + 1])))
            i += 1
        elif arg == "--offset" and i + 1 < len(args) and args[i + 1].isdigit():
            offset = max(0, int(args[i + 1]))
            i += 1
        i += 1
    return offset, limit


def threads_keyboard(thread_ids: list[str], offset: int, limit: int) -> InlineKeyboardMarkup:
    keyboard: list[list[InlineKeyboardButton]] = []
    for idx, tid in enumerate(thread_ids, 1):
        row_no = offset + idx
        keyboard.append(
            [
                InlineKeyboardButton(f"▶ Resume {row_no}", callback_data=f"resume:{tid}"),
                InlineKeyboardButton(f"📖 Read {row_no}", callback_data=f"read:{tid}"),
                InlineKeyboardButton(f"🗑️ Archive {row_no}", callback_data=f"archive:{tid}"),
            ]
        )

    prev_offset = max(0, offset - limit)
    next_offset = offset + limit
    keyboard.append(
        [
            InlineKeyboardButton("⬅ Prev", callback_data=f"threads_page:{prev_offset}:{limit}"),
            InlineKeyboardButton("➡ Next", callback_data=f"threads_page:{next_offset}:{limit}"),
        ]
    )

    return InlineKeyboardMarkup(keyboard)
