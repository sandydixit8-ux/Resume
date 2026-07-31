import re

class RewriteService:

    ACTION_VERBS = ["Achieved", "Accelerated", "Analyzed", "Architected", "Automated", "Built", "Championed", "Consolidated", "Created", "Delivered", "Designed", "Developed", "Devised", "Directed", "Drove", "Eliminated", "Enabled", "Engineered", "Established", "Evaluated", "Executed", "Expanded", "Facilitated", "Generated", "Grew", "Implemented", "Improved", "Increased", "Initiated", "Innovated", "Integrated", "Introduced", "Launched", "Led", "Managed", "Mentored", "Optimized", "Orchestrated", "Overhauled", "Oversaw", "Performed", "Pioneered", "Produced", "Programmed", "Rebuilt", "Reduced", "Reengineered", "Reorganized", "Resolved", "Revamped", "Scaled", "Simplified", "Spearheaded", "Standardized", "Streamlined", "Strengthened", "Transformed", "Upgraded"]
    CLICHES = ["responsible for", "duties included", "tasked with", "worked on", "involved in", "team player", "hardworking", "results-oriented", "detail-oriented", "go-getter", "think outside the box", "synergy", "proactive", "self-starter", "passionate about", "track record"]

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
        for c in cls.CLICHES:
            if c in line.lower():
                if c == "responsible for":
                    rest = line[line.lower().find(c) + len(c):].strip()
                    return f"Delivered {rest}" if rest else line
                if c == "team player":
                    return line.replace("team player", "cross-functional collaborator")
                if c in ["results-oriented", "detail-oriented"]:
                    return line.replace("results-oriented", "focused on measurable outcomes").replace("detail-oriented", "meticulous")
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
            has_verb = any(bullet.startswith(v) for v in cls.ACTION_VERBS)
            has_num = bool(re.search(r'\d+%|\$\d+|\d+\s+(people|customers|users|clients|teams?)', bullet.lower()))
            if not has_verb:
                verb = cls._suggest_verb(title)
                s.append({"section": label, "original": bullet, "suggestion": f"{verb} {bullet}", "explanation": f"Added action verb '{verb}'", "type": "rewrite"})
            elif has_verb and not has_num:
                s.append({"section": label, "original": bullet, "suggestion": bullet + " (add metric here)", "explanation": "Add a quantified result", "type": "quantify"})
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
