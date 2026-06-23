"""Lambda entry — résumé sync d'un lien externe (gpt-5-nano)."""

from __future__ import annotations

import json
from typing import Any

try:
    import unzip_requirements  # noqa: F401 — extrait .requirements.zip (serverless-python-requirements)
except ImportError:
    pass

from summarizer import summarize_link


def summarize(event: dict[str, Any], _context: object) -> dict[str, str]:
    url = event.get("url")
    if not url or not isinstance(url, str):
        return {"error": "url requis"}

    og_title = event.get("ogTitle")
    og_description = event.get("ogDescription")

    try:
        summary = summarize_link(
            url=url,
            og_title=og_title if isinstance(og_title, str) else None,
            og_description=og_description if isinstance(og_description, str) else None,
        )
        return {"summary": summary}
    except Exception as exc:  # noqa: BLE001 — best effort, détail renvoyé au caller
        return {"error": str(exc)}


def handler(event: dict[str, Any] | str, context: object) -> dict[str, str]:
    """Alias pour compatibilité ; Serverless pointe sur `summarize`."""
    if isinstance(event, str):
        event = json.loads(event)
    return summarize(event, context)
