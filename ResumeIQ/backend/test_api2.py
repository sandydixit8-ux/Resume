"""Test API using FastAPI TestClient."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Clean up old db
for f in ["resume_ats.db", "resume_ats.db-wal", "resume_ats.db-shm"]:
    try:
        os.remove(os.path.join(os.path.dirname(os.path.abspath(__file__)), f))
    except:
        pass

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

passed = 0
total = 0

def check(name, cond, detail=""):
    global passed, total
    total += 1
    if cond:
        passed += 1
        print(f"  OK  {name}")
    else:
        print(f"  FAIL {name} - {detail}")

# 1. Health
r = client.get("/api/v1/health")
check("health", r.status_code == 200 and r.json().get("status") == "ok", f"status={r.status_code} body={r.text[:100]}")

# 2. Paste resume
r = client.post("/api/v1/resume/paste", data={"text": "John Doe\njohn@example.com\n\nSKILLS\nPython, JavaScript, React\n\nEXPERIENCE\n\nDev | Corp\n2020 - Present\n* Built apps\n\nEDUCATION\nB.S.", "filename": "t.txt"})
check("paste resume", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

if r.status_code == 200:
    resume_data = r.json()
    resume_id = resume_data.get("id")
    check("resume has id", resume_id is not None, f"data={resume_data}")

    if resume_id:
        # 3. Analyze
        r = client.post(f"/api/v1/analyze/{resume_id}")
        check("analyze resume", r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")

        if r.status_code == 200:
            analysis = r.json()
            check("analysis has score", analysis.get("overall_score") is not None, f"data={analysis}")
            print(f"    ATS Score: {analysis.get('overall_score')}")

            # 4. JD Match
            r = client.post(f"/api/v1/jd-match/{resume_id}", json={"jd_text": "Looking for Python developer with React experience"})
            check("jd match", r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")

            if r.status_code == 200:
                jd_data = r.json()
                check("jd has score", jd_data.get("match_score") is not None, f"data={jd_data}")
                print(f"    JD Match Score: {jd_data.get('match_score')}")

                jd_id = jd_data.get("id")
                if jd_id:
                    r = client.get(f"/api/v1/jd-match/detail/{jd_id}")
                    check("jd detail", r.status_code == 200, f"status={r.status_code}")

            # 5. Rewrite
            r = client.post(f"/api/v1/rewrite/{resume_id}", json={})
            check("rewrite", r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")

        # 6. Cover Letter
        r = client.post(f"/api/v1/cover-letter/", json={"resume_id": resume_id, "jd_text": "Software engineer position", "tone": "professional", "length": "medium"})
        check("cover letter", r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")

        if r.status_code == 200:
            cl_data = r.json()
            cl_id = cl_data.get("id")
            if cl_id:
                r = client.get(f"/api/v1/cover-letter/{cl_id}")
                check("get cover letter", r.status_code == 200, f"status={r.status_code}")

                r = client.get(f"/api/v1/cover-letter/by-resume/{resume_id}")
                check("list cover letters", r.status_code == 200, f"status={r.status_code}")

# 7. List resumes
r = client.get("/api/v1/resume/")
check("list resumes", r.status_code == 200, f"status={r.status_code}")

print(f"\n{'='*40}")
print(f"Results: {passed}/{total} passed")
if passed == total:
    print("ALL TESTS PASSED!")
else:
    print(f"SOME TESTS FAILED ({total - passed} failures)")
