from utils.config import get

from .user import user_manager


class TelegramBridgeConfigError(ValueError):
    pass


def single_allowed_telegram_user_id() -> int | None:
    allowed_ids = get("users.allowed_ids", [])
    if not isinstance(allowed_ids, list) or len(allowed_ids) != 1:
        return None
    try:
        user_id = int(allowed_ids[0])
    except (TypeError, ValueError):
        return None
    if user_id <= 0:
        return None
    return user_id


def require_single_allowed_telegram_user_id() -> int:
    allowed_ids = get("users.allowed_ids", [])
    if not isinstance(allowed_ids, list) or len(allowed_ids) != 1:
        raise TelegramBridgeConfigError(
            "Open in Telegram requires exactly one Telegram user in users.allowed_ids."
        )
    try:
        user_id = int(allowed_ids[0])
    except (TypeError, ValueError) as exc:
        raise TelegramBridgeConfigError(
            "Open in Telegram requires users.allowed_ids to contain one numeric Telegram user id."
        ) from exc
    if user_id <= 0:
        raise TelegramBridgeConfigError(
            "Open in Telegram requires a positive Telegram user id in users.allowed_ids."
        )
    return user_id


def bind_thread_counterparts(
    user_id: int,
    thread_id: str | None,
    *,
    project_key: str | None = None,
    web_user_ids: list[int] | tuple[int, ...] | set[int] | None = None,
) -> set[int]:
    if not isinstance(thread_id, str) or not thread_id:
        return set()

    user_manager.bind_thread_subscriber(user_id, thread_id)
    if isinstance(project_key, str) and project_key:
        user_manager.bind_thread_project(thread_id, project_key)

    bound_user_ids = {user_id}
    telegram_user_id = single_allowed_telegram_user_id()
    if telegram_user_id is None:
        return bound_user_ids

    if user_id > 0:
        if user_id != telegram_user_id:
            return bound_user_ids
        user_manager.keep_user_thread_subscription_only(user_id, thread_id)
        for web_user_id in web_user_ids or ():
            if isinstance(web_user_id, int) and web_user_id < 0:
                user_manager.bind_thread_subscriber(web_user_id, thread_id)
                bound_user_ids.add(web_user_id)
        return bound_user_ids

    if user_id < 0:
        telegram_state = user_manager.get(telegram_user_id)
        if telegram_state.active_thread_id == thread_id:
            user_manager.keep_user_thread_subscription_only(telegram_user_id, thread_id)
            bound_user_ids.add(telegram_user_id)

    return bound_user_ids
