import json
from app.services.ai_client import ai_available, anthropic_complete, json_from_ai
from app.services.rewrite import RewriteService


def _section_bullets(parsed: dict) -> list:
    """Flatten experience bullets to (label, original) tuples."""
    items = []
    for exp in parsed.get("experience", []):
        title = exp.get("title", "")
        company = exp.get("company", "")
        label = f"{title} at {company}" if company else title
        for b in exp.get("bullets", []):
            if b and b.strip():
                items.append((label, b.strip()))
    return items


def _suggest_skill_categories(parsed: dict) -> dict:
    text = json.dumps(parsed).lower()
    categories = {}
    mapping = {
        "Leadership": ["led", "team", "director", "manager", "head", "strategy", "vision"],
        "Project Management": ["project", "agile", "scrum", "pmo", "timeline", "stakeholder"],
        "Software": ["python", "javascript", "react", "node", "java", "c++", "api", "git"],
        "Cloud": ["aws", "azure", "gcp", "kubernetes", "docker", "cloud"],
        "Data": ["sql", "python", "pandas", "machine learning", "data", "analytics", "pipeline"],
        "AI & Automation": ["ai", "llm", "machine learning", "automation", "nlp", "gpt"],
        "Cybersecurity": ["security", "iso 27001", "compliance", "vulnerability", "penetration"],
        "Finance": ["revenue", "budget", "forecast", "p&l", "cost", "roi", "financial"],
        "Engineering": ["design", "engineering", "schematic", "autocad", "civil", "mechanical"],
        "Marketing": ["campaign", "seo", "content", "brand", "growth", "social media"],
    }
    for cat, kws in mapping.items():
        if any(k in text for k in kws):
            categories[cat] = [k for k in parsed.get("skills", []) if any(kw in k.lower() for kw in kws)]
    return categories


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------

def generate_achievements(parsed: dict, jd_text: str | None = None) -> dict:
    items = _section_bullets(parsed)
    if ai_available():
        result = _ai_achievements(parsed, jd_text)
        if result:
            return result
    return {"source": "rules", "achievements": _rule_achievements(items)}


def _rule_achievements(items):
    import re
    out = []
    for label, bullet in items:
        rewritten = RewriteService._rewrite_cliche(bullet)
        has_verb = any(rewritten.startswith(v) for v in RewriteService.ACTION_VERBS)
        has_num = bool(
            re.search(r"\d+%|\$\d+|\d+\s+(people|customers|users|clients|teams?|stakeholders?)", rewritten.lower())
        )
        if not has_verb:
            verb = RewriteService._suggest_verb(label)
            rest = rewritten[:1].lower() + rewritten[1:] if rewritten else ""
            rewritten = f"{verb} {rest}".strip()
        impact = "Add a quantified result to show business impact" if not has_num else "Strong achievement statement"
        out.append({"section": label, "original": bullet, "achievement": rewritten, "impact": impact})
    return out


def _ai_achievements(parsed, jd_text):
    system = (
        "You are a world-class executive resume writer and ATS expert. "
        "Convert each responsibility bullet into a concise, quantified achievement statement. "
        "Use strong action verbs, include metrics or business impact where plausible, keep each under 20 words. "
        "Respond ONLY with a JSON object: {\"achievements\":[{\"section\":\"<role>\",\"original\":\"<bullet>\","
        "\"achievement\":\"<rewritten>\",\"impact\":\"<why it matters>\"}]}"
    )
    user = f"JD (optional): {jd_text or 'N/A'}\n\nResume: {json.dumps(parsed)[:6000]}"
    data = json_from_ai(system, user)
    if data and isinstance(data.get("achievements"), list):
        return {"source": "ai", "achievements": data["achievements"]}
    return None


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def generate_summary(parsed: dict, jd_text: str | None = None) -> dict:
    original = parsed.get("summary", "").strip() or "No summary provided."
    if ai_available():
        result = _ai_summary(parsed, jd_text)
        if result:
            result["original"] = original
            return result
    return {"source": "rules", "original": original, "optimized": _rule_summary(parsed, jd_text), "explanation": "Cleaned cliches and surfaced quantified strengths."}


def _rule_summary(parsed, jd_text):
    import re
    base = parsed.get("summary", "").strip()
    for c in RewriteService.CLICHES:
        base = re.sub(rf"\s*{re.escape(c)}\s*", " ", base, flags=re.IGNORECASE)
    base = re.sub(r"\s{2,}", " ", base).strip()
    if base and base[0].islower():
        base = base[0].upper() + base[1:]
    skills = ", ".join(parsed.get("skills", [])[:6])
    parts = [base] if base else []
    if skills:
        parts.append("Skilled in " + skills + ".")
    return " ".join(parts)


def _ai_summary(parsed, jd_text):
    system = (
        "You are an executive resume writer and ATS keyword expert. Rewrite the professional summary "
        "into one strong paragraph (50-70 words): executive-level, keyword-rich (mirror the JD), "
        "quantified, first-person-free. Respond ONLY with JSON: {\"optimized\":\"<summary>\","
        "\"explanation\":\"<what changed and why>\"}"
    )
    user = f"JD: {jd_text or 'N/A'}\n\nCurrent summary:\n{parsed.get('summary','')}\n\nResume data:\n{json.dumps(parsed)[:6000]}"
    data = json_from_ai(system, user)
    if data and data.get("optimized"):
        return {"source": "ai", "optimized": data["optimized"], "explanation": data.get("explanation", "")}
    return None


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------
def generate_skills(parsed: dict, jd_text: str | None = None) -> dict:
    current = parsed.get("skills", [])
    if ai_available():
        result = _ai_skills(parsed, jd_text)
        if result:
            return result
    return {"source": "rules", "current": current, "categories": _suggest_skill_categories(parsed), "suggested": _rule_skill_suggestions(parsed, jd_text)}


def _rule_skill_suggestions(parsed, jd_text):
    existing = [s.lower() for s in parsed.get("skills", [])]
    jd_skills = []
    if jd_text:
        import re
        jd_skills = [s.strip() for s in re.findall(r"[A-Z][A-Za-z0-9+#. -]{1,29}", jd_text) if len(s.strip()) >= 2]
    missing = [s for s in jd_skills if s.lower() not in existing and not any(s.lower() in e for e in existing)][:10]
    return missing


def _ai_skills(parsed, jd_text):
    system = (
        "You are an ATS keyword and skills expert. Given a resume and a job description, return optimized skills. "
        "Respond ONLY with JSON: {\"suggested\":[\"skill\",...],\"categories\":{\"Leadership\":[...],"
        "\"Technical\":[...]},\"missing\":[\"keywords from JD missing on the resume\",...]}. "
        "List 8-15 suggested skills max."
    )
    user = f"JD: {jd_text or 'N/A'}\n\nCurrent skills: {', '.join(parsed.get('skills', []))}\n\nResume:\n{json.dumps(parsed)[:5000]}"
    data = json_from_ai(system, user)
    if data:
        return {"source": "ai", "current": parsed.get("skills", []), "suggested": data.get("suggested", []), "categories": data.get("categories", {}), "missing": data.get("missing", [])}
    return None


# ---------------------------------------------------------------------------
# Experience rewrite
# ---------------------------------------------------------------------------

def improve_experience(parsed: dict, jd_text: str | None = None) -> dict:
    items = _section_bullets(parsed)
    if ai_available():
        result = _ai_experience(parsed, jd_text)
        if result:
            return result
    rewrites = []
    for label, bullet in items:
        rewritten = RewriteService._rewrite_cliche(bullet)
        if not any(rewritten.startswith(v) for v in RewriteService.ACTION_VERBS):
            rewritten = f"{RewriteService._suggest_verb(label)} {rewritten[:1].lower() + rewritten[1:] if rewritten else ''}".strip()
        rewrites.append({"section": label, "original": bullet, "rewritten": rewritten})
    return {"source": "rules", "rewrites": rewrites}


def _ai_experience(parsed, jd_text):
    system = (
        "You are an executive resume writer. Rewrite each experience bullet to be ATS-friendly, "
        "action-first and quantified. Preserve meaning. Respond ONLY with JSON: "
        "{\"rewrites\":[{\"section\":\"<role>\",\"original\":\"<bullet>\",\"rewritten\":\"<improved>\"}]}"
    )
    user = f"JD: {jd_text or 'N/A'}\n\nResume:\n{json.dumps(parsed)[:6000]}"
    data = json_from_ai(system, user)
    if data and isinstance(data.get("rewrites"), list):
        return {"source": "ai", "rewrites": data["rewrites"]}
    return None


# ---------------------------------------------------------------------------
# LinkedIn optimization
# ---------------------------------------------------------------------------

def linkedin_profile(parsed: dict, jd_text: str | None = None) -> dict:
    if ai_available():
        result = _ai_linkedin(parsed, jd_text)
        if result:
            return result
    return _rule_linkedin(parsed, jd_text)


def _rule_linkedin(parsed, jd_text):
    title = ""
    if parsed.get("experience"):
        title = parsed["experience"][0].get("title", "")
    skills = ", ".join(parsed.get("skills", [])[:5])
    summary = parsed.get("summary", "").strip() or "Professional with a track record of delivering results."
    headline = f"{title} | {skills}" if title and skills else title or "Open to opportunities"
    about = f"{summary}\n\nCore strengths: {', '.join(parsed.get('skills', [])[:10])}."
    return {
        "source": "rules",
        "headline": headline[:110],
        "about": about,
        "skills": parsed.get("skills", [])[:15],
        "banner_text": f"{title or 'Professional'} focused on measurable impact.",
        "open_to_work_title": title or "Open to work",
    }


def _ai_linkedin(parsed, jd_text):
    system = (
        "You are a LinkedIn specialist. Create an optimized LinkedIn profile from the resume: "
        "headline (<=120 chars, keyword-rich), about (2 short paragraphs), 10 skills, banner text "
        "(<=60 chars), and an Open-to-Work title. Respond ONLY with JSON: "
        "{\"headline\":\"\",\"about\":\"\",\"skills\":[],\"banner_text\":\"\",\"open_to_work_title\":\"\"}"
    )
    user = f"Target JD: {jd_text or 'N/A'}\n\nResume:\n{json.dumps(parsed)[:6000]}"
    data = json_from_ai(system, user)
    if data:
        data["source"] = "ai"
        return data
    return None
