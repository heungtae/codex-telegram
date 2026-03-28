import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from bot.keyboard import approval_keyboard
from models import state
from models.user import user_manager
from web.runtime import event_hub

from .event_forwarding import method_matches, publish_system_message

logger = logging.getLogger("codex-telegram")


@dataclass(frozen=True)
class GuardianConfig:
    enabled: bool
    patterns: list[str]
    failure_policy: str
    explainability: str
    timeout_seconds: int
    rules: list[dict[str, Any]]


def build_guardian_config(get_guardian_settings) -> GuardianConfig:
    settings = get_guardian_settings()
    methods = settings.get("apply_to_methods", ["*"]) if isinstance(settings, dict) else ["*"]
    return GuardianConfig(
        enabled=bool(settings.get("enabled", False)) if isinstance(settings, dict) else False,
        patterns=methods if isinstance(methods, list) else ["*"],
        failure_policy=str(settings.get("failure_policy", "manual_fallback")).strip().lower() if isinstance(settings, dict) else "manual_fallback",
        explainability=str(settings.get("explainability", "decision_only")).strip().lower() if isinstance(settings, dict) else "decision_only",
        timeout_seconds=int(settings.get("timeout_seconds", 20)) if isinstance(settings, dict) else 20,
        rules=[item for item in settings.get("rules", []) if isinstance(item, dict)] if isinstance(settings, dict) and isinstance(settings.get("rules"), list) else [],
    )


def build_approval_request_handler(
    app,
    config: GuardianConfig,
    build_approval_policy_context,
    match_approval_policy,
    guardian_factory,
    to_thread,
):
    async def forward_approval_request(payload: dict[str, Any]):
        if state.codex_client is None:
            return
        req_id = payload.get("id")
        if not isinstance(req_id, int):
            return
        method = str(payload.get("method") or "")
        thread_id = payload.get("threadId")
        user_id = user_manager.find_user_id_by_thread(thread_id if isinstance(thread_id, str) else None)
        if user_id is None:
            logger.warning(
                "Approval request without user mapping method=%s id=%s threadId=%s",
                method,
                req_id,
                thread_id,
            )
            return

        workspace_path: str | None = None
        state_user = user_manager.get(user_id)
        if isinstance(state_user.selected_project_path, str) and state_user.selected_project_path:
            workspace_path = state_user.selected_project_path
        elif state.command_router is not None:
            effective = state.command_router.projects.resolve_effective_project(user_id)
            if isinstance(effective, dict):
                raw_workspace = effective.get("path")
                if isinstance(raw_workspace, str) and raw_workspace:
                    workspace_path = raw_workspace

        policy_context = await to_thread(build_approval_policy_context, payload, workspace_path)
        reason = str(policy_context.get("reason") or "")
        question_text = str(policy_context.get("question") or "")

        def guardian_message(decision) -> str:
            lines = [
                "Guardian auto decision sent.",
                f"Method: {method}",
                f"Request ID: {req_id}",
                f"Decision: {decision.choice}",
            ]
            if config.explainability == "summary":
                lines.append(f"Risk: {decision.risk_level}")
                lines.append(f"Confidence: {decision.confidence}")
                if decision.summary:
                    lines.append(f"Summary: {decision.summary}")
            return "\n".join(lines)

        def guardian_policy_message(rule_name: str, action: str) -> str:
            return "\n".join(
                [
                    "Guardian policy decision sent.",
                    f"Method: {method}",
                    f"Request ID: {req_id}",
                    f"Rule: {rule_name}",
                    f"Decision: {action}",
                ]
            )

        guardian_request_message = (
            "Guardian request\n"
            f"Method: {method}\n"
            f"Request ID: {req_id}\n"
            f"Reason: {reason or '(none)'}\n"
            f"Question: {question_text or '(none)'}"
        )

        skip_guardian_review = False
        matched_policy_rule = ""

        if config.enabled and method_matches(method, [pattern for pattern in config.patterns if isinstance(pattern, str)]):
            policy_match = match_approval_policy(policy_context, config.rules)
            if policy_match is not None:
                matched_policy_rule = policy_match.rule_name
                logger.info(
                    "Guardian policy matched thread_id=%s request_id=%s method=%s rule=%s action=%s matched_fields=%s",
                    thread_id,
                    req_id,
                    method,
                    policy_match.rule_name,
                    policy_match.action,
                    ",".join(policy_match.matched_fields),
                )
                await publish_system_message(
                    user_id,
                    thread_id if isinstance(thread_id, str) else None,
                    None,
                    guardian_policy_message(policy_match.rule_name, policy_match.action),
                )
                if policy_match.action == "manual_fallback":
                    skip_guardian_review = True
                    if user_id > 0 and app is not None:
                        await app.bot.send_message(
                            chat_id=user_id,
                            text=(
                                guardian_policy_message(policy_match.rule_name, policy_match.action)
                                + "\nManual approval is required."
                            ),
                        )
                else:
                    accepted = state.codex_client.submit_approval_decision(
                        req_id,
                        policy_match.action,
                        thread_id if isinstance(thread_id, str) else None,
                    )
                    if accepted:
                        if user_id > 0 and app is not None:
                            await app.bot.send_message(
                                chat_id=user_id,
                                text=guardian_policy_message(policy_match.rule_name, policy_match.action),
                            )
                        return
                    logger.warning(
                        "Guardian policy matched but request already expired method=%s id=%s rule=%s",
                        method,
                        req_id,
                        policy_match.rule_name,
                    )
                    return

            if not skip_guardian_review and state.approval_guardian is None:
                state.approval_guardian = guardian_factory()

            guardian_decision = None
            guardian_error = ""
            if not skip_guardian_review:
                logger.debug(
                    "Guardian request thread_id=%s request_id=%s method=%s details=%s",
                    thread_id,
                    req_id,
                    method,
                    guardian_request_message,
                )
                await publish_system_message(
                    user_id,
                    thread_id if isinstance(thread_id, str) else None,
                    None,
                    guardian_request_message,
                )
                try:
                    guardian_decision = await state.approval_guardian.review(
                        payload,
                        timeout_seconds=max(1, config.timeout_seconds),
                    )
                except asyncio.TimeoutError:
                    guardian_error = f"Guardian timeout after {config.timeout_seconds}s"
                except Exception as exc:
                    guardian_error = f"Guardian failed: {exc}"

                if guardian_decision is not None:
                    logger.debug(
                        "Guardian result thread_id=%s request_id=%s method=%s decision=%s risk=%s confidence=%s summary=%s",
                        thread_id,
                        req_id,
                        method,
                        guardian_decision.choice,
                        guardian_decision.risk_level,
                        guardian_decision.confidence,
                        guardian_decision.summary,
                    )
                    await publish_system_message(
                        user_id,
                        thread_id if isinstance(thread_id, str) else None,
                        None,
                        guardian_message(guardian_decision),
                    )
                    if guardian_decision.choice in {"approve", "session"}:
                        accepted = state.codex_client.submit_approval_decision(
                            req_id,
                            guardian_decision.choice,
                            thread_id if isinstance(thread_id, str) else None,
                        )
                        if accepted:
                            if user_id > 0 and app is not None:
                                await app.bot.send_message(chat_id=user_id, text=guardian_message(guardian_decision))
                            return
                        logger.warning(
                            "Guardian produced decision but request already expired method=%s id=%s",
                            method,
                            req_id,
                        )
                    else:
                        logger.debug(
                            "Guardian returned deny; falling back to manual approval method=%s id=%s",
                            method,
                            req_id,
                        )
                        if user_id > 0 and app is not None:
                            await app.bot.send_message(
                                chat_id=user_id,
                                text=(
                                    "Guardian recommended deny.\n"
                                    f"Method: {method}\n"
                                    f"Request ID: {req_id}\n"
                                    "Manual approval is required."
                                ),
                            )
                else:
                    logger.warning("Guardian could not decide method=%s id=%s error=%s", method, req_id, guardian_error)
                    await publish_system_message(
                        user_id,
                        thread_id if isinstance(thread_id, str) else None,
                        None,
                        "Guardian unavailable.\n"
                        f"Method: {method}\n"
                        f"Request ID: {req_id}\n"
                        f"Reason: {guardian_error or 'unknown'}",
                    )
                    if config.failure_policy in {"approve", "session", "deny"}:
                        accepted = state.codex_client.submit_approval_decision(
                            req_id,
                            config.failure_policy,
                            thread_id if isinstance(thread_id, str) else None,
                        )
                        if accepted:
                            if user_id > 0 and app is not None:
                                await app.bot.send_message(
                                    chat_id=user_id,
                                    text=(
                                        "Guardian fallback decision sent.\n"
                                        f"Method: {method}\n"
                                        f"Request ID: {req_id}\n"
                                        f"Decision: {config.failure_policy}\n"
                                        f"Reason: {guardian_error or 'fallback policy'}"
                                    ),
                                )
                            return
                    if user_id > 0 and app is not None:
                        await app.bot.send_message(
                            chat_id=user_id,
                            text=(
                                "Guardian review did not complete.\n"
                                f"Method: {method}\n"
                                f"Request ID: {req_id}\n"
                                f"Reason: {guardian_error or 'unknown'}\n"
                                "Falling back to manual approval."
                            ),
                        )

        policy_line = f"\nPolicy: {matched_policy_rule}" if matched_policy_rule else ""
        reason_line = f"\nReason: {reason}" if reason else ""
        question_line = f"\nQuestion: {question_text}" if question_text else ""
        message = (
            "Approval required.\n"
            f"Method: {method}{policy_line}\n"
            f"Request ID: {req_id}{reason_line}{question_line}\n"
            "Choose: Approve / Session / Deny"
        )
        logger.info(
            "Dispatching approval request channel=%s user_id=%s method=%s request_id=%s",
            "telegram" if user_id > 0 else "web",
            user_id,
            method,
            req_id,
        )
        approval_payload = {
            "id": req_id,
            "type": "approval_required",
            "method": method,
            "thread_id": thread_id if isinstance(thread_id, str) else None,
            "reason": reason,
            "question": question_text,
            "policy_rule": matched_policy_rule or None,
        }
        previous_approvals = await event_hub.replace_approval(user_id, req_id, approval_payload)
        for previous in previous_approvals:
            previous_id = previous.get("id")
            if not isinstance(previous_id, int) or previous_id == req_id:
                continue
            closed = state.codex_client.submit_approval_decision(
                previous_id,
                "deny",
                previous.get("thread_id") if isinstance(previous.get("thread_id"), str) else None,
            )
            logger.info(
                "Superseding approval request user_id=%s previous_request_id=%s new_request_id=%s closed=%s",
                user_id,
                previous_id,
                req_id,
                closed,
            )
        await event_hub.publish_event(user_id, approval_payload)
        if user_id > 0 and app is not None:
            await app.bot.send_message(
                chat_id=user_id,
                text=message,
                reply_markup=approval_keyboard(req_id),
            )

    return forward_approval_request
