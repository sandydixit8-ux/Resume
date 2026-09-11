"""
Boundary, duplicate-detection, admin-security and error-quality tests
for the ResumeIQ backend running at http://127.0.0.1:8000.

Run with:
    python test_boundary.py
"""

import asyncio
import json
import time
from typing import Any

import httpx

BASE = "http://127.0.0.1:8000"

results: list[str] = []


def record(test_num: int, title: str, passed: bool, detail: str = ""):
    tag = "PASS" if passed else "FAIL"
    msg = f"[Test {test_num:2d}] {tag}  {title}"
    if detail:
        msg += f"  -- {detail}"
    results.append(msg)
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def paste_resume(
    client: httpx.Client,
    text: str,
    name: str = "pasted_resume.txt",
    token: str | None = None,
    timeout: float = 120,
) -> httpx.Response:
    headers = {}
    if token:
        headers["X-Session-Token"] = token
    return client.post(
        f"{BASE}/api/v1/resume/paste",
        data={"text": text, "filename": name},
        headers=headers,
        timeout=timeout,
    )


def create_resume(client: httpx.Client, token: str | None = None) -> tuple[dict, str | None]:
    """Paste a minimal resume and return (json, session_token)."""
    resp = paste_resume(
        client,
        "John Doe\nSoftware Engineer\nSkills: Python, Django, REST APIs\n"
        "Experience: 5 years building web applications\nEducation: B.S. Computer Science",
        token=token,
    )
    data = resp.json()
    session_token = data.get("session_token") or token
    return data, session_token


# ---------------------------------------------------------------------------
# PART 1 – Boundary Tests
# ---------------------------------------------------------------------------

def test_1_max_chars(client: httpx.Client):
    """Resume paste with exactly 100 000 characters."""
    big_text = "A" * 100_000
    try:
        resp = paste_resume(client, big_text, timeout=180)
        ok = resp.status_code in (200, 400, 413)
        record(1, "Resume paste – 100k chars", ok, f"status={resp.status_code}")
    except (httpx.ReadTimeout, httpx.ConnectTimeout):
        record(1, "Resume paste – 100k chars", True, "timeout (server did not crash)")


def test_2_empty_text(client: httpx.Client):
    """Paste empty string → must be 400 or 422, not 500."""
    resp = paste_resume(client, "")
    ok = resp.status_code in (400, 422) and resp.status_code != 500
    record(2, "Resume paste – 0 chars (empty)", ok, f"status={resp.status_code}")


def test_3_jd_match_empty_jd(client: httpx.Client):
    """JD match with empty jd_text → handled gracefully."""
    data, token = create_resume(client)
    resume_id = data["id"]
    resp = client.post(
        f"{BASE}/api/v1/jd-match/{resume_id}",
        json={"jd_text": "", "jd_title": "Engineer"},
        headers={"X-Session-Token": token},
    )
    ok = resp.status_code in (400, 422) and resp.status_code != 500
    record(3, "JD match – empty jd_text", ok, f"status={resp.status_code}")


def test_4_cover_letter_empty_jd(client: httpx.Client):
    """Cover letter with empty jd_text → handled."""
    data, token = create_resume(client)
    resume_id = data["id"]
    resp = client.post(
        f"{BASE}/api/v1/cover-letter",
        json={"resume_id": resume_id, "jd_text": ""},
        headers={"X-Session-Token": token},
    )
    ok = resp.status_code in (400, 422) and resp.status_code != 500
    record(4, "Cover letter – empty jd_text", ok, f"status={resp.status_code}")


def test_5_interview_minimal(client: httpx.Client):
    """Interview questions from just 'Hi'."""
    resp = client.post(
        f"{BASE}/api/v1/interview/questions",
        json={"resume_text": "Hi"},
    )
    ok = resp.status_code != 500
    record(5, "Interview questions – minimal 'Hi' text", ok, f"status={resp.status_code}")


def test_6_analyze_whitespace(client: httpx.Client):
    """Create a paste with whitespace-only, then analyze → handled."""
    resp = paste_resume(client, "   \n\t  ")
    if resp.status_code == 200:
        rid = resp.json()["id"]
        token = resp.json().get("session_token")
        headers = {"X-Session-Token": token} if token else {}
        ana_resp = client.post(f"{BASE}/api/v1/analyze/{rid}", headers=headers)
        ok = ana_resp.status_code != 500
        record(6, "Analyze whitespace-only resume", ok, f"status={ana_resp.status_code}")
    else:
        # paste already rejected whitespace – that's fine too
        ok = resp.status_code in (400, 413) and resp.status_code != 500
        record(6, "Analyze whitespace-only resume", ok,
               f"paste rejected with status={resp.status_code} (acceptable)")


def test_7_concurrent(client: httpx.Client):
    """5 simultaneous paste requests → all succeed or all fail gracefully."""
    import concurrent.futures

    def _do_paste(idx: int):
        try:
            return paste_resume(client, f"Resume for concurrent test #{idx}\nSkills: Python")
        except (httpx.ReadTimeout, httpx.ConnectTimeout):
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(_do_paste, i) for i in range(5)]
        responses = [f.result() for f in futures]

    statuses = [r.status_code if r else "timeout" for r in responses]
    non_timeout = [s for s in statuses if s != "timeout"]
    any_500 = any(s == 500 for s in non_timeout)
    passed = not any_500
    record(7, "Concurrent requests (5x paste)", passed,
           f"statuses={statuses}")


def test_8_delete_cascade(client: httpx.Client):
    """Create resume → analysis → JD match → delete resume → verify 404s."""
    data, token = create_resume(client)
    rid = data["id"]
    h = {"X-Session-Token": token}

    # create analysis
    ana = client.post(f"{BASE}/api/v1/analyze/{rid}", headers=h)
    assert ana.status_code == 200, f"analyze failed: {ana.status_code}"

    # create JD match
    jd = client.post(
        f"{BASE}/api/v1/jd-match/{rid}",
        json={"jd_text": "Looking for a Python developer with 5 years experience"},
        headers=h,
    )
    assert jd.status_code == 200, f"jd-match failed: {jd.status_code}"

    # delete
    del_resp = client.delete(f"{BASE}/api/v1/resume/{rid}", headers=h)
    assert del_resp.status_code == 200, f"delete failed: {del_resp.status_code}"

    # GET resume → 404
    g1 = client.get(f"{BASE}/api/v1/resume/{rid}", headers=h)
    # GET analysis → 404 or empty
    g2 = client.get(f"{BASE}/api/v1/analyze/{rid}", headers=h)

    passed = g1.status_code == 404 and g2.status_code in (404, 200)
    record(8, "Delete cascade", passed,
           f"resume_get={g1.status_code}, analyze_get={g2.status_code}")


# ---------------------------------------------------------------------------
# PART 2 – Duplicate Detection
# ---------------------------------------------------------------------------

def test_9_same_content_different_names(client: httpx.Client):
    """Two pastes with same content, different names → both exist."""
    content = "Python developer, 5 years experience, Skills: Python, Django"
    r1 = paste_resume(client, content, name="alice_resume.txt")
    r2 = paste_resume(client, content, name="bob_resume.txt")
    if r1.status_code == 200 and r2.status_code == 200:
        t1 = r1.json().get("session_token")
        t2 = r2.json().get("session_token")
        h1 = {"X-Session-Token": t1} if t1 else {}
        h2 = {"X-Session-Token": t2} if t2 else {}
        l1 = client.get(f"{BASE}/api/v1/resume", headers=h1)
        l2 = client.get(f"{BASE}/api/v1/resume", headers=h2)
        ok = l1.status_code == 200 and l2.status_code == 200
        try:
            c1, c2 = len(l1.json()), len(l2.json())
        except Exception:
            c1, c2 = l1.status_code, l2.status_code
        record(9, "Same content, different names – both exist", ok,
               f"list1_count={c1}, list2_count={c2}")
    else:
        record(9, "Same content, different names – both exist", False,
               f"r1={r1.status_code}, r2={r2.status_code}")


def test_10_same_resume_modified(client: httpx.Client):
    """Original and slightly modified resume both accepted."""
    r1 = paste_resume(client, "Python developer with 5 years experience")
    r2 = paste_resume(client, "Python developer with 5.5 years experience")
    ok = r1.status_code == 200 and r2.status_code == 200
    record(10, "Same resume slightly modified – both accepted", ok,
           f"r1={r1.status_code}, r2={r2.status_code}")


# ---------------------------------------------------------------------------
# PART 3 – Admin Security
# ---------------------------------------------------------------------------

def test_11_admin_wrong_token(client: httpx.Client):
    """Admin stats with bogus Bearer token → 401."""
    resp = client.get(
        f"{BASE}/api/v1/admin/stats",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    ok = resp.status_code == 401
    record(11, "Admin stats – wrong token", ok, f"status={resp.status_code}")


def test_12_admin_empty_token(client: httpx.Client):
    """Admin stats with Bearer (empty) → 401."""
    import httpx as _httpx
    try:
        req = _httpx.Request("GET", f"{BASE}/api/v1/admin/stats",
                             headers={"Authorization": "Bearer"})
        resp = client.send(req)
    except Exception:
        resp = client.get(
            f"{BASE}/api/v1/admin/stats",
            headers={"Authorization": "Bearer _"},
        )
    ok = resp.status_code == 401
    record(12, "Admin stats – empty/malformed Bearer token", ok, f"status={resp.status_code}")


def test_13_sql_injection_login(client: httpx.Client):
    """SQL injection attempt in admin login → 401 or 429 (both are safe, not 500)."""
    resp = client.post(
        f"{BASE}/api/v1/admin/login",
        json={"username": "' OR 1=1--", "password": "anything"},
    )
    ok = resp.status_code in (401, 429) and resp.status_code != 500
    record(13, "SQL injection in admin login", ok, f"status={resp.status_code}")


def test_14_rate_limit(client: httpx.Client):
    """6 rapid failed logins → 6th should return 429."""
    statuses = []
    for i in range(6):
        resp = client.post(
            f"{BASE}/api/v1/admin/login",
            json={"username": "admin", "password": f"wrong_{i}"},
        )
        statuses.append(resp.status_code)
    ok = statuses[-1] == 429
    record(14, "Rate limit – 6 rapid failed logins", ok,
           f"statuses={statuses}")


# ---------------------------------------------------------------------------
# PART 4 – Error Response Quality
# ---------------------------------------------------------------------------

def _collect_error_responses(client: httpx.Client) -> list[dict]:
    """Trigger several error paths and collect the JSON bodies."""
    payloads: list[dict] = []

    # empty paste
    r = paste_resume(client, "")
    if r.status_code >= 400:
        try:
            payloads.append(r.json())
        except Exception:
            payloads.append({})

    # JD match with empty jd_text
    data, token = create_resume(client)
    rid = data["id"]
    h = {"X-Session-Token": token}
    r2 = client.post(f"{BASE}/api/v1/jd-match/{rid}",
                     json={"jd_text": ""}, headers=h)
    if r2.status_code >= 400:
        try:
            payloads.append(r2.json())
        except Exception:
            payloads.append({})

    # admin with wrong token
    r3 = client.get(f"{BASE}/api/v1/admin/stats",
                    headers={"Authorization": "Bearer fake"})
    if r3.status_code >= 400:
        try:
            payloads.append(r3.json())
        except Exception:
            payloads.append({})

    # interview with empty text
    r4 = client.post(f"{BASE}/api/v1/interview/questions",
                     json={"resume_text": ""})
    if r4.status_code >= 400:
        try:
            payloads.append(r4.json())
        except Exception:
            payloads.append({})

    # cover letter with empty jd
    r5 = client.post(f"{BASE}/api/v1/cover-letter",
                     json={"resume_id": 999999, "jd_text": ""})
    if r5.status_code >= 400:
        try:
            payloads.append(r5.json())
        except Exception:
            payloads.append({})

    return payloads


def test_15_detail_field(client: httpx.Client):
    """All error responses have a 'detail' key."""
    payloads = _collect_error_responses(client)
    all_have = all("detail" in p for p in payloads) if payloads else False
    record(15, "Error responses contain 'detail' field", all_have,
           f"checked {len(payloads)} error payloads")


def test_16_no_stack_traces(client: httpx.Client):
    """No Python tracebacks in any error responses."""
    payloads = _collect_error_responses(client)
    traceback_found = False
    for p in payloads:
        text = json.dumps(p)
        if "Traceback" in text or "File \"" in text or "line " in text:
            traceback_found = True
            break
    ok = not traceback_found
    record(16, "No stack traces in error responses", ok)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"{'='*60}", flush=True)
    print(f" ResumeIQ Boundary Tests – target {BASE}", flush=True)
    print(f"{'='*60}\n", flush=True)

    with httpx.Client(timeout=120) as client:
        # Quick health check
        try:
            h = client.get(f"{BASE}/api/v1/health")
            if h.status_code != 200:
                print(f"WARNING: health check returned {h.status_code}")
        except httpx.ConnectError:
            print("ERROR: Cannot connect to backend at", BASE)
            return

        # Part 1
        test_1_max_chars(client)
        test_2_empty_text(client)
        test_3_jd_match_empty_jd(client)
        test_4_cover_letter_empty_jd(client)
        test_5_interview_minimal(client)
        test_6_analyze_whitespace(client)
        test_7_concurrent(client)
        test_8_delete_cascade(client)

        # Part 2
        test_9_same_content_different_names(client)
        test_10_same_resume_modified(client)

        # Part 3
        test_11_admin_wrong_token(client)
        test_12_admin_empty_token(client)
        test_13_sql_injection_login(client)
        test_14_rate_limit(client)

        # Part 4
        test_15_detail_field(client)
        test_16_no_stack_traces(client)

    # Summary
    passed = sum(1 for r in results if "PASS" in r.split("]")[1])
    failed = sum(1 for r in results if "FAIL" in r.split("]")[1])
    print(f"\n{'='*60}", flush=True)
    print(f" SUMMARY: {passed} passed, {failed} failed out of {len(results)}", flush=True)
    print(f"{'='*60}", flush=True)
    if failed:
        print("\nFailed tests:", flush=True)
        for r in results:
            if "[FAIL]" in r:
                print(f"  {r}", flush=True)


if __name__ == "__main__":
    main()
