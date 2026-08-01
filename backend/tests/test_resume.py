"""Resume upload / paste / retrieve / delete (incl. cascade) tests."""


def _make_minimal_pdf(text="Sandeep Dixit Software Engineer") -> bytes:
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    ]
    stream = ("BT /F1 14 Tf 72 720 Td (%s) Tj ET" % text).encode("latin-1")
    objs.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    body = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, o in enumerate(objs, 1):
        offsets.append(len(body))
        body += b"%d 0 obj " % i + o + b" endobj\n"
    xref = len(body)
    body += b"xref\n0 %d\n" % (len(objs) + 1)
    body += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        body += b"%010d 00000 n \n" % off
    body += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%EOF\n" % (len(objs) + 1, xref)
    return bytes(body)


def test_upload_txt_ok(client):
    r = client.post(
        "/api/v1/resume/upload",
        files={"file": ("resume.txt", b"Software Engineer, Python, React", "text/plain")},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["id"] > 0
    assert data["file_type"] == ".txt"
    client.delete(f"/api/v1/resume/{data['id']}")


def test_upload_pdf_ok(client):
    r = client.post(
        "/api/v1/resume/upload",
        files={"file": ("resume.pdf", _make_minimal_pdf(), "application/pdf")},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["file_type"] == ".pdf"
    assert "Sandeep Dixit" in data["raw_text"]
    client.delete(f"/api/v1/resume/{data['id']}")


def test_upload_doc_rejected(client):
    r = client.post(
        "/api/v1/resume/upload",
        files={"file": ("resume.doc", b"fake doc", "application/msword")},
    )
    assert r.status_code == 400


def test_upload_exe_rejected(client):
    r = client.post(
        "/api/v1/resume/upload",
        files={"file": ("evil.exe", b"MZ", "application/octet-stream")},
    )
    assert r.status_code == 400


def test_upload_oversized_rejected(client):
    big = b"x" * (11 * 1024 * 1024)
    r = client.post(
        "/api/v1/resume/upload",
        files={"file": ("big.txt", big, "text/plain")},
    )
    assert r.status_code == 413


def test_paste_empty_rejected(client):
    r = client.post("/api/v1/resume/paste", data={"text": "   ", "filename": "x.txt"})
    assert r.status_code == 400


def test_paste_ok_and_fetch(client):
    r = client.post(
        "/api/v1/resume/paste",
        data={"text": "Sandeep Dixit - Software Engineer with Python, React", "filename": "test.txt"},
    )
    assert r.status_code == 200
    rid = r.json()["id"]
    g = client.get(f"/api/v1/resume/{rid}")
    assert g.status_code == 200
    assert "Sandeep" in g.json()["raw_text"]
    client.delete(f"/api/v1/resume/{rid}")


def test_get_resume_not_found(client):
    assert client.get("/api/v1/resume/999999").status_code == 404


def test_get_resume_bad_id(client):
    assert client.get("/api/v1/resume/abc").status_code == 422


def test_garbage_pdf_returns_422_parse_failure(client):
    r = client.post(
        "/api/v1/resume/upload",
        files={"file": ("resume.pdf", b"%PDF-1.4 this is not a real pdf", "application/pdf")},
    )
    assert r.status_code == 422


def test_list_resumes(client):
    r = client.get("/api/v1/resume/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_delete_cascade_analysis_jd_cover(client):
    r = client.post(
        "/api/v1/resume/paste",
        data={"text": "Software Engineer 5 years Python backend, React frontend", "filename": "cascade.txt"},
    )
    assert r.status_code == 200
    rid = r.json()["id"]

    a = client.post(f"/api/v1/analyze/{rid}")
    assert a.status_code == 200

    jd = client.post(
        f"/api/v1/jd-match/{rid}",
        json={"jd_text": "Senior Python Engineer with backend experience", "jd_title": "Senior Engineer", "jd_company": "Acme"},
    )
    assert jd.status_code == 200

    cl = client.post(
        "/api/v1/cover-letter",
        json={"resume_id": rid, "jd_text": "Senior Python Engineer", "jd_title": "Senior Engineer", "company_name": "Acme"},
    )
    assert cl.status_code == 200

    d = client.delete(f"/api/v1/resume/{rid}")
    assert d.status_code == 200
    assert client.get(f"/api/v1/resume/{rid}").status_code == 404
