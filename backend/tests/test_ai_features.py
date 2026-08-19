import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.ai_rewriter import generate_achievements, generate_summary, generate_skills, improve_experience, linkedin_profile
from app.services.country_rules import get_country, list_countries, COUNTRY_RULES
from app.services.exporter import export_resume


SAMPLE = {
    "contact_info": {"name": "Sandeep Kumar"},
    "summary": "Results-oriented data scientist skilled in Python, SQL and machine learning.",
    "skills": ["Python", "SQL", "Machine Learning"],
    "experience": [
        {
            "title": "Senior Data Scientist",
            "company": "Acme Corp",
            "dates": "Jan 2020 - Dec 2024",
            "bullets": ["Responsible for building machine learning models", "Reduced model training time by 35%"],
        }
    ],
    "education": [{"institution": "IIT Delhi", "degree": "B.Tech Computer Science"}],
    "certifications": ["AWS Certified"],
}


def test_achievements_strips_cliches():
    result = generate_achievements(SAMPLE)
    assert result["source"] == "rules"
    first = result["achievements"][0]["achievement"]
    assert "Responsible for" not in first
    assert first[0].isupper()


def test_summary_cleans_cliches():
    result = generate_summary(SAMPLE)
    assert result["source"] == "rules"
    assert "results-oriented" not in result["optimized"].lower()
    assert "data scientist" in result["optimized"].lower()


def test_skills_categories():
    result = generate_skills(SAMPLE)
    assert result["source"] == "rules"
    assert "Data" in result["categories"]
    assert result["categories"]["Data"]


def test_improve_experience_verbs():
    result = improve_experience(SAMPLE)
    assert result["source"] == "rules"
    assert any("respons" not in r["rewritten"].lower() for r in result["rewrites"])


def test_verb_conversions_present_to_past():
    from app.services.rewrite import RewriteService
    sample_present = {
        "experience": [
            {
                "title": "Project Manager",
                "company": "Acme",
                "bullets": [
                    "Direct EOI, DPR, and RFP governance for AI platform",
                    "Control program budgeting and procurement",
                    "Lead planning and execution of e-Governance programs"
                ]
            }
        ]
    }
    suggestions = RewriteService.generate_suggestions(sample_present, "")
    verbs_upgraded = [s for s in suggestions if s.get("type") == "verb_upgrade"]
    assert len(verbs_upgraded) == 3
    assert verbs_upgraded[0]["suggestion"].startswith("Directed ")
    assert verbs_upgraded[1]["suggestion"].startswith("Managed ")
    assert verbs_upgraded[2]["suggestion"].startswith("Led ")


def test_linkedin_fallback():
    result = linkedin_profile(SAMPLE)
    assert result["headline"]
    assert "Senior Data Scientist" in result["headline"]
    assert result["about"]


def test_country_rules_all_present():
    codes = list_countries()
    assert len(codes) == 29
    assert {c["code"] for c in codes} == set(COUNTRY_RULES)
    uae = get_country("ae")
    assert uae["photo"] == "yes"
    assert "visa_status" in uae["fields"]
    us = get_country("us")
    assert us["photo"] == "no"
    assert us["fields"] == []


@pytest.mark.parametrize("fmt,ext", [
    ("docx", ".docx"), ("pdf", ".pdf"), ("html", ".html"), ("md", ".md"),
    ("tex", ".tex"), ("json", ".json"), ("europass", ".xml"),
])
def test_exports_generate_bytes(fmt, ext):
    data, filename, media = export_resume(SAMPLE, fmt, country_code="ae")
    assert isinstance(data, bytes)
    assert len(data) > 100
    assert filename.endswith(ext)


def test_export_unknown_format_raises():
    with pytest.raises(ValueError):
        export_resume(SAMPLE, "nope")


def test_ai_endpoints_via_api():
    session = {"X-Session-Token": "test-session-token"}

    client = TestClient(app)
    resp = client.post("/api/v1/resume/paste", data={
        "text": "\n".join([
            "Sandeep Kumar", "SUMMARY", "Data scientist with Python skills.",
            "SKILLS", "Python, SQL, AWS", "EXPERIENCE", "Data Scientist", "Acme",
            "Jan 2020 - Dec 2024", "- Responsible for building models",
        ]),
    }, headers=session)
    assert resp.status_code == 200
    rid = resp.json()["id"]
    assert client.get("/api/v1/countries").json()["countries"]
    assert client.get("/api/v1/ai/status").status_code == 200
    ach = client.post(f"/api/v1/ai/achievements/{rid}", json={}, headers=session)
    assert ach.status_code == 200
    assert "achievements" in ach.json()
    assert client.post(f"/api/v1/ai/summary/{rid}", json={}, headers=session).status_code == 200
    assert client.post(f"/api/v1/ai/skills/{rid}", json={}, headers=session).status_code == 200
    assert client.post(f"/api/v1/ai/improve/{rid}", json={}, headers=session).status_code == 200
    assert client.post(f"/api/v1/ai/linkedin/{rid}", json={}, headers=session).status_code == 200
    exp = client.post("/api/v1/export", json={"format": "pdf", "country": "ae", "resume_id": rid}, headers=session)
    assert exp.status_code == 200
    assert exp.headers["content-type"] == "application/pdf"
