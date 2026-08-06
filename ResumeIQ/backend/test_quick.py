import json, urllib.request, urllib.parse, sys

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

# Test health
print("1. Health:", get(BASE + "/api/v1/health")["status"])

# Test paste resume
resume = post_form(BASE + "/api/v1/resume/paste", {
    "text": "John Doe\njohn@example.com | (555) 123-4567\n\nPROFESSIONAL SUMMARY\nExperienced engineer.\n\nSKILLS\nPython, JavaScript, React, AWS, Docker\n\nEXPERIENCE\n\nSenior Engineer | TechCorp\nJan 2020 - Present\n* Led microservices for 1M+ users\n* Reduced API response by 40%\n\nEDUCATION\nB.S. Computer Science",
    "filename": "test.txt"
})
rid = resume["id"]
print(f"2. Resume ID: {rid}")
print(f"   Skills: {resume['parsed_json']['skills'][:3]}")
print(f"   Contact: {resume['parsed_json']['contact_info']}")

# Test analysis
analysis = post_json(BASE + f"/api/v1/analyze/{rid}", {})
print(f"3. ATS Score: {analysis['overall_score']}")
cats = list(analysis['category_scores'].keys())[:3]
print(f"   Categories: {cats}")

# Test JD match
match = post_json(BASE + f"/api/v1/jd-match/{rid}", {
    "jd_text": "Senior SWE. Required: Python, JavaScript, React, AWS, Docker, Kubernetes.",
    "jd_title": "Senior SWE",
    "jd_company": "Google"
})
print(f"4. JD Match: {match['match_score']}%")
matched = [k['skill'] for k in match['matched_keywords']]
print(f"   Matched: {matched}")

# Test rewrite
rewrites = post_json(BASE + f"/api/v1/rewrite/{rid}", {})
print(f"5. Rewrites: {len(rewrites['suggestions'])} suggestions")

# Test cover letter
cl = post_json(BASE + "/api/v1/cover-letter/", {
    "resume_id": rid,
    "jd_text": "Senior SWE at Google. Required: Python, JS, React, AWS.",
    "jd_title": "Senior SWE",
    "company_name": "Google",
    "tone": "formal",
    "length": "medium"
})
print(f"6. Cover Letter: {len(cl['content'])} chars")

print("\nALL TESTS PASSED!")
