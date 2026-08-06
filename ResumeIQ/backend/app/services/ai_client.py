import httpx
from app.config import get_settings

ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def ai_provider() -> str:
    """Return the configured provider: 'anthropic', 'groq' or '' (none)."""
    s = get_settings()
    if s.anthropic_api_key:
        return "anthropic"
    if s.groq_api_key:
        return "groq"
    return ""


def ai_available() -> bool:
    return bool(ai_provider())


def ai_complete(system: str, user: str, max_tokens: int = 1200) -> str | None:
    """Call the configured provider. Returns text or None on any failure."""
    settings = get_settings()
    provider = ai_provider()

    if provider == "anthropic":
        try:
            payload = {
                "model": ANTHROPIC_MODEL,
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

    if provider == "groq":
        try:
            payload = {
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "max_tokens": max_tokens,
            }
            resp = httpx.post(
                GROQ_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                timeout=45.0,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            choices = data.get("choices") or []
            if not choices:
                return None
            content = (choices[0].get("message") or {}).get("content")
            return (content or "").strip() or None
        except Exception:
            return None

    return None


# Backwards-compatible alias used by the rewriter services.
anthropic_complete = ai_complete


def json_from_ai(system: str, user: str, max_tokens: int = 2000) -> dict | None:
    """Ask the model for JSON and parse it defensively. Returns None on failure."""
    raw = ai_complete(system, user, max_tokens=max_tokens)
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
