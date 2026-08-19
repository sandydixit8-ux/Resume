import re

class RewriteService:

    ACTION_VERBS = [
        "Achieved", "Accelerated", "Advised", "Analyzed", "Architected", "Authored", "Automated",
        "Built", "Chaired", "Championed", "Closed", "Commissioned", "Consolidated", "Coordinated",
        "Created", "Delivered", "Designed", "Developed", "Devised", "Directed", "Drove",
        "Eliminated", "Enabled", "Engineered", "Established", "Evaluated", "Executed", "Expanded",
        "Facilitated", "Generated", "Governed", "Grew", "Implemented", "Improved", "Increased",
        "Initiated", "Innovated", "Integrated", "Introduced", "Launched", "Led", "Managed",
        "Mentored", "Negotiated", "Optimized", "Orchestrated", "Overhauled", "Oversaw", "Owned",
        "Performed", "Pioneered", "Produced", "Programmed", "Rebuilt", "Reduced", "Reengineered",
        "Reorganized", "Resolved", "Revamped", "Scaled", "Simplified", "Spearheaded",
        "Standardized", "Streamlined", "Strengthened", "Supervised", "Trained", "Transformed",
        "Upgraded"
    ]

    # Map common weak or present-tense verbs to strong past-tense action verbs
    VERB_CONVERSIONS = {
        "lead": "Led",
        "direct": "Directed",
        "control": "Managed",
        "manage": "Managed",
        "implement": "Implemented",
        "provide": "Delivered",
        "provided": "Delivered",
        "prepare": "Developed",
        "prepared": "Developed",
        "develop": "Developed",
        "author": "Authored",
        "coordinate": "Coordinated",
        "supervise": "Supervised",
        "guide": "Guided",
        "assist": "Supported",
        "assisted": "Supported",
        "work": "Executed",
        "worked": "Executed",
        "handle": "Managed",
        "handled": "Managed",
    }

    CLICHES = [
        "responsible for", "duties included", "tasked with", "worked on", "involved in",
        "team player", "hardworking", "results-oriented", "detail-oriented", "go-getter",
        "think outside the box", "synergy", "proactive", "self-starter", "passionate about",
        "track record"
    ]

    # Pre-compiled sets and regexes for fast lookup
    ACTION_VERBS_SET = {v.lower() for v in ACTION_VERBS}
    METRIC_REGEX = re.compile(
        r'\d+%|\$\d+|\bRs\.?\s*[\d,]+|\b₹\s*[\d,]+\s*(Cr|Crore|Lakh|L|k)?|\d[\d,]*\+?\s*(people|customers|users|clients|members|teams?|junctions|stations|plazas|sites|vendors|projects|programs|features|requests|deployments|applications|districts|work streams|concurrent)',
        re.IGNORECASE
    )

    @classmethod
    def generate_suggestions(cls, resume_parsed: dict, raw_text: str, jd_text=None) -> list:
        suggestions = []
        summary = resume_parsed.get("summary", "")
        if summary:
            suggestions.extend(cls._improve_summary(summary, jd_text))
        for exp in resume_parsed.get("experience", []):
            suggestions.extend(cls._improve_experience(exp))
        skills = resume_parsed.get("skills", [])
        if skills:
            suggestions.extend(cls._improve_skills(skills, jd_text))
        suggestions.extend(cls._find_cliches(raw_text))
        return suggestions

    @classmethod
    def _improve_summary(cls, summary: str, jd_text=None):
        s = []
        for line in summary.split("\n"):
            line = line.strip()
            if not line:
                continue
            has_cliche = any(c in line.lower() for c in cls.CLICHES)
            if has_cliche:
                s.append({"section": "summary", "original": line, "suggestion": cls._rewrite_cliche(line), "explanation": "Replaced cliche with specific language", "type": "rewrite"})
        return s

    @classmethod
    def _rewrite_cliche(cls, line: str):
        ll = line.lower()
        for c in cls.CLICHES:
            if c in ll:
                if c == "responsible for":
                    idx = ll.find(c)
                    rest = line[idx + len(c):].strip()
                    if rest.startswith("of "):
                        rest = rest[3:].strip()
                    if rest:
                        rest = rest[0].upper() + rest[1:] if len(rest) > 1 else rest.upper()
                    return f"Delivered {rest}" if rest else line
                if c == "duties included":
                    idx = ll.find(c)
                    rest = line[idx + len(c):].strip()
                    if rest:
                        rest = rest[0].upper() + rest[1:] if len(rest) > 1 else rest.upper()
                    return f"Executed {rest}" if rest else line
                if c == "team player":
                    return re.sub(r'\bteam player\b', 'cross-functional collaborator', line, flags=re.IGNORECASE)
                if c == "results-oriented":
                    return re.sub(r'\bresults-oriented\b', 'focused on measurable outcomes', line, flags=re.IGNORECASE)
                if c == "detail-oriented":
                    return re.sub(r'\bdetail-oriented\b', 'meticulous', line, flags=re.IGNORECASE)
        return line

    @classmethod
    def _improve_experience(cls, exp: dict):
        s = []
        title = exp.get("title", "")
        company = exp.get("company", "")
        label = f"experience: {title} at {company}" if company else f"experience: {title}"
        for bullet in exp.get("bullets", []):
            bullet = bullet.strip()
            if not bullet:
                continue
            words = bullet.split()
            first_word = words[0].rstrip(".,:;") if words else ""
            first_word_lower = first_word.lower()

            has_verb = first_word_lower in cls.ACTION_VERBS_SET
            has_num = bool(cls.METRIC_REGEX.search(bullet))

            if first_word_lower in cls.VERB_CONVERSIONS:
                better_verb = cls.VERB_CONVERSIONS[first_word_lower]
                rest = " ".join(words[1:])
                suggested = f"{better_verb} {rest}".strip()
                s.append({
                    "section": label,
                    "original": bullet,
                    "suggestion": suggested,
                    "explanation": f"Converted present/weak verb '{first_word}' to past-tense action verb '{better_verb}'",
                    "type": "verb_upgrade"
                })
            elif not has_verb:
                verb = cls._suggest_verb(title)
                rest = bullet[0].lower() + bullet[1:] if bullet else ""
                s.append({
                    "section": label,
                    "original": bullet,
                    "suggestion": f"{verb} {rest}",
                    "explanation": f"Added past-tense action verb '{verb}'",
                    "type": "rewrite"
                })
            elif has_verb and not has_num:
                s.append({
                    "section": label,
                    "original": bullet,
                    "suggestion": bullet + " (e.g., resulting in 20%+ efficiency gain or $X savings)",
                    "explanation": "Add a quantified result (metric/percentage/currency) to maximize ATS and recruiter impact",
                    "type": "quantify"
                })
        return s

    @classmethod
    def _suggest_verb(cls, title: str):
        tl = title.lower()
        if any(w in tl for w in ["engineer", "developer", "programmer", "architect"]):
            return "Developed"
        if any(w in tl for w in ["manager", "director", "head", "lead", "supervisor"]):
            return "Led"
        if any(w in tl for w in ["analyst", "scientist", "researcher"]):
            return "Analyzed"
        if any(w in tl for w in ["designer", "design"]):
            return "Designed"
        return "Delivered"

    @classmethod
    def _improve_skills(cls, skills: list, jd_text=None):
        s = []
        if len(skills) > 15:
            s.append({"section": "skills", "original": ", ".join(skills), "suggestion": ", ".join(skills[:12]), "explanation": f"Trim from {len(skills)} to 10-12 most relevant", "type": "condense"})
        if jd_text:
            missing = [sk for sk in skills if sk.lower() not in jd_text.lower()]
            if missing and len(missing) > 5:
                s.append({"section": "skills", "original": ", ".join(skills), "suggestion": ", ".join([sk for sk in skills if sk.lower() in jd_text.lower()] + missing[:3]), "explanation": "Reorder to prioritize JD-matched skills", "type": "reorder"})
        return s

    @classmethod
    def _find_cliches(cls, text: str):
        s = []
        for line in text.split("\n"):
            ll = line.lower().strip()
            for c in cls.CLICHES:
                if c in ll and len(line.strip()) > 5:
                    s.append({"section": "general", "original": line.strip(), "suggestion": f"Replace '{c}' with specific, quantified language", "explanation": f"'{c}' is a resume cliche", "type": "cliche"})
                    break
        return s
