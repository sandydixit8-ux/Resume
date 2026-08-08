"""Start backend in a thread and test API endpoints."""
import threading, time, sys, os

backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

# Clean up old db
for f in ["resume_ats.db", "resume_ats.db-wal", "resume_ats.db-shm"]:
    try:
        os.remove(os.path.join(backend_dir, f))
    except:
        pass

PORT = 8765
BASE = f"http://localhost:{PORT}"

# Start server in a thread
server_errors = []
def start_server():
    try:
        import uvicorn
        from app.main import app
        uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="error")
    except Exception as e:
        server_errors.append(str(e))

t = threading.Thread(target=start_server, daemon=True)
t.start()
time.sleep(3)

import httpx

client = httpx.Client(base_url=BASE, timeout=10)

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

try:
    # Wait for startup
    for i in range(20):
        try:
            r = client.get("/api/v1/health")
            if r.status_code == 200 and r.json().get("status") == "ok":
                print(f"Server started (attempt {i+1})")
                break
        except:
            time.sleep(1)
    else:
        print(f"Server errors: {server_errors}")
        sys.exit(1)

    # 1. Paste resume
    r = client.post("/api/v1/resume/paste", data={"text": "John Doe\njohn@example.com\n\nSKILLS\nPython, JavaScript, React\n\nEXPERIENCE\n\nDev | Corp\n2020 - Present\n* Built apps\n\nEDUCATION\nB.S.", "filename": "t.txt"})
    check("paste resume", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    if r.status_code == 200:
        resume_id = r.json().get("id")
        check("resume has id", resume_id is not None, f"data={r.json()}")

        if resume_id:
            # 2. Analyze
            r = client.post(f"/api/v1/analyze/{resume_id}")
            check("analyze resume", r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")
            if r.status_code == 200:
                print(f"    ATS Score: {r.json().get('overall_score')}")

            # 3. JD Match
            r = client.post(f"/api/v1/jd-match/{resume_id}", json={"jd_text": "Looking for Python developer with React experience"})
            check("jd match", r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")
            if r.status_code == 200:
                jd = r.json()
                check("jd has match_score", jd.get("match_score") is not None, f"data={jd}")
                print(f"    JD Match: {jd.get('match_score')}%")

            # 4. Rewrite
            r = client.post(f"/api/v1/rewrite/{resume_id}", json={})
            check("rewrite", r.status_code == 200, f"status={r.status_code}")

            # 5. Cover Letter
            r = client.post("/api/v1/cover-letter/", json={"resume_id": resume_id, "jd_text": "Software engineer position", "tone": "professional", "length": "medium"})
            check("cover letter", r.status_code == 200, f"status={r.status_code}")

    # 6. List resumes
    r = client.get("/api/v1/resume/")
    check("list resumes", r.status_code == 200, f"status={r.status_code}")

except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()

print(f"\n{'='*40}")
print(f"Results: {passed}/{total} passed")
if passed == total:
    print("ALL TESTS PASSED!")
else:
    print(f"SOME TESTS FAILED ({total - passed} failures)")
