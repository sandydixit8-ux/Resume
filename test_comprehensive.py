import httpx
import tempfile
import os
import json
import time
import struct
import sys
import io

BASE = "http://127.0.0.1:8000"
PYTHON = r"C:\Users\Ats\AppData\Local\Python\bin\python.exe"

results: list[dict] = []


def record(test_num: int, name: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    results.append({"test": test_num, "name": name, "status": status, "detail": detail})
    print(f"  Test {test_num}: {name} -> {status} {('- ' + detail) if detail else ''}")


def make_session_token():
    import secrets
    return secrets.token_urlsafe(32)


# ────────────────────────────────────────────────────────────────
# Part 1: Resume Upload Edge Cases
# ────────────────────────────────────────────────────────────────

def test_1():
    """Upload valid TXT file"""
    content = b"JOHN DOE\nSenior Software Engineer\nEmail: john@example.com\nSkills: Python, JavaScript"
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
        f.write(content)
        f.flush()
        fname = f.name
    try:
        with open(fname, "rb") as fp:
            r = httpx.post(f"{BASE}/api/v1/resume/upload", files={"file": ("resume.txt", fp, "text/plain")}, timeout=30)
        passed = r.status_code == 200 and "id" in r.json()
        record(1, "Upload valid TXT file", passed, f"status={r.status_code} id={r.json().get('id')}")
        return r.json().get("id") if passed else None
    finally:
        os.unlink(fname)


def test_2():
    """Upload empty file"""
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
        f.write(b"")
        f.flush()
        fname = f.name
    try:
        with open(fname, "rb") as fp:
            r = httpx.post(f"{BASE}/api/v1/resume/upload", files={"file": ("empty.txt", fp, "text/plain")}, timeout=30)
        passed = r.status_code in (400, 422)
        record(2, "Upload empty file", passed, f"status={r.status_code} body={r.text[:200]}")
    finally:
        os.unlink(fname)


def test_3():
    """Upload oversized file (>10MB)"""
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
        f.write(b"X" * (11 * 1024 * 1024))
        f.flush()
        fname = f.name
    try:
        with open(fname, "rb") as fp:
            r = httpx.post(f"{BASE}/api/v1/resume/upload", files={"file": ("big.txt", fp, "text/plain")}, timeout=60)
        passed = r.status_code in (413, 400)
        record(3, "Upload oversized file", passed, f"status={r.status_code}")
    finally:
        os.unlink(fname)


def test_4():
    """Upload unsupported file type (.exe)"""
    content = b"MZ" + b"\x90" * 100
    with tempfile.NamedTemporaryFile(suffix=".exe", delete=False) as f:
        f.write(content)
        f.flush()
        fname = f.name
    try:
        with open(fname, "rb") as fp:
            r = httpx.post(f"{BASE}/api/v1/resume/upload", files={"file": ("malware.exe", fp, "application/octet-stream")}, timeout=30)
        passed = r.status_code == 400
        record(4, "Upload unsupported .exe", passed, f"status={r.status_code} body={r.text[:200]}")
    finally:
        os.unlink(fname)


def test_5():
    """Upload very long resume (50KB+)"""
    sections = []
    for i in range(200):
        sections.append(
            f"Experience {i+1}: Senior Developer at Company{i} (20{10+i%15}-20{15+i%15})\n"
            f"Led a cross-functional team of {10+i} engineers on mission-critical projects. "
            f"Reduced API latency by {20+i}% through systematic optimization of database queries, "
            f"caching layers, and network throughput. Managed ${100+i}K project budget with zero overruns. "
            f"Architected microservices handling {1000+i*100} requests per day with 99.9% uptime SLA. "
            f"Mentored junior developers and conducted 200+ code reviews per quarter.\n"
            f"Technologies: Python, JavaScript, TypeScript, React, Node.js, AWS, Docker, Kubernetes, "
            f"PostgreSQL, MongoDB, Redis, Elasticsearch, Terraform, CI/CD, GraphQL, REST APIs, gRPC.\n\n"
        )
    content = "JOHN DOE\nSenior Software Engineer\nEmail: john@example.com\n" + "\n".join(sections)
    assert len(content.encode("utf-8")) > 50000, f"Content too small: {len(content.encode('utf-8'))}"
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
        f.write(content.encode("utf-8"))
        f.flush()
        fname = f.name
    try:
        with open(fname, "rb") as fp:
            r = httpx.post(f"{BASE}/api/v1/resume/upload", files={"file": ("long_resume.txt", fp, "text/plain")}, timeout=60)
        data = r.json()
        passed = r.status_code == 200 and "id" in data
        record(5, "Upload very long resume (50KB)", passed, f"status={r.status_code} id={data.get('id')}")
        return data.get("id") if passed else None
    finally:
        os.unlink(fname)


def test_6():
    """Upload file with special characters in name"""
    content = b"Jane Doe\nSoftware Engineer\nEmail: jane@example.com"
    filename = "R\u00e9sum\u00e9_Jos\u00e9 (2026).txt"
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
        f.write(content)
        f.flush()
        fname = f.name
    try:
        with open(fname, "rb") as fp:
            r = httpx.post(f"{BASE}/api/v1/resume/upload", files={"file": (filename, fp, "text/plain")}, timeout=30)
        data = r.json()
        passed = r.status_code == 200 and "id" in data
        record(6, "Upload file with special chars in name", passed,
               f"status={r.status_code} orig_filename={data.get('original_filename')}")
        return data.get("id") if passed else None
    finally:
        os.unlink(fname)


def test_7():
    """Upload minimal PDF"""
    # Minimal valid PDF
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Test PDF) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
361
%%EOF"""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_content)
        f.flush()
        fname = f.name
    try:
        with open(fname, "rb") as fp:
            r = httpx.post(f"{BASE}/api/v1/resume/upload", files={"file": ("minimal.pdf", fp, "application/pdf")}, timeout=30)
        passed = r.status_code in (200, 422)
        record(7, "Upload minimal PDF", passed, f"status={r.status_code}")
        return r.json().get("id") if r.status_code == 200 else None
    finally:
        os.unlink(fname)


def test_8():
    """Upload DOCX with real content"""
    try:
        from docx import Document
    except ImportError:
        record(8, "Upload DOCX (python-docx)", False, "python-docx not installed")
        return None
    doc = Document()
    doc.add_heading("Jane Smith", level=1)
    doc.add_paragraph("Senior Software Engineer")
    doc.add_paragraph("Email: jane@example.com | Phone: +1-555-0199")
    doc.add_heading("Experience", level=2)
    doc.add_paragraph("Lead Developer at TechCorp (2019-2024): Python, Django, AWS")
    doc.add_heading("Skills", level=2)
    doc.add_paragraph("Python, Django, AWS, Docker, PostgreSQL")
    doc.add_heading("Education", level=2)
    doc.add_paragraph("BS Computer Science, MIT 2017")
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
        f.write(buf.read())
        f.flush()
        fname = f.name
    try:
        with open(fname, "rb") as fp:
            r = httpx.post(f"{BASE}/api/v1/resume/upload", files={"file": ("jane_smith.docx", fp, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}, timeout=30)
        data = r.json()
        passed = r.status_code == 200 and "id" in data
        record(8, "Upload DOCX with real content", passed, f"status={r.status_code} id={data.get('id')}")
        return data.get("id") if passed else None
    finally:
        os.unlink(fname)


# ────────────────────────────────────────────────────────────────
# Part 2: Resume Parser Quality
# ────────────────────────────────────────────────────────────────

def test_9():
    """Paste well-formatted resume"""
    text = """JOHN DOE
Senior Software Engineer
Email: john@example.com | Phone: +1-555-0123 | Location: San Francisco, CA

PROFESSIONAL SUMMARY
Senior software engineer with 8+ years of experience in full-stack development.

EXPERIENCE
Senior Engineer | Google | 2020-Present
- Led team of 5 engineers
- Reduced API latency by 40%
- Managed $2M project budget

Software Engineer | Meta | 2017-2020
- Built microservices handling 1M requests/day
- Implemented CI/CD pipeline

EDUCATION
BS Computer Science | Stanford University | 2016

SKILLS
Python, JavaScript, React, Node.js, AWS, Docker, Kubernetes, PostgreSQL, MongoDB

CERTIFICATIONS
AWS Solutions Architect - Professional"""

    r = httpx.post(f"{BASE}/api/v1/resume/paste",
                   data={"text": text, "filename": "john_doe_resume.txt"},
                   timeout=30)
    data = r.json()
    if r.status_code == 200:
        parsed = data.get("parsed_json", {})
        checks = {
            "contact_info": bool(parsed.get("contact_info")),
            "skills": len(parsed.get("skills", [])) > 0,
            "experience": len(parsed.get("experience", [])) > 0,
            "education": len(parsed.get("education", [])) > 0,
        }
        all_ok = all(checks.values())
        detail = f"status={r.status_code} sections={checks} id={data.get('id')}"
        record(9, "Paste well-formatted resume", all_ok, detail)
        return data.get("id") if all_ok else None
    else:
        record(9, "Paste well-formatted resume", False, f"status={r.status_code} body={r.text[:200]}")
        return None


def test_10():
    """Paste minimal resume"""
    r = httpx.post(f"{BASE}/api/v1/resume/paste",
                   data={"text": "John Doe - Developer", "filename": "minimal.txt"},
                   timeout=30)
    data = r.json()
    if r.status_code == 200:
        has_issues = data.get("has_parsing_issues", False)
        parsed = data.get("parsed_json", {})
        minimal = (not parsed.get("contact_info") and len(parsed.get("skills", [])) == 0)
        passed = has_issues or minimal
        record(10, "Paste minimal resume", passed,
               f"status={r.status_code} has_issues={has_issues} parsed_keys={list(parsed.keys())}")
        return data.get("id") if passed else None
    else:
        record(10, "Paste minimal resume", False, f"status={r.status_code}")
        return None


# ────────────────────────────────────────────────────────────────
# Part 3: HR Shortlist E2E — SKIPPED (endpoints don't exist)
# ────────────────────────────────────────────────────────────────

def test_11():
    """HR Shortlist single candidate analysis"""
    record(11, "HR Shortlist single candidate", False, "SKIPPED: /api/v1/hr-shortlist/analyze does not exist")


def test_12():
    """HR Shortlist batch analysis"""
    record(12, "HR Shortlist batch analysis", False, "SKIPPED: /api/v1/hr-shortlist/batch does not exist")


def test_13():
    """HR Shortlist list and detail"""
    record(13, "HR Shortlist list and detail", False, "SKIPPED: /api/v1/hr-shortlist does not exist")


# ────────────────────────────────────────────────────────────────
# Part 4: Performance Timing
# ────────────────────────────────────────────────────────────────

def test_14(_resume_id_unused):
    """Measure API response times"""
    timings = {}

    def time_request(label, method, url, **kwargs):
        start = time.perf_counter()
        try:
            r = getattr(httpx, method)(url, timeout=120, follow_redirects=True, **kwargs)
            elapsed = (time.perf_counter() - start) * 1000
            timings[label] = {"ms": round(elapsed, 1), "status": r.status_code}
            return r
        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            timings[label] = {"ms": round(elapsed, 1), "status": f"error: {e}"}
            return None

    time_request("GET /api/v1/health", "get", f"{BASE}/api/v1/health")

    # Create a resume via paste (no session token -> server issues one)
    r = time_request("POST /api/v1/resume/paste (setup)", "post", f"{BASE}/api/v1/resume/paste",
                     data={"text": "JOHN DOE\nSenior Software Engineer\nEmail: john@example.com\nSkills: Python, JavaScript, AWS, Docker, PostgreSQL", "filename": "perf_setup.txt"})
    created_id = None
    token = make_session_token()
    if r and r.status_code == 200:
        created_id = r.json().get("id")
        token = r.json().get("session_token", token)

    headers = {"X-Session-Token": token}

    time_request("GET /api/v1/resume/", "get", f"{BASE}/api/v1/resume/", headers=headers)

    # Small paste (fresh for timing, separate session)
    time_request("POST /api/v1/resume/paste (small)", "post", f"{BASE}/api/v1/resume/paste",
                 data={"text": "Jane Doe\nDeveloper\nPython, JS", "filename": "small.txt"})

    if created_id:
        time_request(f"POST /api/v1/analyze/{created_id}", "post", f"{BASE}/api/v1/analyze/{created_id}", headers=headers)
        time_request(f"POST /api/v1/jd-match/{created_id}", "post", f"{BASE}/api/v1/jd-match/{created_id}",
                     headers=headers, json={"jd_text": "Python Developer required", "jd_title": "Python Dev"})
        time_request("POST /api/v1/cover-letter/", "post", f"{BASE}/api/v1/cover-letter/",
                     headers=headers, json={"resume_id": created_id, "jd_text": "Python Developer role at Google", "jd_title": "Python Developer", "company_name": "Google"})
        time_request("POST /api/v1/interview/questions", "post", f"{BASE}/api/v1/interview/questions",
                     json={"resume_text": "John Doe\nSenior Python Developer\nSkills: Python, Django, AWS", "jd_text": "Python Developer"})

    print("\n  --- Performance Timing Results ---")
    all_ok = True
    for label, info in timings.items():
        ms = info["ms"]
        status = info["status"]
        ok = isinstance(status, int) and status == 200
        if not ok:
            all_ok = False
        print(f"    {label}: {ms}ms (status={status})")
    record(14, "Performance timing", all_ok, f"{len(timings)} endpoints timed")


# ────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────

def main():
    print("=" * 70)
    print("ResumeIQ Backend Comprehensive Test Suite")
    print("=" * 70)

    # Verify server is up
    try:
        r = httpx.get(f"{BASE}/api/v1/health", timeout=5)
        print(f"\n  Server health: {r.json()}")
    except Exception as e:
        print(f"\n  FATAL: Cannot reach server at {BASE}: {e}")
        sys.exit(1)

    print("\n--- Part 1: Resume Upload Edge Cases ---")
    id1 = test_1()
    test_2()
    test_3()
    test_4()
    id5 = test_5()
    id6 = test_6()
    id7 = test_7()
    id8 = test_8()

    print("\n--- Part 2: Resume Parser Quality ---")
    id9 = test_9()
    test_10()

    print("\n--- Part 3: HR Shortlist E2E ---")
    test_11()
    test_12()
    test_13()

    print("\n--- Part 4: Performance Timing ---")
    test_14(id1)

    # Summary
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    skipped = sum(1 for r in results if "SKIPPED" in r.get("detail", ""))

    print("\n" + "=" * 70)
    print(f"SUMMARY: {passed} PASSED / {failed} FAILED / {skipped} SKIPPED out of {len(results)} total")
    print("=" * 70)
    print("\nDetailed results:")
    for r in results:
        marker = "V" if r["status"] == "PASS" else "X"
        detail = f" ({r['detail']})" if r["detail"] else ""
        print(f"  [{marker}] Test {r['test']:>2}: {r['name']}{detail}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
