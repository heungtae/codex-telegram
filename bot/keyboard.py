from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def approval_keyboard(action_id: str) -> InlineKeyboardMarkup:
    keyboard = [
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"approve:{action_id}"),
            InlineKeyboardButton("❌ Deny", callback_data=f"deny:{action_id}"),
        ],
        [
            InlineKeyboardButton("📋 View Details", callback_data=f"view:{action_id}"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def thread_keyboard(thread_id: str) -> InlineKeyboardMarkup:
    keyboard = [
        [
            InlineKeyboardButton("▶️ Resume", callback_data=f"resume:{thread_id}"),
            InlineKeyboardButton("🍴 Fork", callback_data=f"fork:{thread_id}"),
        ],
        [
            InlineKeyboardButton("📖 Read", callback_data=f"read:{thread_id}"),
            InlineKeyboardButton("🗑️ Archive", callback_data=f"archive:{thread_id}"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def main_menu_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [
            InlineKeyboardButton("📝 New Thread", callback_data="cmd:start"),
            InlineKeyboardButton("📋 My Threads", callback_data="cmd:threads"),
        ],
        [
            InlineKeyboardButton("🛠️ Skills", callback_data="cmd:skills"),
            InlineKeyboardButton("📁 Projects", callback_data="cmd:projects"),
        ],
        [
            InlineKeyboardButton("📦 Apps", callback_data="cmd:apps"),
        ],
        [
            InlineKeyboardButton("⚙️ Settings", callback_data="cmd:config"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def interrupt_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [
            InlineKeyboardButton("⛔ Interrupt", callback_data="cmd:interrupt"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)
