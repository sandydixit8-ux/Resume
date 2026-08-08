import re

class InterviewPrepService:

    BEHAVIORAL_TEMPLATES = [
        "Tell me about a time you {action}.",
        "Describe a situation where you had to {challenge}.",
        "Give an example of a goal you achieved and how you {action}.",
        "Tell me about a time you failed at {context} and how you handled it.",
        "Describe a situation where you had to work with {someone} to {goal}.",
        "Tell me about a time you had to {action} under a tight deadline.",
        "Describe a time you {action} and made a significant impact.",
        "Tell me about a situation where you had to {skill} to solve a problem.",
    ]

    LEADERSHIP_TEMPLATES = [
        "Describe your experience leading {context}.",
        "How do you approach mentoring junior team members?",
        "Tell me about a time you had to influence {stakeholders} without authority.",
        "How do you handle conflict within your team?",
        "Describe your approach to {responsibility}.",
    ]

    TECHNICAL_PROMPTS = {
        "python": ["Explain Python decorators and give an example.", "How does Python handle memory management?", "What is the difference between lists and tuples?"],
        "javascript": ["Explain closures in JavaScript.", "How does the event loop work?", "What is the difference between == and ==="],
        "react": ["Explain the virtual DOM.", "What are React hooks and how do they work?", "How do you manage state in a React application?"],
        "typescript": ["What are the benefits of TypeScript over JavaScript?", "Explain interfaces vs types in TypeScript.", "How do generics work in TypeScript?"],
        "java": ["Explain the Java memory model.", "What is the difference between abstract classes and interfaces?", "How does garbage collection work in Java?"],
        "sql": ["Explain the difference between INNER JOIN and LEFT JOIN.", "What is a database index and how does it work?", "How do you optimize a slow query?"],
        "docker": ["Explain Docker container vs VM.", "How do you optimize Docker image size?", "What is Docker Compose used for?"],
        "kubernetes": ["Explain Kubernetes pods and deployments.", "How does Kubernetes service discovery work?", "What is a Helm chart?"],
        "aws": ["Explain the core AWS services you've used.", "How do you design for high availability on AWS?", "What is the difference between S3 and EBS?"],
        "git": ["Explain Git branching strategy.", "How do you resolve merge conflicts?", "What is the difference between rebase and merge?"],
        "agile": ["Explain Scrum vs Kanban.", "How do you handle sprint planning?", "What is your experience with retrospectives?"],
        "machine learning": ["Explain overfitting and how to prevent it.", "What evaluation metrics do you use for classification?", "Explain the bias-variance tradeoff."],
    }

    @classmethod
    def generate_questions(cls, resume_parsed: dict, raw_text: str, jd_text: str = None) -> list:
        questions = []

        resume_based = cls._generate_resume_questions(resume_parsed)
        questions.extend(resume_based)

        jd_based = cls._generate_jd_questions(resume_parsed, raw_text, jd_text)
        questions.extend(jd_based)

        behavioral = cls._generate_behavioral_questions(resume_parsed)
        questions.extend(behavioral)

        technical = cls._generate_technical_questions(resume_parsed, jd_text)
        questions.extend(technical)

        leadership = cls._generate_leadership_questions(resume_parsed)
        questions.extend(leadership)

        return questions[:25]

    @classmethod
    def _generate_resume_questions(cls, resume_parsed: dict) -> list:
        questions = []
        for exp in resume_parsed.get("experience", [])[:3]:
            title = exp.get("title", "")
            company = exp.get("company", "")
            bullets = exp.get("bullets", [])
            if title:
                questions.append({
                    "category": "resume",
                    "question": f"Walk me through your experience as {title} at {company}. What were your key responsibilities and achievements?",
                    "context": f"Role: {title} at {company}",
                    "type": "experience",
                })
            for bullet in bullets[:2]:
                questions.append({
                    "category": "resume",
                    "question": f"Tell me more about this achievement: \"{bullet.strip()}\". What specific actions did you take and what was the impact?",
                    "context": f"From {title} at {company}" if title else "From resume",
                    "type": "experience",
                })
        skills = resume_parsed.get("skills", [])
        if skills:
            top = skills[:5]
            questions.append({
                "category": "resume",
                "question": f"Your resume lists {', '.join(top)} as key skills. Can you rank these by proficiency and describe a project where you used the top one?",
                "context": "Skills assessment",
                "type": "skills",
            })
        projects = resume_parsed.get("projects", [])
        for proj in projects[:2]:
            name = proj.get("name", "")
            desc = proj.get("description", "")
            if name:
                questions.append({
                    "category": "resume",
                    "question": f"Tell me about your project \"{name}\". What problem did it solve, what technologies did you use, and what was your specific contribution?",
                    "context": f"Project: {name}" + (f" - {desc[:80]}" if desc else ""),
                    "type": "project",
                })
        return questions

    @classmethod
    def _generate_jd_questions(cls, resume_parsed: dict, raw_text: str, jd_text: str) -> list:
        questions = []
        if not jd_text:
            return questions

        jd_lower = jd_text.lower()

        req_keywords = []
        lines = jd_text.split("\n")
        in_req = False
        for line in lines:
            ll = line.lower().strip()
            if any(w in ll for w in ["requirements", "qualifications", "what you'll need", "about you", "skills required"]):
                in_req = True
                continue
            if any(w in ll for w in ["benefits", "about us", "why join", "apply now"]):
                in_req = False
            if in_req and len(ll) > 10:
                req_keywords.append(ll)

        questions.append({
            "category": "jd",
            "question": "Based on the job description, what aspects of this role excite you the most and how does your background align?",
            "context": "Job fit assessment",
            "type": "motivation",
        })

        for req in req_keywords[:3]:
            questions.append({
                "category": "jd",
                "question": f"The job requires: \"{req[:120]}\". Can you describe your relevant experience and how it prepared you for this?",
                "context": "Requirement from JD",
                "type": "jd_alignment",
            })

        tech_in_jd = set()
        for tech, prompts in cls.TECHNICAL_PROMPTS.items():
            if tech in jd_lower:
                tech_in_jd.add(tech)
                questions.append({
                    "category": "jd",
                    "question": prompts[0],
                    "context": f"Technical skill required: {tech}",
                    "type": "technical_jd",
                })

        if len(tech_in_jd) >= 2:
            questions.append({
                "category": "jd",
                "question": f"You'll be working with {', '.join(list(tech_in_jd)[:3])}. How have you integrated these technologies in past projects?",
                "context": "Tech stack integration",
                "type": "technical_jd",
            })

        return questions

    @classmethod
    def _generate_behavioral_questions(cls, resume_parsed: dict) -> list:
        questions = []
        actions = ["led a complex project to completion", "resolved a difficult conflict", "improved a process or system",
                    "mentored or trained a colleague", "made a data-driven decision", "handled a difficult stakeholder",
                    "worked with cross-functional teams", "had to learn a new technology quickly"]
        for action in actions[:4]:
            questions.append({
                "category": "behavioral",
                "question": f"Tell me about a time you {action}. What was the situation, your approach, and the outcome?",
                "context": f"Behavioral: {action[:50]}...",
                "type": "behavioral",
            })
        return questions

    @classmethod
    def _generate_technical_questions(cls, resume_parsed: dict, jd_text: str) -> list:
        questions = []
        all_skills = [s.lower() for s in resume_parsed.get("skills", [])]
        if jd_text:
            all_skills.extend(re.findall(r'\b(python|javascript|typescript|react|java|sql|docker|kubernetes|aws|git|agile|machine learning|node\.?js|graphql|redis|kafka|terraform)\b', jd_text.lower()))

        seen = set()
        for skill in all_skills:
            skill_clean = skill.strip().lower()
            if skill_clean in cls.TECHNICAL_PROMPTS and skill_clean not in seen:
                seen.add(skill_clean)
                prompts = cls.TECHNICAL_PROMPTS[skill_clean]
                questions.append({
                    "category": "technical",
                    "question": prompts[1] if len(prompts) > 1 else prompts[0],
                    "context": f"Technical: {skill_clean.title()}",
                    "type": "technical",
                })

        return questions

    @classmethod
    def _generate_leadership_questions(cls, resume_parsed: dict) -> list:
        questions = []
        titles = [e.get("title", "").lower() for e in resume_parsed.get("experience", [])]
        is_lead = any(w in " ".join(titles) for w in ["manager", "lead", "head", "director", "senior", "principal", "architect", "supervisor", "coordinator", "owner", "chief"])

        if is_lead:
            questions.append({
                "category": "leadership",
                "question": "Describe your leadership philosophy and how you've applied it in your previous roles.",
                "context": "Leadership assessment",
                "type": "leadership",
            })
            questions.append({
                "category": "leadership",
                "question": "How do you ensure your team stays aligned with organizational goals while maintaining high morale?",
                "context": "Leadership assessment",
                "type": "leadership",
            })

        return questions
