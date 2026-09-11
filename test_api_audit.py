"""
ResumeIQ Backend API — Comprehensive QA / Security Test Suite
=============================================================
All tests are read-only (no source modifications). Results printed as a table.
"""

import json
import time
import base64
import hashlib
import hmac
import io
import sys

try:
    import httpx
except ImportError:
    sys.exit("httpx not installed")

BASE = "http://127.0.0.1:8000"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

client = httpx.Client(base_url=BASE, timeout=30, follow_redirects=True)

results: list[dict] = []


def record(name, expected, actual, passed, note=""):
    results.append({
        "test": name,
        "expected": expected,
        "actual": actual,
        "status": "PASS" if passed else "FAIL",
        "note": note,
    })


# ── 1. Health Check ──────────────────────────────────────────────────────────

def test_health():
    r = client.get("/api/v1/health")
    body = r.json()
    ok = r.status_code == 200 and "version" in body
    record("Health check", "200 + version", f"{r.status_code}", ok, f"version={body.get('version')}")


# ── 2. Resume Endpoints ─────────────────────────────────────────────────────

RESUME_ID = None
SESSION_TOKEN = None


def test_resume_paste_valid():
    global RESUME_ID, SESSION_TOKEN
    r = client.post("/api/v1/resume/paste", data={
        "text": "John Doe\nSoftware Engineer\nPython, FastAPI, SQL\n5 years experience at Acme Corp"
    })
    body = r.json()
    ok = r.status_code == 200 and "id" in body
    if ok:
        RESUME_ID = body["id"]
        SESSION_TOKEN = body.get("session_token")
    record("Resume paste (valid)", "200 + id", f"{r.status_code} id={body.get('id')}", ok)


def test_resume_paste_empty():
    r = client.post("/api/v1/resume/paste", data={"text": "   "})
    ok = r.status_code in (400, 422)
    record("Resume paste (empty text)", "400 or 422", f"{r.status_code}", ok)


def test_resume_list():
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    r = client.get("/api/v1/resume/", headers=hdrs)
    ok = r.status_code == 200
    record("Resume list", "200", f"{r.status_code}", ok)


def test_resume_get_404():
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    r = client.get("/api/v1/resume/99999", headers=hdrs)
    ok = r.status_code == 404
    record("Resume GET 99999", "404", f"{r.status_code}", ok)


def test_resume_delete_404():
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    r = client.delete("/api/v1/resume/99999", headers=hdrs)
    ok = r.status_code == 404
    record("Resume DELETE 99999", "404", f"{r.status_code}", ok)


# ── 3. Analysis Endpoints ───────────────────────────────────────────────────


def test_analyze_create():
    if RESUME_ID is None:
        record("Analysis create", "200 + overall_score", "SKIPPED (no resume_id)", False)
        return
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    r = client.post(f"/api/v1/analyze/{RESUME_ID}", headers=hdrs)
    body = r.json()
    ok = r.status_code == 200 and "overall_score" in body
    record("Analysis create", "200 + overall_score", f"{r.status_code} score={body.get('overall_score')}", ok)


def test_analyze_get():
    if RESUME_ID is None:
        record("Analysis get", "200", "SKIPPED (no resume_id)", False)
        return
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    r = client.get(f"/api/v1/analyze/{RESUME_ID}", headers=hdrs)
    ok = r.status_code == 200 and "overall_score" in r.json()
    record("Analysis GET (existing)", "200", f"{r.status_code}", ok)


def test_analyze_get_404():
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    r = client.get("/api/v1/analyze/99999", headers=hdrs)
    ok = r.status_code == 404
    record("Analysis GET 99999", "404", f"{r.status_code}", ok)


# ── 4. JD Match Endpoints ───────────────────────────────────────────────────


def test_jd_match_create():
    if RESUME_ID is None:
        record("JD match create", "200 + match_score", "SKIPPED (no resume_id)", False)
        return
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    payload = {
        "jd_text": "We are looking for a Senior Python Developer with 5+ years of experience in FastAPI, SQLAlchemy, and cloud deployment. Must have strong SQL skills.",
        "jd_title": "Senior Python Developer",
        "jd_company": "TechCorp Inc.",
    }
    r = client.post(f"/api/v1/jd-match/{RESUME_ID}", json=payload, headers=hdrs)
    body = r.json()
    ok = r.status_code == 200 and "match_score" in body
    record("JD match create", "200 + match_score", f"{r.status_code} score={body.get('match_score')}", ok)


def test_jd_match_list():
    if RESUME_ID is None:
        record("JD match list", "200", "SKIPPED (no resume_id)", False)
        return
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    r = client.get(f"/api/v1/jd-match/{RESUME_ID}", headers=hdrs)
    ok = r.status_code == 200
    record("JD match list", "200", f"{r.status_code}", ok)


def test_jd_match_detail_404():
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    r = client.get("/api/v1/jd-match/detail/99999", headers=hdrs)
    ok = r.status_code == 404
    record("JD match detail 99999", "404", f"{r.status_code}", ok)


# ── 5. Cover Letter Endpoints ───────────────────────────────────────────────


def test_cover_letter_create():
    if RESUME_ID is None:
        record("Cover letter create", "200 + content", "SKIPPED (no resume_id)", False)
        return
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    payload = {
        "resume_id": RESUME_ID,
        "jd_text": "We are looking for a Python developer with FastAPI experience.",
        "jd_title": "Python Developer",
        "company_name": "TechCorp",
        "tone": "formal",
        "length": "medium",
    }
    r = client.post("/api/v1/cover-letter/", json=payload, headers=hdrs)
    body = r.json()
    ok = r.status_code == 200 and "content" in body
    record("Cover letter create", "200 + content", f"{r.status_code} id={body.get('id')}", ok)


def test_cover_letter_get_404():
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    r = client.get("/api/v1/cover-letter/99999", headers=hdrs)
    ok = r.status_code == 404
    record("Cover letter GET 99999", "404", f"{r.status_code}", ok)


def test_cover_letter_by_resume():
    if RESUME_ID is None:
        record("Cover letter by-resume", "200", "SKIPPED (no resume_id)", False)
        return
    hdrs = {}
    if SESSION_TOKEN:
        hdrs["X-Session-Token"] = SESSION_TOKEN
    r = client.get(f"/api/v1/cover-letter/by-resume/{RESUME_ID}", headers=hdrs)
    ok = r.status_code == 200
    record("Cover letter by-resume", "200", f"{r.status_code}", ok)


# ── 6. Interview Endpoints ──────────────────────────────────────────────────

def test_interview_from_text():
    payload = {
        "resume_text": "John Doe, Python Developer, 5 years experience, skills: Python, FastAPI, SQL, Docker",
        "jd_text": "Looking for a senior Python developer",
    }
    r = client.post("/api/v1/interview/questions", json=payload)
    body = r.json()
    ok = r.status_code == 200 and "questions" in body
    record("Interview questions (text)", "200 + questions", f"{r.status_code} count={body.get('total')}", ok)


def test_interview_missing_resume():
    r = client.post("/api/v1/interview/questions/99999", json={})
    ok = r.status_code in (401, 403, 404)
    record("Interview questions (missing resume)", "401/403/404", f"{r.status_code}", ok)


# ── 7. Admin Endpoints ──────────────────────────────────────────────────────

ADMIN_TOKEN = None


def test_admin_login_valid():
    global ADMIN_TOKEN
    r = client.post("/api/v1/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    body = r.json()
    ok = r.status_code == 200 and "token" in body
    if ok:
        ADMIN_TOKEN = body["token"]
    record("Admin login (valid)", "200 + token", f"{r.status_code}", ok)


def test_admin_login_wrong():
    r = client.post("/api/v1/admin/login", json={"username": ADMIN_USER, "password": "wrongpassword"})
    ok = r.status_code == 401
    record("Admin login (wrong password)", "401", f"{r.status_code}", ok)


def test_admin_stats_no_token():
    r = client.get("/api/v1/admin/stats")
    ok = r.status_code in (401, 403)
    record("Admin stats (no token)", "401/403", f"{r.status_code}", ok)


def test_admin_stats_with_token():
    if not ADMIN_TOKEN:
        record("Admin stats (with token)", "200", "SKIPPED (no token)", False)
        return
    r = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
    ok = r.status_code == 200
    record("Admin stats (with token)", "200", f"{r.status_code}", ok)


# ── 8. Payment Endpoints ────────────────────────────────────────────────────

def test_payment_config():
    r = client.get("/api/v1/payment/config")
    body = r.json()
    ok = r.status_code == 200 and "plans" in body
    record("Payment config", "200 + plans", f"{r.status_code}", ok)


def test_payment_create_invalid_plan():
    r = client.post("/api/v1/payment/create-checkout", json={"plan": "nonexistent", "email": "test@test.com"})
    ok = r.status_code == 400
    record("Payment checkout (invalid plan)", "400", f"{r.status_code}", ok)


# ── 9. Contact Endpoints ────────────────────────────────────────────────────

def test_contact_valid():
    payload = {
        "name": "Test User",
        "email": "test@example.com",
        "subject": "API Test",
        "message": "This is a test message from the automated API test suite.",
    }
    r = client.post("/api/v1/contact", json=payload)
    ok = r.status_code == 200
    record("Contact (valid)", "200", f"{r.status_code}", ok)


def test_contact_empty_message():
    payload = {
        "name": "Test User",
        "email": "test@example.com",
        "message": "short",
    }
    r = client.post("/api/v1/contact", json=payload)
    ok = r.status_code in (400, 422)
    record("Contact (short message)", "400/422", f"{r.status_code}", ok)


# ── 10. HR Shortlist Endpoints ──────────────────────────────────────────────
# NOTE: These endpoints do NOT exist in the codebase. Verifying they return
# appropriate 404/405 responses.

def test_hr_shortlist_analyze():
    r = client.post("/api/v1/hr-shortlist/analyze", json={"jd_text": "test", "resumes": []})
    # Should be 404 (not found) — any non-500 is acceptable
    ok = r.status_code != 500
    record("HR shortlist analyze (not implemented)", "404/405/422", f"{r.status_code}", ok,
           "Endpoint does not exist in codebase")


def test_hr_shortlist_batch():
    r = client.post("/api/v1/hr-shortlist/batch", json={"resumes": []})
    ok = r.status_code != 500
    record("HR shortlist batch (not implemented)", "404/405/422", f"{r.status_code}", ok,
           "Endpoint does not exist in codebase")


def test_hr_shortlist_get_404():
    r = client.get("/api/v1/hr-shortlist/99999")
    ok = r.status_code in (404, 405)
    record("HR shortlist GET 99999", "404/405", f"{r.status_code}", ok, "Endpoint does not exist")


def test_hr_shortlist_list():
    r = client.get("/api/v1/hr-shortlist")
    ok = r.status_code != 500
    record("HR shortlist list (not implemented)", "404/405", f"{r.status_code}", ok,
           "Endpoint does not exist in codebase")


# ── 11. SQL Injection ───────────────────────────────────────────────────────

def test_sqli_resume_paste():
    payload = "' OR 1=1 --"
    r = client.post("/api/v1/resume/paste", data={"text": payload})
    ok = r.status_code in (200, 400, 422) and r.status_code != 500
    record("SQLi in resume paste", "200/400/422 (no 500)", f"{r.status_code}", ok)


def test_sqli_admin_login():
    r = client.post("/api/v1/admin/login", json={"username": "' OR '1'='1", "password": "anything"})
    ok = r.status_code in (401, 429) and r.status_code != 500
    record("SQLi in admin login", "401/429 (no 500)", f"{r.status_code}", ok)


# ── 12. XSS ─────────────────────────────────────────────────────────────────

def test_xss_resume_paste():
    xss_payload = "<script>alert('xss')</script>"
    r = client.post("/api/v1/resume/paste", data={"text": xss_payload})
    body = r.json()
    if r.status_code == 200:
        raw = body.get("raw_text", "")
        ok = True
        note = f"Stored OK. raw_text contains <script>: {'<script>' in raw}"
    else:
        ok = r.status_code in (400, 422)
        note = f"Rejected with {r.status_code}"
    record("XSS in resume paste", "200 or 400/422 (no crash)", f"{r.status_code}", ok, note)


# ── 13. File Upload Security ────────────────────────────────────────────────

def test_upload_exe_disguised_as_pdf():
    exe_bytes = b"MZ\x90\x00" + b"\x00" * 100
    files = {"file": ("malware.pdf", io.BytesIO(exe_bytes), "application/pdf")}
    r = client.post("/api/v1/resume/upload", files=files)
    ok = r.status_code in (200, 400, 422) and r.status_code != 500
    record("Upload EXE disguised as PDF", "200/400/422 (no crash)", f"{r.status_code}", ok)


def test_upload_oversized_simulation():
    big = b"\x00" * (1024 * 1024)
    files = {"file": ("big.txt", io.BytesIO(big), "text/plain")}
    r = client.post("/api/v1/resume/upload", files=files)
    ok = r.status_code in (200, 400, 413, 422) and r.status_code != 500
    record("Upload large file (1MB)", "200/400/413/422 (no crash)", f"{r.status_code}", ok)


def test_upload_malicious_filename():
    content = b"John Doe\nSoftware Engineer\nPython"
    files = {"file": ("../../../etc/passwd.pdf", io.BytesIO(content), "text/plain")}
    r = client.post("/api/v1/resume/upload", files=files)
    body = r.json()
    if r.status_code == 200:
        fn = body.get("filename", "")
        ok = "../" not in fn and "etc" not in fn
        note = f"Sanitized filename: {fn}"
    else:
        ok = r.status_code in (400, 422) and r.status_code != 500
        note = f"Rejected with {r.status_code}"
    record("Upload malicious filename (traversal)", "200 (sanitized) or 400/422", f"{r.status_code}", ok, note)


# ── 14. Authentication Bypass ───────────────────────────────────────────────

def test_admin_bypass_no_token():
    r = client.get("/api/v1/admin/stats")
    ok = r.status_code in (401, 403)
    record("Auth bypass: stats (no token)", "401/403", f"{r.status_code}", ok)


def test_admin_bypass_expired_token():
    secret = "dpiic-secret-key-change-in-production-2026"
    expired_ts = int(time.time()) - 3600
    payload_str = f"admin:{expired_ts}"
    sig = hmac.new(secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
    token = base64.urlsafe_b64encode(f"{payload_str}:{sig}".encode()).decode()
    r = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"})
    ok = r.status_code == 401
    record("Auth bypass: expired token", "401", f"{r.status_code}", ok)


def test_admin_bypass_forged_token():
    secret = "dpiic-secret-key-change-in-production-2026"
    future_ts = int(time.time()) + 3600
    payload_str = f"admin:{future_ts}"
    fake_sig = "a" * 64
    token = base64.urlsafe_b64encode(f"{payload_str}:{fake_sig}".encode()).decode()
    r = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"})
    ok = r.status_code == 401
    record("Auth bypass: forged token", "401", f"{r.status_code}", ok)


def test_admin_bypass_malformed_token():
    r = client.get("/api/v1/admin/stats", headers={"Authorization": "Bearer notarealtoken"})
    ok = r.status_code == 401
    record("Auth bypass: malformed token", "401", f"{r.status_code}", ok)


# ── 15. Rate Limiting ───────────────────────────────────────────────────────

def test_rate_limit_login():
    """Send multiple failed logins; verify 429 appears (max 5 attempts per 15 min)."""
    got_429 = False
    last_status = None
    for i in range(7):
        r = client.post("/api/v1/admin/login", json={"username": ADMIN_USER, "password": f"wrong{i}"})
        last_status = r.status_code
        if r.status_code == 429:
            got_429 = True
            break
    record(
        "Rate limiting (7 failed logins)",
        "429 within 6 attempts",
        f"last_status={last_status}, got_429={got_429}",
        got_429,
    )


# ── 16. CORS ────────────────────────────────────────────────────────────────

def test_cors_evil_origin():
    r = client.options(
        "/api/v1/resume/paste",
        headers={
            "Origin": "http://evil.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    acao = r.headers.get("access-control-allow-origin", "")
    # Wildcard CORS = "*" means evil.com is implicitly allowed (security concern)
    # No header at all = not matched
    if acao == "*":
        ok = False
        note = "SECURITY: ACAO='*' wildcard allows ALL origins including evil.com"
    elif acao == "http://evil.com":
        ok = False
        note = f"SECURITY: evil.com explicitly allowed"
    elif acao == "":
        ok = True
        note = "No ACAO header set — origin not reflected"
    else:
        ok = acao != "http://evil.com"
        note = f"ACAO='{acao}'"
    record("CORS: evil.com origin", "Not allowed", f"ACAO='{acao or 'none'}'", ok, note)


def test_cors_localhost():
    r = client.options(
        "/api/v1/resume/paste",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    acao = r.headers.get("access-control-allow-origin", "")
    ok = acao in ("*", "http://localhost:3000", "")
    record("CORS: localhost:3000", "Allowed", f"ACAO='{acao or 'none'}'", ok)


# ── 17. Error Handling ──────────────────────────────────────────────────────

def test_malformed_json():
    r = client.post(
        "/api/v1/admin/login",
        content="this is not json {{{",
        headers={"Content-Type": "application/json"},
    )
    ok = r.status_code in (400, 422) and r.status_code != 500
    record("Malformed JSON body", "400/422 (no 500)", f"{r.status_code}", ok)


def test_missing_fields():
    r = client.post("/api/v1/contact", json={})
    ok = r.status_code in (400, 422) and r.status_code != 500
    record("Missing required fields", "400/422 (no 500)", f"{r.status_code}", ok)


def test_large_payload():
    huge = {"text": "A" * 1_000_000}
    r = client.post("/api/v1/resume/paste", data=huge, timeout=60)
    ok = r.status_code in (400, 413, 422) and r.status_code != 500
    record("Extremely large payload (1M chars)", "400/413/422 (no 500)", f"{r.status_code}", ok)


# ── 18. Secrets Exposure ────────────────────────────────────────────────────

def test_secrets_in_health():
    r = client.get("/api/v1/health")
    body = r.json()
    sensitive_keys = {"secret_key", "api_key", "password", "stripe_secret_key", "anthropic_api_key", "secret"}
    leaked = [k for k in body.keys() if k.lower() in sensitive_keys]
    ok = len(leaked) == 0
    record("Secrets in /health", "None exposed", f"Keys: {list(body.keys())}", ok)


def test_secrets_in_docs():
    r = client.get("/docs")
    text = r.text.lower()
    checks = ["dpiic-secret-key", "admin123", "stripe_secret_key", "anthropic_api_key", "secret_key"]
    leaked = [c for c in checks if c in text]
    ok = len(leaked) == 0
    record("Secrets in /docs (HTML)", "None exposed", f"Leaked: {leaked or 'none'}", ok)


def test_openapi_schema_secrets():
    r = client.get("/openapi.json")
    schema_str = json.dumps(r.json()).lower()
    checks = ["dpiic-secret-key", "admin123", "stripe_secret", "anthropic_api_key", "secret_key-change"]
    leaked = [c for c in checks if c.lower() in schema_str]
    ok = len(leaked) == 0
    record("Secrets in OpenAPI schema", "None exposed", f"Leaked: {leaked or 'none'}", ok)


# ── Runner ──────────────────────────────────────────────────────────────────

ALL_TESTS = [
    test_health,
    test_resume_paste_valid,
    test_resume_paste_empty,
    test_resume_list,
    test_resume_get_404,
    test_resume_delete_404,
    test_analyze_create,
    test_analyze_get,
    test_analyze_get_404,
    test_jd_match_create,
    test_jd_match_list,
    test_jd_match_detail_404,
    test_cover_letter_create,
    test_cover_letter_get_404,
    test_cover_letter_by_resume,
    test_interview_from_text,
    test_interview_missing_resume,
    test_admin_login_valid,
    test_admin_login_wrong,
    test_admin_stats_no_token,
    test_admin_stats_with_token,
    test_payment_config,
    test_payment_create_invalid_plan,
    test_contact_valid,
    test_contact_empty_message,
    test_hr_shortlist_analyze,
    test_hr_shortlist_batch,
    test_hr_shortlist_get_404,
    test_hr_shortlist_list,
    test_sqli_resume_paste,
    test_sqli_admin_login,
    test_xss_resume_paste,
    test_upload_exe_disguised_as_pdf,
    test_upload_oversized_simulation,
    test_upload_malicious_filename,
    test_admin_bypass_no_token,
    test_admin_bypass_expired_token,
    test_admin_bypass_forged_token,
    test_admin_bypass_malformed_token,
    test_rate_limit_login,
    test_cors_evil_origin,
    test_cors_localhost,
    test_malformed_json,
    test_missing_fields,
    test_large_payload,
    test_secrets_in_health,
    test_secrets_in_docs,
    test_openapi_schema_secrets,
]


def main():
    print("=" * 120)
    print("ResumeIQ Backend API - Comprehensive QA & Security Test Suite")
    print("=" * 120)
    print()

    for fn in ALL_TESTS:
        try:
            fn()
        except Exception as e:
            record(fn.__name__.replace("test_", ""), "N/A", f"EXCEPTION", False, str(e)[:80])

    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    total = len(results)

    print(f"{'#':<4} {'Test Name':<45} {'Expected':<32} {'Actual':<25} {'Status':<6} Notes")
    print("-" * 160)
    for i, r in enumerate(results, 1):
        print(f"{i:<4} {r['test']:<45} {r['expected']:<32} {r['actual']:<25} {r['status']:<6} {r['note']}")
    print("-" * 160)
    print(f"\nTOTAL: {total}  |  PASSED: {passed}  |  FAILED: {failed}  |  PASS RATE: {passed/total*100:.1f}%")
    print()

    # Summary by category
    categories = {
        "Health":        results[0:1],
        "Resume":        results[1:5],
        "Analysis":      results[5:8],
        "JD Match":      results[8:11],
        "Cover Letter":  results[11:14],
        "Interview":     results[14:16],
        "Admin":         results[16:20],
        "Payment":       results[20:22],
        "Contact":       results[22:24],
        "HR Shortlist":  results[24:28],
        "SQL Injection": results[28:30],
        "XSS":           results[30:31],
        "File Upload":   results[31:34],
        "Auth Bypass":   results[34:38],
        "Rate Limiting": results[38:39],
        "CORS":          results[39:41],
        "Error Handling":results[41:44],
        "Secrets":       results[44:47],
    }
    print("BY CATEGORY:")
    print(f"  {'Category':<20} {'Pass':<6} {'Fail':<6} {'Total':<6}")
    print("  " + "-" * 40)
    for cat, cat_results in categories.items():
        cat_pass = sum(1 for r in cat_results if r["status"] == "PASS")
        cat_fail = sum(1 for r in cat_results if r["status"] == "FAIL")
        print(f"  {cat:<20} {cat_pass:<6} {cat_fail:<6} {len(cat_results):<6}")

    client.close()


if __name__ == "__main__":
    main()
