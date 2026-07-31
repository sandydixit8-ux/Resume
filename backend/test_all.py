import subprocess, time, json, urllib.request, urllib.parse, sys, os, signal

BASE = "http://localhost:8000"
backend_dir = os.path.dirname(os.path.abspath(__file__))

def post_form(url, data):
    encoded = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=encoded)
    return json.loads(urllib.request.urlopen(req).read())

def post_json(url, data):
    encoded = json.dumps(data).encode()
    req = urllib.request.Request(url, data=encoded, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())

def get(url):
    return json.loads(urllib.request.urlopen(url).read())

# Clean old db
for f in ["resume_ats.db", "resume_ats.db-wal", "resume_ats.db-shm"]:
    p = os.path.join(backend_dir, f)
    if os.path.exists(p):
        os.remove(p)

# Start backend
proc = subprocess.Popen(
    [sys.executable, "run.py"],
    cwd=backend_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE
)
time.sleep(5)

# Check health
for i in range(10):
    try:
        h = get(BASE + "/api/v1/health")
        if h.get("status") == "ok":
            break
    except:
        time.sleep(1)
else:
    out, err = proc.communicate()
    print(f"Backend failed. OUT: {out.decode()[:500]}")
    print(f"ERR: {err.decode()[:500]}")
    sys.exit(1)

passed = 0
failed = 0

def check(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"  PASS: {name}")
    else:
        failed += 1
        print(f"  FAIL: {name} - {detail}")

try:
    # 1. Paste resume
    resume = post_form(BASE + "/api/v1/resume/paste", {
        "text": "John Doe\njohn@example.com\n\nPROFESSIONAL SUMMARY\nExperienced software engineer.\n\nSKILLS\nPython, JavaScript, React, AWS, Docker\n\nEXPERIENCE\n\nSenior Engineer | TechCorp\nJan 2020 - Present\n* Led microservices for 1M+ users\n* Reduced API response by 40%\n\nEDUCATION\nB.S. Computer Science\n\nCERTIFICATIONS\nAWS Certified",
        "filename": "test.txt"
    })
    rid = resume["id"]
    check("Paste resume", rid > 0)
    check("Has parsed JSON", "skills" in resume.get("parsed_json", {}))
    check("Has contact info", "email" in resume.get("parsed_json", {}).get("contact_info", {}))

    # 2. ATS Analysis
    analysis = post_json(BASE + f"/api/v1/analyze/{rid}", {})
    check("ATS analysis", analysis["overall_score"] > 0, f"score={analysis['overall_score']}")

    # 3. JD Match
    jd = "Senior SWE at Google. Required: Python, JavaScript, React, AWS, Docker, Kubernetes, leadership."
    match = post_json(BASE + f"/api/v1/jd-match/{rid}", {"jd_text": jd})
    check("JD Match", match["match_score"] > 0, f"score={match['match_score']}%")
    check("JD matched keywords", len(match.get("matched_keywords", [])) > 0)

    # 4. Rewrite suggestions
    rewrites = post_json(BASE + f"/api/v1/rewrite/{rid}", {"jd_text": jd})
    check("Rewrite suggestions", len(rewrites["suggestions"]) > 0)

    # 5. Cover letter
    cl = post_json(BASE + "/api/v1/cover-letter/", {
        "resume_id": rid, "jd_text": jd, "tone": "formal", "length": "medium"
    })
    check("Cover letter", len(cl["content"]) > 100)

    # 6. List endpoints
    check("List resumes", len(get(BASE + "/api/v1/resume/")) >= 1)
    check("List analyses", len(get(BASE + "/api/v1/analyze/")) >= 1)
    check("List JD matches", len(get(BASE + f"/api/v1/jd-match/{rid}")) >= 1)
    check("List cover letters", len(get(BASE + f"/api/v1/cover-letter/by-resume/{rid}")) >= 1)

    # 7. Get specific items
    check("Get resume", get(BASE + f"/api/v1/resume/{rid}")["id"] == rid)
    check("Get analysis", get(BASE + f"/api/v1/analyze/{rid}")["overall_score"] > 0)
    check("Get cover letter", get(BASE + f"/api/v1/cover-letter/{cl['id']}")["id"] == cl["id"])

    # 8. Delete
    del_req = urllib.request.Request(BASE + f"/api/v1/resume/{rid}", method="DELETE")
    del_resp = json.loads(urllib.request.urlopen(del_req).read())
    check("Delete resume", del_resp.get("detail") == "Resume deleted")

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed out of {passed+failed} tests")
    if failed == 0:
        print("ALL TESTS PASSED!")
    else:
        print(f"SOME TESTS FAILED!")
        sys.exit(1)

finally:
    proc.terminate()
    try:
        proc.wait(5)
    except:
        proc.kill()
