import json
import re

class ATSScorerService:

    CATEGORIES = ["file_format_structure", "section_detection", "contact_parseability", "date_formatting", "bullet_structure", "keyword_density", "length_file_size", "font_encoding"]
    CATEGORY_WEIGHTS = {"file_format_structure": 20, "section_detection": 15, "contact_parseability": 15, "date_formatting": 10, "bullet_structure": 15, "keyword_density": 10, "length_file_size": 10, "font_encoding": 5}
    CATEGORY_LABELS = {"file_format_structure": "File Format & Structure", "section_detection": "Section Detection", "contact_parseability": "Contact Info", "date_formatting": "Date Formatting", "bullet_structure": "Bullet Structure", "keyword_density": "Keyword Density", "length_file_size": "Length & Size", "font_encoding": "Font/Encoding"}

    @classmethod
    def score(cls, parsed_result: dict) -> dict:
        categories = {}
        feedback = {}
        raw_text = parsed_result.get("raw_text", "")
        parsed = parsed_result.get("parsed_json", {})
        issues_str = parsed_result.get("parsing_issues", "[]")
        issues = json.loads(issues_str) if isinstance(issues_str, str) else issues_str

        categories["file_format_structure"], feedback["file_format_structure"] = cls._score_file_format(issues)
        categories["section_detection"], feedback["section_detection"] = cls._score_section_detection(parsed)
        categories["contact_parseability"], feedback["contact_parseability"] = cls._score_contact(parsed)
        categories["date_formatting"], feedback["date_formatting"] = cls._score_dates(raw_text)
        categories["bullet_structure"], feedback["bullet_structure"] = cls._score_bullets(raw_text)
        categories["keyword_density"], feedback["keyword_density"] = cls._score_keywords(raw_text)
        categories["length_file_size"], feedback["length_file_size"] = cls._score_length(parsed_result)
        categories["font_encoding"], feedback["font_encoding"] = cls._score_font(issues)

        weighted = sum(categories[cat] * cls.CATEGORY_WEIGHTS[cat] / 100.0 for cat in cls.CATEGORIES)
        max_w = sum(cls.CATEGORY_WEIGHTS[cat] for cat in cls.CATEGORIES)
        overall = round((weighted / max_w) * 100, 1)
        overall = max(0, min(100, overall))

        return {
            "overall_score": overall,
            "category_scores": {cls.CATEGORY_LABELS[k]: v for k, v in categories.items()},
            "category_feedback": {cls.CATEGORY_LABELS[k]: v for k, v in feedback.items()},
            "priority_fixes": cls._generate_priority_fixes(categories, feedback, issues),
        }

    @staticmethod
    def _score_file_format(issues: list):
        score = 100
        items = []
        high = [i for i in issues if i.get("severity") == "high"]
        med = [i for i in issues if i.get("severity") == "medium"]
        tables = [i for i in high if i.get("type") == "table"]
        cols = [i for i in high if i.get("type") == "multi_column"]
        if tables:
            score -= 30
            items.append("Tables detected - ATS systems struggle with tables")
        if cols:
            score -= 25
            items.append("Multi-column layout detected - use single column")
        imgs = [i for i in med if i.get("type") == "image"]
        if imgs:
            score -= 10
            items.append("Images detected - text in images is invisible to ATS")
        hf = [i for i in med if i.get("type") == "header_footer"]
        if hf:
            score -= 8
            items.append("Headers/footers detected")
        if not tables and not cols:
            items.append("Clean single-column format")
        return max(0, score), "; ".join(items)

    @staticmethod
    def _score_section_detection(parsed: dict):
        score = 0
        items = []
        expected = {"summary": "Summary", "skills": "Skills", "experience": "Experience", "education": "Education", "certifications": "Certifications"}
        for key, label in expected.items():
            content = parsed.get(key, "")
            if key == "skills":
                s = parsed.get("skills", [])
                if s and any(x.strip() for x in s):
                    score += 18
                    items.append(f"{label}: found")
            elif key == "experience":
                e = parsed.get("experience", [])
                if e and any(x.get("bullets") for x in e):
                    score += 18
                    items.append(f"{label}: found")
            elif isinstance(content, str) and len(content.strip()) > 10:
                score += 18
                items.append(f"{label}: found")
            elif isinstance(content, list) and len(content) > 0:
                score += 18
                items.append(f"{label}: found ({len(content)} items)")
        ci = parsed.get("contact_info", {})
        if ci.get("name") or ci.get("email") or ci.get("phone"):
            score += 10
        return min(100, max(0, score)), "; ".join(items) if items else "Sections detected"

    @staticmethod
    def _score_contact(parsed: dict):
        score = 0
        items = []
        ci = parsed.get("contact_info", {})
        for key, pts in [("name", 25), ("email", 25), ("phone", 25), ("location", 15), ("linkedin", 10)]:
            if ci.get(key):
                score += pts
                items.append(f"{key}: found")
            else:
                items.append(f"{key}: not found")
        return score, "; ".join(items)

    @staticmethod
    def _score_dates(text: str):
        score = 100
        items = []
        pats = [r'[A-Z][a-z]{2}\s*\d{4}\s*[-u2013to]+\s*(?:[A-Z][a-z]{2}\s*\d{4}|Present|Current|Now)',
                r'\d{4}\s*[-u2013to]+\s*(?:\d{4}|Present|Current|Now)']
        dates = []
        for p in pats:
            dates.extend(re.findall(p, text))
        if not dates:
            return 30, "No date ranges detected"
        items.append(f"{len(dates)} date range(s) found")
        if not any("Present" in d or "Current" in d for d in dates):
            score -= 10
            items.append("No current role marked")
        return max(0, score), "; ".join(items)

    @staticmethod
    def _score_bullets(text: str):
        score = 0
        items = []
        lines = text.split("\n")
        bullets = [l.strip() for l in lines if l.strip().startswith(("\u2022", "-", "*")) or re.match(r'^\d+[.)]', l.strip())]
        if not bullets:
            return 20, "No bullet points found"
        verbs = ["achieved", "accelerated", "analyzed", "architected", "authored", "built", "chaired", "closed", "commissioned", "coordinated", "created", "delivered", "designed", "developed", "directed", "drove", "established", "executed", "generated", "governed", "grew", "implemented", "improved", "increased", "initiated", "launched", "lead", "led", "managed", "mentored", "negotiated", "optimized", "owned", "oversaw", "prepared", "provided", "reduced", "spearheaded", "streamlined", "supervised", "trained", "transformed"]
        vcount = 0
        qcount = 0
        for b in bullets:
            stripped = b.lstrip("\u2022-*0123456789). ").strip()
            words = stripped.split()
            if words and words[0].lower() in verbs:
                vcount += 1
            if re.search(r'\d+%|\$\d+|\bRs\.?\s*[\d,]+|\d[\d,]*\+?\s*(people|customers|users|clients|members|teams?|junctions|stations|plazas|sites|vendors|projects|programs|features|requests|deployments|applications)', b.lower()):
                qcount += 1
        score += min(40, (vcount / len(bullets)) * 40) if bullets else 0
        score += min(40, (qcount / len(bullets)) * 40) if bullets else 0
        items.append(f"{vcount}/{len(bullets)} start with action verbs")
        items.append(f"{qcount}/{len(bullets)} have quantified results")
        score += 20
        return min(100, max(0, score)), "; ".join(items)

    @staticmethod
    def _score_keywords(text: str):
        score = 50
        items = []
        common = ["python", "java", "javascript", "typescript", "sql", "react", "aws", "docker", "git", "agile", "machine learning", "leadership", "communication", "excel"]
        found = [s for s in common if s.lower() in text.lower()]
        score += min(30, len(found) * 3)
        if found:
            items.append(f"{len(found)} common skills detected")
        return min(100, score), "; ".join(items) if items else "Add more keywords"

    @staticmethod
    def _score_length(parsed_result: dict):
        score = 100
        items = []
        raw = parsed_result.get("raw_text", "")
        words = len(raw.split())
        size = parsed_result.get("file_size", 0)
        if words < 200:
            score -= 40
            items.append(f"Too short: {words} words")
        elif words > 1500:
            score -= 20
            items.append(f"Too long: {words} words")
        else:
            items.append(f"Good length: {words} words")
        if size > 5 * 1024 * 1024:
            score -= 20
        return max(0, score), "; ".join(items)

    @staticmethod
    def _score_font(issues: list):
        s = [i for i in issues if i.get("type") == "special_characters"]
        if s:
            return 70, "Special characters detected"
        return 100, "No font issues"

    @staticmethod
    def _generate_priority_fixes(categories: dict, feedback: dict, issues: list):
        fixes = []
        for ck, cn in ATSScorerService.CATEGORY_LABELS.items():
            sc = categories.get(ck, 0)
            fb = feedback.get(cn, "")
            if sc < 50 and fb:
                fixes.append({"category": cn, "score": sc, "feedback": fb[:200], "priority": "critical"})
            elif sc < 75 and fb:
                fixes.append({"category": cn, "score": sc, "feedback": fb[:200], "priority": "important"})
        for issue in issues:
            if issue.get("severity") == "high" and not any(issue.get("detail", "") in f.get("feedback", "") for f in fixes):
                fixes.append({"category": "Parsing Issue", "score": 0, "feedback": issue.get("detail", ""), "priority": "critical"})
        fixes.sort(key=lambda x: {"critical": 0, "important": 1, "nice-to-have": 2}.get(x["priority"], 3))
        return fixes
