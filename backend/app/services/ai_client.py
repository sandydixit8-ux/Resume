import httpx
from app.config import get_settings

DEFAULT_MODEL = "claude-sonnet-4-20250514"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


def ai_available() -> bool:
    return bool(get_settings().anthropic_api_key)


def anthropic_complete(system: str, user: str, max_tokens: int = 1200) -> str | None:
    """Call the Anthropic Messages API. Returns text or None on any failure."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    try:
        payload = {
            "model": DEFAULT_MODEL,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        resp = httpx.post(
            ANTHROPIC_URL,
            json=payload,
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            timeout=45.0,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        blocks = data.get("content", [])
        return "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
    except Exception:
        return None


def json_from_ai(system: str, user: str, max_tokens: int = 2000) -> dict | None:
    """Ask the model for JSON and parse it defensively. Returns None on failure."""
    raw = anthropic_complete(system, user, max_tokens=max_tokens)
    if not raw:
        return None
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]
    import json

    try:
        return json.loads(cleaned)
    except Exception:
        return None
