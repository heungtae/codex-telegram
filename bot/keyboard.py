from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def approval_keyboard(request_id: int) -> InlineKeyboardMarkup:
    keyboard = [
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"approval:{request_id}:approve"),
            InlineKeyboardButton("🕘 Session", callback_data=f"approval:{request_id}:session"),
            InlineKeyboardButton("❌ Deny", callback_data=f"approval:{request_id}:deny"),
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
            InlineKeyboardButton("⚙️ Settings", callback_data="cmd:config"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def settings_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [
            InlineKeyboardButton("🧪 Features", callback_data="cmd:features"),
            InlineKeyboardButton("📦 Apps", callback_data="cmd:apps"),
        ],
        [
            InlineKeyboardButton("📁 Project Select", callback_data="cmd:projects"),
            InlineKeyboardButton("🛡 Guardian", callback_data="cmd:guardian_settings"),
        ],
        [
            InlineKeyboardButton("✅ Reviewer", callback_data="cmd:reviewer_settings"),
        ],
        [
            InlineKeyboardButton("🤖 Models", callback_data="cmd:models"),
            InlineKeyboardButton("🧭 Modes", callback_data="cmd:modes"),
        ],
        [
            InlineKeyboardButton("🔌 MCP", callback_data="cmd:mcp"),
            InlineKeyboardButton("📄 App Config", callback_data="cmd:config_view"),
        ],
        [
            InlineKeyboardButton("⬅ Main Menu", callback_data="cmd:menu"),
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
