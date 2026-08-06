"""Test backend directly (no server needed - test imports and services)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ["DATABASE_URL"] = "sqlite:///./test_standalone.db"

# Init DB
from app.database import init_db, SessionLocal
init_db()

from app.models.resume import Resume
from app.models.analysis import Analysis
from app.services.resume_parser import ResumeParserService
from app.services.ats_scorer import ATSScorerService
from app.services.jd_matcher import JDMatcherService
from app.services.rewrite import RewriteService
from app.services.cover_letter import CoverLetterService

db = SessionLocal()

try:
    # 1. Parse and store resume
    parsed = ResumeParserService.parse_text("""John Doe
john@example.com | (555) 123-4567

PROFESSIONAL SUMMARY
Experienced software engineer with 5+ years building scalable web applications.

SKILLS
Python, JavaScript, React, Node.js, AWS, Docker, PostgreSQL, Git, Agile

EXPERIENCE

Senior Software Engineer | TechCorp
Jan 2020 - Present
* Led development of microservices architecture serving 1M+ users
* Reduced API response time by 40% through query optimization
* Mentored 3 junior developers
* Implemented CI/CD pipeline reducing deployment time by 60%

Software Engineer | StartupXYZ
Jun 2017 - Dec 2019
* Built React-based dashboard used by 500+ enterprise clients
* Optimized database queries resulting in 30% performance improvement

EDUCATION
B.S. Computer Science, University of Technology, 2017

CERTIFICATIONS
AWS Solutions Architect""")

    print(f"1. Parse: {parsed['has_parsing_issues']}, skills={len(parsed['parsed_json']['skills'])}")

    resume = Resume(
        filename="test.txt",
        original_filename="test.txt",
        raw_text=parsed["raw_text"],
        ats_view_text=parsed["ats_view_text"],
        parsed_json=json.dumps(parsed["parsed_json"]),
        has_parsing_issues=parsed["has_parsing_issues"],
        parsing_issues=parsed.get("parsing_issues", "[]"),
        file_type=".txt",
        file_size_bytes=len(parsed["raw_text"].encode("utf-8")),
    )
    db.add(resume)
    db.commit()
    rid = resume.id
    print(f"2. Stored resume id={rid}")

    # 2. ATS Analysis
    parsed_result = {
        "raw_text": resume.raw_text,
        "parsed_json": json.loads(resume.parsed_json),
        "parsing_issues": json.loads(resume.parsing_issues) if resume.parsing_issues else [],
        "file_size": resume.file_size_bytes
    }
    score = ATSScorerService.score(parsed_result)
    print(f"3. ATS Score: {score['overall_score']}")
    print(f"   Categories: {score['category_scores']}")
    print(f"   Priority fixes: {len(score['priority_fixes'])}")

    # 3. JD Match
    jd = "Senior SWE. Required: Python, JavaScript, React, AWS, Docker, Kubernetes, 5+ years, leadership."
    extracted = JDMatcherService.extract_keywords(jd)
    match = JDMatcherService.compute_match(
        json.loads(resume.parsed_json), extracted, resume.raw_text, jd
    )
    print(f"4. JD Match: {match['match_score']}%")
    print(f"   Matched: {[k['skill'] for k in match['matched_keywords'][:5]]}")
    print(f"   Missing: {[k['skill'] for k in match['missing_keywords'][:5]]}")

    # 4. Rewrite suggestions
    rewrites = RewriteService.generate_suggestions(
        json.loads(resume.parsed_json), resume.raw_text, jd
    )
    print(f"5. Rewrites: {len(rewrites)} suggestions")
    for r in rewrites[:3]:
        print(f"   [{r['type']}] {r['section']}: {r['explanation'][:60]}")

    # 5. Cover letter
    cl = CoverLetterService.generate(
        json.loads(resume.parsed_json), jd, tone="formal", length="medium"
    )
    print(f"6. Cover Letter: {len(cl)} chars")
    print(f"   First 100: {cl[:100]}...")

    print("\nALL TESTS PASSED!")

finally:
    db.close()
    os.remove("test_standalone.db")
    os.remove("test_standalone.db-wal")
    os.remove("test_standalone.db-shm")
