from typing import Any


COMMAND_HELP: dict[str, str] = {
    "/commands": "List available commands. Usage: /commands",
    "/start": "Create a new thread and show workspace. Usage: /start [model]",
    "/resume": "Resume a thread. Usage: /resume <thread_id|number>",
    "/fork": "Fork a thread. Usage: /fork <thread_id>",
    "/threads": "List threads. Usage: /threads [--archived|-a] [--full] [--by-profile] [--current-profile] [--limit N] [--offset N]",
    "/read": "Read thread details. Usage: /read <thread_id|number>",
    "/archive": "Archive a thread. Usage: /archive <thread_id|number>",
    "/unarchive": "Unarchive a thread. Usage: /unarchive <thread_id>",
    "/compact": "Start thread compaction. Usage: /compact <thread_id>",
    "/rollback": "Rollback turns. Usage: /rollback <n_turns>",
    "/interrupt": "Interrupt current turn. Usage: /interrupt",
    "/review": "Start review. Usage: /review [uncommittedChanges|baseBranch|commit|custom]",
    "/exec": "Execute command in Codex app-server. Usage: /exec <command>",
    "/models": "List available models. Usage: /models",
    "/features": "Manage beta features with checkbox UI. Usage: /features",
    "/gurdian": "Show guardian summary. Edit guardian settings/rules in Web UI. Usage: /gurdian",
    "/guardian": "Alias of /gurdian. Usage: /guardian",
    "/modes": "List collaboration modes. Usage: /modes",
    "/skills": "List skills. Usage: /skills [cwd]",
    "/apps": "List apps. Usage: /apps",
    "/mcp": "List MCP server statuses. Usage: /mcp",
    "/config": "Read server configuration. Usage: /config",
    "/projects": "List/manage projects. Usage: /projects --list | /projects --add <key>",
    "/project": "Select active project. Usage: /project <key|number|name>",
}


def normalize_cli_token(token: str) -> str:
    value = (token or "").strip()
    value = value.translate(
        str.maketrans(
            {
                "\u2014": "-",
                "\u2013": "-",
                "\u2212": "-",
                "\ufe63": "-",
                "\uff0d": "-",
            }
        )
    )
    lowered = value.lower()
    if lowered.lstrip("-") == "help":
        return "--help"
    if lowered.lstrip("-") == "h":
        return "-h"
    return value


def is_help_requested(args: list[str]) -> bool:
    for arg in args:
        normalized = normalize_cli_token(arg).lower()
        if normalized in ("--help", "-h", "help"):
            return True
    return False


def command_help(command: str) -> str:
    return COMMAND_HELP.get(command, f"No help available for {command}")


def commands_overview() -> str:
    lines = ["Available commands:"]
    for command in sorted(COMMAND_HELP.keys()):
        lines.append(f"- {command}")
    lines.append("")
    lines.append("Tip: Use <command> --help for details.")
    return "\n".join(lines)


def first_text(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, dict):
        for key in ("text", "message", "delta", "summary", "preview", "content"):
            found = first_text(value.get(key))
            if found:
                return found
        return None
    if isinstance(value, list):
        for item in value:
            found = first_text(item)
            if found:
                return found
    return None
