import httpx
import tempfile
import os
import json

print("=== P1-1: Empty file upload ===")
tmp = tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="wb")
tmp.write(b"")
tmp.close()
with open(tmp.name, "rb") as f:
    r = httpx.post("http://127.0.0.1:8000/api/v1/resume/upload", files={"file": ("empty.txt", f, "text/plain")}, timeout=10)
print(f"Status: {r.status_code}")
print(f"Body: {r.text[:200]}")
os.unlink(tmp.name)
assert r.status_code in (400, 422), f"FAIL: expected 400/422, got {r.status_code}"
print("PASS\n")

print("=== P1-2: Minimal resume parsing ===")
r = httpx.post("http://127.0.0.1:8000/api/v1/resume/paste", data={"text": "John Doe - Developer", "filename": "minimal.txt"}, timeout=10)
print(f"Status: {r.status_code}")
data = r.json()
issues_flag = data.get("has_parsing_issues")
issues = data.get("parsing_issues", [])
if isinstance(issues, str):
    issues = json.loads(issues)
print(f"has_parsing_issues: {issues_flag}")
print(f"Issues: {[i['type'] for i in issues]}")
assert issues_flag == True, f"FAIL: expected has_parsing_issues=True, got {issues_flag}"
assert len(issues) > 0, "FAIL: expected at least 1 parsing issue"
print("PASS\n")

print("=== P1-3: CORS default ===")
r = httpx.options("http://127.0.0.1:8000/api/v1/health", headers={"Origin": "http://evil.com", "Access-Control-Request-Method": "GET"}, timeout=10)
acao = r.headers.get("access-control-allow-origin", "NONE")
print(f"evil.com ACAO: {acao}")
assert acao != "*", f"FAIL: wildcard ACAO for evil.com"
r2 = httpx.options("http://127.0.0.1:8000/api/v1/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"}, timeout=10)
acao2 = r2.headers.get("access-control-allow-origin", "NONE")
print(f"localhost:3000 ACAO: {acao2}")
assert "localhost" in acao2, f"FAIL: localhost should be allowed, got {acao2}"
print("PASS\n")

print("=== ALL 3 P1 FIXES VERIFIED ===")
