import logging

from models.telegram_bridge import (
    TelegramBridgeConfigError,
    bind_thread_counterparts,
    single_allowed_telegram_user_id,
    require_single_allowed_telegram_user_id,
)
from web.runtime import event_hub, session_manager

logger = logging.getLogger("codex-telegram.web.telegram_sync")


async def bind_web_thread_to_telegram(
    web_user_id: int,
    thread_id: str | None,
    *,
    project_key: str | None = None,
) -> set[int]:
    bound_user_ids = bind_thread_counterparts(web_user_id, thread_id, project_key=project_key)
    logger.info(
        "Web thread sync user_id=%s thread_id=%s project_key=%s telegram_user_id=%s bound_users=%s",
        web_user_id,
        thread_id,
        project_key or "",
        single_allowed_telegram_user_id(),
        sorted(bound_user_ids),
    )
    return bound_user_ids


async def bind_telegram_thread_to_active_web(
    telegram_user_id: int,
    thread_id: str | None,
    *,
    project_key: str | None = None,
    notify_web: bool = True,
) -> set[int]:
    web_user_ids = [
        user_id
        for user_id in await session_manager.active_user_ids()
        if user_id < 0
    ]
    bound_user_ids = bind_thread_counterparts(
        telegram_user_id,
        thread_id,
        project_key=project_key,
        web_user_ids=web_user_ids,
    )
    logger.info(
        "Telegram thread sync user_id=%s thread_id=%s project_key=%s active_web_users=%s bound_users=%s notify_web=%s",
        telegram_user_id,
        thread_id,
        project_key or "",
        len(web_user_ids),
        sorted(bound_user_ids),
        notify_web,
    )
    if notify_web and isinstance(thread_id, str) and thread_id:
        for user_id in bound_user_ids:
            if user_id < 0:
                await event_hub.publish_event(
                    user_id,
                    {
                        "type": "threads_changed",
                        "thread_id": thread_id,
                        "project_key": project_key or "",
                    },
                )
    return bound_user_ids


__all__ = [
    "TelegramBridgeConfigError",
    "bind_telegram_thread_to_active_web",
    "bind_web_thread_to_telegram",
    "require_single_allowed_telegram_user_id",
    "single_allowed_telegram_user_id",
]
