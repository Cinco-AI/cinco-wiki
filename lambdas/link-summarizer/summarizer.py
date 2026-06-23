"""Fetch page + résumé OpenAI (~300 car., français)."""

from __future__ import annotations

import os
import re

import httpx
from bs4 import BeautifulSoup
from openai import APIError, OpenAI

MODEL_PRIMARY = "gpt-5-nano"
MODEL_FALLBACK = "gpt-4.1-nano"
MAX_SUMMARY_CHARS = 300
MAX_PAGE_BYTES = 512 * 1024
MAX_PAGE_TEXT_CHARS = 12_000
FETCH_TIMEOUT_S = 8.0
USER_AGENT = "Mozilla/5.0 (compatible; CincoWikiBot/1.0; +https://cinco.ai)"

SYSTEM_PROMPT = (
    "Tu résumes des pages web en français. "
    "Réponds uniquement avec le résumé, sans guillemets ni préambule. "
    f"Maximum {MAX_SUMMARY_CHARS} caractères (espaces inclus)."
)


def _strip_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def fetch_page_text(url: str) -> str:
    """Télécharge la page et en extrait le texte visible."""
    with httpx.Client(
        follow_redirects=True,
        timeout=FETCH_TIMEOUT_S,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"},
    ) as client:
        response = client.get(url)
        response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    if "html" not in content_type.lower():
        return ""

    html = response.text[:MAX_PAGE_BYTES]
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    text = _strip_ws(soup.get_text(separator=" "))
    return text[:MAX_PAGE_TEXT_CHARS]


def _truncate_summary(text: str) -> str:
    clean = _strip_ws(text)
    if len(clean) <= MAX_SUMMARY_CHARS:
        return clean
    trimmed = clean[:MAX_SUMMARY_CHARS].rsplit(" ", 1)[0]
    return trimmed.rstrip(".,;:!?") + "…"


def _chat_summary(client: OpenAI, model: str, user_content: str) -> str:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=120,
        temperature=0.3,
    )
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("réponse OpenAI vide")
    return _truncate_summary(content)


def summarize_link(
    url: str,
    og_title: str | None,
    og_description: str | None,
) -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY manquante")

    page_text = ""
    try:
        page_text = fetch_page_text(url)
    except Exception:
        # Best effort : on continue avec les métadonnées OG uniquement.
        page_text = ""

    parts = [f"URL : {url}"]
    if og_title:
        parts.append(f"Titre (Open Graph) : {og_title}")
    if og_description:
        parts.append(f"Description (Open Graph) : {og_description}")
    if page_text:
        parts.append(f"Contenu extrait de la page :\n{page_text}")
    else:
        parts.append("Contenu de la page : indisponible (utilise les métadonnées OG).")

    user_content = "\n\n".join(parts)
    client = OpenAI(api_key=api_key)

    try:
        return _chat_summary(client, MODEL_PRIMARY, user_content)
    except APIError:
        return _chat_summary(client, MODEL_FALLBACK, user_content)
