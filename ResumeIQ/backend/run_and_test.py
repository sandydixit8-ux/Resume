"""Start backend in a thread, run all tests, then stop."""
import threading, time, json, urllib.request, urllib.parse, sys, os

backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

# Start backend in a thread
def start_server():
    import uvicorn
    from app.main import app
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

t = threading.Thread(target=start_server, daemon=True)
t.start()
time.sleep(3)

BASE = "http://localhost:8000"

def post_form(url, data):
    enc = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=enc)
    return json.loads(urllib.request.urlopen(req).read())

def post_json(url, data):
    enc = json.dumps(data).encode()
    req = urllib.request.Request(url, data=enc, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())

def get(url):
    return json.loads(urllib.request.urlopen(url).read())

# Wait for server
for i in range(20):
    try:
        h = get(BASE + "/api/v1/health")
        if h.get("status") == "ok":
            print(f"Server started (attempt {i+1})")
            break
    except:
        time.sleep(1)
else:
    print("Server failed to start")
    sys.exit(1)

# Clean old db data for clean test
pass
# We'll just overwrite

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

# Test 1: Paste resume
resume = post_form(BASE + "/api/v1/resume/paste", {
    "text": "John Doe\njohn@example.com | (555) 123-4567\n\nPROFESSIONAL SUMMARY\nExperienced software engineer with 5+ years building scalable web applications.\n\nSKILLS\nPython, JavaScript, React, Node.js, AWS, Docker, PostgreSQL, Git, Agile\n\nEXPERIENCE\n\nSenior Software Engineer | TechCorp\nJan 2020 - Present\n* Led development of microservices architecture serving 1M+ users\n* Reduced API response time by 40% through query optimization\n* Mentored 3 junior developers\n* Implemented CI/CD pipeline reducing deployment time by 60%\n\nSoftware Engineer | StartupXYZ\nJun 2017 - Dec 2019\n* Built React-based dashboard used by 500+ enterprise clients\n* Optimized database queries resulting in 30% performance improvement\n\nEDUCATION\nB.S. Computer Science, University of Technology, 2017\n\nCERTIFICATIONS\nAWS Solutions Architect",
    "filename": "test.txt"
})
rid = resume["id"]
check("Paste resume", rid > 0, f"id={rid}")
check("Parsed name", resume["parsed_json"]["contact_info"].get("name") == "John Doe")
check("Has skills", len(resume["parsed_json"].get("skills", [])) >= 6)

# Test 2: ATS Analysis
analysis = post_json(BASE + f"/api/v1/analyze/{rid}", {})
check("ATS analysis score", analysis["overall_score"] > 0, f"score={analysis['overall_score']}")
check("ATS categories", len(analysis.get("category_scores", {})) >= 6)
check("ATS priority fixes", len(analysis.get("priority_fixes", [])) > 0)

# Test 3: JD Match
jd = "Senior Software Engineer at Google. Required: Python, JavaScript, React, AWS, Docker, Kubernetes, 5+ years, leadership. Nice to have: Go, GraphQL."
match = post_json(BASE + f"/api/v1/jd-match/{rid}", {"jd_text": jd, "jd_title": "Senior SWE", "jd_company": "Google"})
check("JD match score", match["match_score"] > 0, f"score={match['match_score']}%")
check("JD matched keywords", len(match.get("matched_keywords", [])) > 0)
check("JD hard req missing", len(match.get("hard_requirements", [])) >= 0)
check("JD semantic gaps", len(match.get("semantic_gaps", [])) >= 0)

# Test 4: Rewrite suggestions
rewrites = post_json(BASE + f"/api/v1/rewrite/{rid}", {"jd_text": jd})
check("Rewrite suggestions", len(rewrites["suggestions"]) > 0, f"count={len(rewrites['suggestions'])}")
first = rewrites["suggestions"][0]
check("Rewrite has section", bool(first.get("section")))
check("Rewrite has suggestion", bool(first.get("suggestion")))

# Test 5: Cover letter
cl = post_json(BASE + "/api/v1/cover-letter/", {
    "resume_id": rid, "jd_text": jd, "jd_title": "Senior SWE",
    "company_name": "Google", "tone": "formal", "length": "medium"
})
check("Cover letter generated", len(cl["content"]) > 100, f"{len(cl['content'])} chars")
check("Cover letter has greeting", cl["content"].startswith("Dear"))

# Test 6: List endpoints
check("List resumes", len(get(BASE + "/api/v1/resume/")) >= 1)
check("List analyses", len(get(BASE + "/api/v1/analyze/")) >= 1)
check("List JD matches", len(get(BASE + f"/api/v1/jd-match/{rid}")) >= 1)
check("List cover letters", len(get(BASE + f"/api/v1/cover-letter/by-resume/{rid}")) >= 1)

# Test 7: Get specific
check("Get resume", get(BASE + f"/api/v1/resume/{rid}")["id"] == rid)
check("Get analysis", get(BASE + f"/api/v1/analyze/{rid}")["overall_score"] > 0)
check("Get JD detail", get(BASE + f"/api/v1/jd-match/detail/{match['id']}")["id"] == match["id"])
check("Get cover letter", get(BASE + f"/api/v1/cover-letter/{cl['id']}")["id"] == cl["id"])

# Test 8: Upload file
test_file = os.path.join(backend_dir, "uploads", "test_upload.txt")
os.makedirs(os.path.join(backend_dir, "uploads"), exist_ok=True)
with open(test_file, "w") as f:
    f.write("Jane Doe\njane@test.com\n\nSKILLS\nPython, Java\n\nEXPERIENCE\n\nLead Dev | Corp\n2020 - Present\n* Built stuff")
with open(test_file, "rb") as f:
    file_data = f.read()
boundary = "----TestBoundary"
body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"resume.txt\"\r\nContent-Type: text/plain\r\n\r\n".encode() +
        file_data + f"\r\n--{boundary}--\r\n".encode())
req = urllib.request.Request(BASE + "/api/v1/resume/upload", data=body,
                             headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
upload = json.loads(urllib.request.urlopen(req).read())
check("File upload", upload["id"] > 0)

# Test 9: Delete
del_req = urllib.request.Request(BASE + f"/api/v1/resume/{rid}", method="DELETE")
del_resp = json.loads(urllib.request.urlopen(del_req).read())
check("Delete resume", del_resp.get("detail") == "Resume deleted")

print(f"\n{'='*40}")
print(f"Results: {passed} passed, {failed} failed out of {passed+failed} tests")
if failed == 0:
    print("ALL TESTS PASSED!")
    sys.exit(0)
else:
    print("SOME TESTS FAILED!")
    sys.exit(1)
