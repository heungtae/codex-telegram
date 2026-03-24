import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from codex_telegram import __version__

logger = logging.getLogger("codex-telegram")

PACKAGE_NAME = "codex-telegram"
PYPI_URL = f"https://pypi.org/pypi/{PACKAGE_NAME}/json"


@dataclass
class VersionInfo:
    current: str
    latest: str
    is_outdated: bool
    release_url: str


async def check_latest_version(timeout: float = 10.0, *, verify_ssl: bool = True) -> Optional[VersionInfo]:
    try:
        async with httpx.AsyncClient(verify=verify_ssl) as client:
            response = await client.get(PYPI_URL, timeout=timeout)
            response.raise_for_status()
            data = response.json()
            latest = data["info"]["version"]
            release_urls = data.get("releases", {}).get(latest, [])
            url = release_urls[0]["url"] if release_urls else f"https://pypi.org/project/{PACKAGE_NAME}/"
            return VersionInfo(
                current=__version__,
                latest=latest,
                is_outdated=_compare_versions(__version__, latest) < 0,
                release_url=url,
            )
    except httpx.HTTPError as e:
        logger.warning("Failed to check PyPI for updates: %s", e)
        return None
    except Exception as e:
        logger.warning("Unexpected error checking PyPI: %s", e)
        return None


def _compare_versions(current: str, latest: str) -> int:
    def parse(v: str) -> tuple:
        parts = []
        for part in v.split("."):
            num = ""
            for c in part:
                if c.isdigit():
                    num += c
                else:
                    break
            if num:
                parts.append(int(num))
        return tuple(parts)

    current_parts = parse(current)
    latest_parts = parse(latest)

    if current_parts < latest_parts:
        return -1
    elif current_parts > latest_parts:
        return 1
    return 0


def format_update_message(info: VersionInfo) -> str:
    return (
        f"🔔 **Update Available!**\n\n"
        f"Current version: `{info.current}`\n"
        f"Latest version: `{info.latest}`\n\n"
        f"Run: `pip install --upgrade {PACKAGE_NAME}`\n"
        f"Release: {info.release_url}"
    )
