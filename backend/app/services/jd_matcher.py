import re

class JDMatcherService:

    SKILL_KEYWORDS = {
        "languages": ["python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", "ruby", "php", "swift", "kotlin", "scala", "r", "sql", "bash"],
        "frontend": ["react", "angular", "vue", "svelte", "next.js", "html", "css", "tailwind", "bootstrap", "redux"],
        "backend": ["node.js", "express", "django", "flask", "fastapi", "spring", "graphql", "rest", "kafka", "redis"],
        "cloud": ["aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "github actions"],
        "data": ["machine learning", "deep learning", "nlp", "tensorflow", "pytorch", "pandas", "numpy", "tableau", "power bi", "spark"],
        "databases": ["postgresql", "mysql", "mongodb", "oracle", "redis", "elasticsearch", "dynamodb"],
        "tools": ["git", "jira", "figma", "postman", "swagger"],
        "methodologies": ["agile", "scrum", "kanban", "devops", "microservices"],
        "soft_skills": ["leadership", "communication", "teamwork", "problem solving", "project management", "mentoring"]
    }

    @classmethod
    def extract_keywords(cls, jd_text: str) -> dict:
        jd_lower = jd_text.lower()
        skills_found = set()
        skills_by_category = {}
        for cat, skills in cls.SKILL_KEYWORDS.items():
            matched = [s for s in skills if re.search(r'\b' + re.escape(s) + r'\b', jd_text, re.IGNORECASE)]
            if matched:
                skills_by_category[cat] = matched
                skills_found.update(matched)
        exp_reqs = []
        for pat, label in [(r'(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|work)', "years")]:
            m = re.findall(pat, jd_text, re.IGNORECASE)
            if m:
                exp_reqs.append({"requirement": label, "years": m[0]})
        edu_reqs = []
        for pat, label in [(r"(?:bachelor'?s?|b\.?s\.?|b\.?a\.?)", "bachelors"), (r"(?:master'?s?|m\.?s\.?|m\.?a\.?)", "masters"), (r"(?:ph\.?d\.?|doctorate)", "phd")]:
            if re.search(pat, jd_text, re.IGNORECASE):
                edu_reqs.append(label)
        certs = []
        for cert in ["pmp", "aws certified", "cissp", "six sigma", "cfa", "cpa", "scrum master"]:
            if re.search(r'\b' + re.escape(cert) + r'\b', jd_text, re.IGNORECASE):
                certs.append(cert)
        soft = [s for s in cls.SKILL_KEYWORDS["soft_skills"] if s.lower() in jd_lower]
        return {"required_skills": list(skills_found), "skills_by_category": skills_by_category, "experience_requirements": exp_reqs, "education_requirements": edu_reqs, "certifications": certs, "soft_skills": soft}

    @classmethod
    def _is_required(cls, text: str, skill: str) -> str:
        idx = text.lower().find(skill.lower())
        if idx == -1:
            return "unspecified"
        start = max(0, idx - 100)
        end = min(len(text), idx + len(skill) + 100)
        ctx = text[start:end].lower()
        if any(w in ctx for w in ["required", "must have", "essential", "requirement", "needs", "necessary", "minimum"]):
            return "required"
        if any(w in ctx for w in ["preferred", "nice to have", "bonus", "plus", "desired", "ideal"]):
            return "preferred"
        return "unspecified"

    @classmethod
    def compute_match(cls, resume_parsed: dict, jd_extracted: dict, resume_text: str, jd_text: str) -> dict:
        resume_lower = resume_text.lower()
        required = jd_extracted.get("required_skills", [])
        matched, missing, hard, nice = [], [], [], []
        for skill in required:
            status = cls._is_required(jd_text, skill)
            found = bool(re.search(r'\b' + re.escape(skill) + r'\b', resume_text, re.IGNORECASE))
            entry = {"skill": skill, "status": status, "found_in_resume": found}
            if found:
                matched.append(entry)
            else:
                missing.append(entry)
                if status == "required":
                    hard.append(entry)
                else:
                    nice.append(entry)
        gaps = cls._find_semantic_gaps(resume_parsed, jd_text)
        over = cls._find_over_indexed(resume_parsed, jd_text)
        total = len(matched) + len(missing)
        score = round((len(matched) / total * 100) if total > 0 else 50, 1)
        score -= min(50, len(hard) * 15 + len(nice) * 5)
        score = max(0, min(100, score))
        return {"match_score": score, "matched_keywords": matched, "missing_keywords": missing, "hard_requirements": hard, "nice_to_have": nice, "semantic_gaps": gaps, "over_indexed": over, "raw_extracted": jd_extracted}

    @classmethod
    def _find_semantic_gaps(cls, resume_parsed: dict, jd_text: str) -> list:
        gaps = []
        jd_lower = jd_text.lower()
        exp = resume_parsed.get("experience", [])
        if "leadership" in jd_lower or "manage" in jd_lower:
            has = any("led" in (b or "").lower() or "managed" in (b or "").lower() for e in exp for b in e.get("bullets", []))
            if not has:
                gaps.append({"jd_term": "leadership/management", "suggestion": "Use 'Led' or 'Managed' explicitly"})
        if "mentor" in jd_lower:
            has = any("mentor" in (b or "").lower() or "train" in (b or "").lower() for e in exp for b in e.get("bullets", []))
            if not has:
                gaps.append({"jd_term": "mentoring", "suggestion": "Add mentoring/training bullets if applicable"})
        if "cross-functional" in jd_lower:
            has = any("cross-functional" in (b or "").lower() or "collaborated" in (b or "").lower() for e in exp for b in e.get("bullets", []))
            if not has:
                gaps.append({"jd_term": "cross-functional collaboration", "suggestion": "Add cross-team collaboration examples"})
        return gaps

    @classmethod
    def _find_over_indexed(cls, resume_parsed: dict, jd_text: str) -> list:
        over = []
        jd_lower = jd_text.lower()
        for s in resume_parsed.get("skills", []):
            if s.lower() not in jd_lower:
                over.append({"item": s, "type": "skill", "suggestion": f"De-emphasize '{s}' for this JD"})
        for c in resume_parsed.get("certifications", []):
            if c.lower() not in jd_lower:
                over.append({"item": c, "type": "certification", "suggestion": f"'{c}' not mentioned in JD"})
        return over[:5]
