class CoverLetterService:

    TONES = {
        "formal": {"greeting": "Dear Hiring Manager,", "closing": "Sincerely,"},
        "conversational": {"greeting": "Hi there,", "closing": "Best regards,"},
        "enthusiastic": {"greeting": "Dear Team at {company},", "closing": "With enthusiasm,"},
        "executive": {"greeting": "Dear Hiring Committee,", "closing": "Respectfully,"}
    }

    LENGTHS = {
        "short": {"max_paras": 3, "max_words": 200},
        "medium": {"max_paras": 4, "max_words": 350},
        "long": {"max_paras": 5, "max_words": 500}
    }

    @classmethod
    def generate(cls, resume_parsed: dict, jd_text: str, tone="formal", length="medium", company_name=None, role_name=None):
        tc = cls.TONES.get(tone, cls.TONES["formal"])
        lc = cls.LENGTHS.get(length, cls.LENGTHS["medium"])
        contact = resume_parsed.get("contact_info", {})
        name = contact.get("name", "Applicant")
        email = contact.get("email", "")
        phone = contact.get("phone", "")
        skills = resume_parsed.get("skills", [])[:5]
        experience = resume_parsed.get("experience", [])[:2]
        greeting = tc["greeting"].format(company=company_name or "your company")
        closing = tc["closing"]
        company = company_name or "your organization"
        role = role_name or "the"
        top_skills = ", ".join(skills) if skills else "relevant skills"

        paras = []
        paras.append(f"I am writing to express my strong interest in the {role} role at {company}. "
                     f"As a professional with experience in {top_skills}, I am confident that my background aligns well with what {company} is looking for.")

        if experience:
            exp_lines = []
            for e in experience:
                title = e.get("title", "Professional")
                comp = e.get("company", "")
                bullets = e.get("bullets", [])[:2]
                intro = f"In my role as {title}"
                if comp:
                    intro += f" at {comp}"
                body = " ".join(b.strip("\u2022-*0123456789). ") for b in bullets if b)
                if body:
                    exp_lines.append(f"{intro}, I {body}.")
            if exp_lines:
                paras.append(" ".join(exp_lines))

        paras.append(f"My expertise in {top_skills} directly supports the requirements of this role. "
                     f"I am committed to delivering high-quality results and contributing to {company}'s success.")

        paras.append(f"I would welcome the opportunity to discuss how my experience can contribute to "
                     f"{company}'s continued success. Thank you for your consideration.")

        paras = paras[:lc["max_paras"]]

        letter = f"{greeting}\n\n"
        letter += "\n\n".join(paras)
        letter += f"\n\n{closing}\n{name}"
        if email:
            letter += f"\n{email}"
        if phone:
            letter += f"\n{phone}"
        return letter
