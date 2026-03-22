import asyncio
import logging
from typing import Any, Awaitable, Callable

from telegram.ext import Application

from models import state
from utils.pypi_check import check_latest_version

logger = logging.getLogger("codex-telegram")


async def _check_update() -> None:
    try:
        version_info = await check_latest_version()
        if version_info is not None and version_info.is_outdated:
            logger.warning(
                "A newer version of codex-telegram is available: %s (current: %s). "
                "Run: pip install --upgrade codex-telegram",
                version_info.latest,
                version_info.current,
            )
    except Exception as e:
        logger.warning("Failed to check for updates: %s", e)


async def setup_codex(*, codex_client_factory: Callable[[], Any], client_info: dict[str, Any]):
    client = codex_client_factory()
    await client.start()
    await client.initialize(client_info)
    return client


async def post_init(
    app: Application | None,
    *,
    setup_codex_fn: Callable[[], Awaitable[Any]],
    command_router_factory: Callable[[Any], Any],
    approval_guardian_factory: Callable[[], Any],
    build_forwarding_config: Callable[[Callable[..., Any]], Any],
    build_guardian_config: Callable[[Callable[[], dict[str, Any]]], Any],
    build_event_forwarder: Callable[[Application | None, Any], Any],
    build_approval_request_handler: Callable[..., Any],
    get_config_value: Callable[..., Any],
    get_guardian_settings: Callable[[], dict[str, Any]],
    build_approval_policy_context: Callable[..., Any],
    match_approval_policy: Callable[..., Any],
    to_thread: Callable[..., Awaitable[Any]],
) -> None:
    state.codex_client = await setup_codex_fn()
    state.command_router = command_router_factory(state.codex_client)
    state.approval_guardian = approval_guardian_factory()

    forwarding_config = build_forwarding_config(get_config_value)
    guardian_config = build_guardian_config(get_guardian_settings)

    state.codex_client.on_any(build_event_forwarder(app, forwarding_config))
    state.codex_client.on_approval_request(
        build_approval_request_handler(
            app,
            guardian_config,
            build_approval_policy_context=build_approval_policy_context,
            match_approval_policy=match_approval_policy,
            guardian_factory=approval_guardian_factory,
            to_thread=to_thread,
        )
    )

    state.codex_ready.set()
    logger.info("Codex initialized")

    if not state.update_notified:
        asyncio.create_task(_check_update())
        state.update_notified = True


async def post_shutdown(
    _app: Application | None,
    *,
    state_module=state,
) -> None:
    if state_module.codex_client:
        await state_module.codex_client.stop()
        state_module.codex_client = None
    if state_module.approval_guardian:
        await state_module.approval_guardian.stop()
        state_module.approval_guardian = None
    state_module.command_router = None
    state_module.codex_ready.clear()


async def run_without_telegram(
    *,
    post_init_fn: Callable[[Application | None], Awaitable[None]],
    post_shutdown_fn: Callable[[Application | None], Awaitable[None]],
) -> None:
    await post_init_fn(None)
    logger.info("Telegram channel disabled. Running codex runtime for Web only.")
    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        await post_shutdown_fn(None)
