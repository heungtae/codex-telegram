from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def parse_threads_options(args: list[str]) -> tuple[int, int, bool]:
    def _normalize_flag(arg: str) -> str:
        value = (arg or "").strip()
        if value.startswith("\u2014"):  # em dash
            return "--" + value[1:]
        if value.startswith("\u2013"):  # en dash
            return "--" + value[1:]
        return value

    limit = 5
    offset = 0
    archived = False
    i = 0
    while i < len(args):
        arg = _normalize_flag(args[i])
        if arg in ("--archived", "-a", "archived"):
            archived = True
        elif arg == "--limit" and i + 1 < len(args) and args[i + 1].isdigit():
            limit = max(1, min(100, int(args[i + 1])))
            i += 1
        elif arg == "--offset" and i + 1 < len(args) and args[i + 1].isdigit():
            offset = max(0, int(args[i + 1]))
            i += 1
        i += 1
    return offset, limit, archived


def threads_keyboard(thread_ids: list[str], offset: int, limit: int, archived: bool = False) -> InlineKeyboardMarkup:
    keyboard: list[list[InlineKeyboardButton]] = []
    for idx, tid in enumerate(thread_ids, 1):
        row_no = offset + idx
        if archived:
            keyboard.append(
                [
                    InlineKeyboardButton(f"↩ Unarchive {row_no}", callback_data=f"unarchive:{tid}"),
                    InlineKeyboardButton(f"📖 Read {row_no}", callback_data=f"read:{tid}"),
                ]
            )
        else:
            keyboard.append(
                [
                    InlineKeyboardButton(f"▶ Resume {row_no}", callback_data=f"resume:{tid}"),
                    InlineKeyboardButton(f"📖 Read {row_no}", callback_data=f"read:{tid}"),
                    InlineKeyboardButton(f"🗑️ Archive {row_no}", callback_data=f"archive:{tid}"),
                ]
            )

    prev_offset = max(0, offset - limit)
    next_offset = offset + limit
    mode = "arch" if archived else "active"
    keyboard.append(
        [
            InlineKeyboardButton("⬅ Prev", callback_data=f"threads_page:{mode}:{prev_offset}:{limit}"),
            InlineKeyboardButton("➡ Next", callback_data=f"threads_page:{mode}:{next_offset}:{limit}"),
        ]
    )

    return InlineKeyboardMarkup(keyboard)
