from telegram import Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    TypeHandler,
    filters,
)

COMMAND_NAMES = [
    "commands",
    "start",
    "projects",
    "project",
    "resume",
    "threads",
    "read",
    "archive",
    "unarchive",
    "compact",
    "rollback",
    "interrupt",
    "review",
    "exec",
    "models",
    "features",
    "guardian",
    "modes",
    "collab",
    "mode",
    "plan",
    "build",
    "skills",
    "apps",
    "mcp",
    "config",
]


def build_application(
    *,
    bot_token: str,
    post_init,
    post_shutdown,
    debug_update_handler,
    start_handler,
    command_handler,
    message_handler,
    callback_handler,
    error_handler,
) -> Application:
    app = (
        Application.builder()
        .token(bot_token)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .concurrent_updates(True)
        .build()
    )
    app.add_handler(TypeHandler(Update, debug_update_handler), group=-1)
    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("help", start_handler))
    app.add_handler(CommandHandler(COMMAND_NAMES, command_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))
    app.add_handler(CallbackQueryHandler(callback_handler))
    app.add_error_handler(error_handler)
    return app
