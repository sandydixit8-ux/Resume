import httpx
from bs4 import BeautifulSoup
from dataclasses import dataclass, field

BASE = "http://localhost:3000"

PAGES = [
    "/",
    "/analyze",
    "/jd-match",
    "/builder",
    "/cover-letter",
    "/interview",
    "/hr-shortlist",
    "/recruiter",
    "/pricing",
    "/contact",
    "/dashboard",
    "/admin/login",
    "/admin/dashboard",
    "/admin/payments",
]


@dataclass
class TestResult:
    page: str
    status: int | None = None
    ok: bool = False
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    info: list[str] = field(default_factory=list)


def fetch(url: str, client: httpx.Client) -> httpx.Response:
    return client.get(url, follow_redirects=True, timeout=15)


def test_page_availability(client: httpx.Client):
    print("=" * 70)
    print("1. PAGE AVAILABILITY (expect HTTP 200)")
    print("=" * 70)
    results: list[TestResult] = []
    for path in PAGES:
        r = TestResult(page=path)
        try:
            resp = fetch(BASE + path, client)
            r.status = resp.status_code
            if resp.status_code == 200:
                r.ok = True
                r.info.append(f"OK ({len(resp.text)} bytes)")
            else:
                r.errors.append(f"Expected 200, got {resp.status_code}")
        except Exception as e:
            r.errors.append(f"Request failed: {e}")
        results.append(r)
        status_str = f"[OK] {r.status}" if r.ok else f"[FAIL] {r.status or 'N/A'}"
        err_str = f" - {r.errors[0]}" if r.errors else ""
        print(f"  {status_str}  {path}{err_str}")
    return results


def test_landing_page(client: httpx.Client):
    print("\n" + "=" * 70)
    print("2. LANDING PAGE (/) DEEP CHECKS")
    print("=" * 70)
    resp = fetch(BASE + "/", client)
    soup = BeautifulSoup(resp.text, "html.parser")
    errors = []
    warnings = []
    info = []

    title = soup.find("title")
    if title and title.string and title.string.strip():
        info.append(f"[OK] Title: \"{title.string.strip()[:80]}\"")
    else:
        errors.append("[FAIL] Missing or empty <title> tag")

    h1 = soup.find("h1")
    if h1:
        info.append(f"[OK] H1 found: \"{h1.get_text(strip=True)[:60]}\"")
    else:
        errors.append("[FAIL] No <h1> tag found")

    nav_links = soup.find_all("a", href=True)
    nav_count = len(nav_links)
    info.append(f"Total <a> tags: {nav_count}")

    broken_hash = [a for a in nav_links if a["href"] == "#"]
    if broken_hash:
        warnings.append(f"[WARN] {len(broken_hash)} empty href=\"#\" links found")
        for a in broken_hash[:5]:
            text = a.get_text(strip=True)[:40] or "(no text)"
            warnings.append(f"    -> {text}")
    else:
        info.append("[OK] No empty href=\"#\" links")

    images = soup.find_all("img")
    broken_images = []
    for img in images:
        src = img.get("src", "")
        if src and not src.startswith(("data:", "http://", "https://", "/_next/")):
            broken_images.append(src)
    if broken_images:
        warnings.append(f"[WARN] {len(broken_images)} potentially broken image refs:")
        for src in broken_images[:5]:
            warnings.append(f"    -> {src}")
    else:
        info.append(f"[OK] No obviously broken image references ({len(images)} images total)")

    for i in info:
        print(f"  {i}")
    for w in warnings:
        print(f"  {w}")
    for e in errors:
        print(f"  {e}")

    return {"errors": errors, "warnings": warnings, "info": info, "soup": soup}


def test_404(client: httpx.Client):
    print("\n" + "=" * 70)
    print("3. 404 PAGE TEST (/nonexistent-page-xyz123)")
    print("=" * 70)
    resp = fetch(BASE + "/nonexistent-page-xyz123", client)
    print(f"  Status: {resp.status_code}")
    if resp.status_code == 404:
        print("  [OK] Correctly returned 404")
    elif resp.status_code == 200:
        soup = BeautifulSoup(resp.text, "html.parser")
        text = soup.get_text().lower()
        if any(w in text for w in ["not found", "404", "does not exist", "page not found"]):
            print("  [OK] Returned 200 but page shows error/404 content")
        else:
            print("  [FAIL] Returned 200 with no apparent error content")
    else:
        print(f"  [FAIL] Unexpected status code: {resp.status_code}")
    return resp.status_code


def test_content_structure(client: httpx.Client):
    print("\n" + "=" * 70)
    print("4. CONTENT STRUCTURE (h1/main per page)")
    print("=" * 70)
    for path in PAGES:
        resp = fetch(BASE + path, client)
        if resp.status_code != 200:
            print(f"  -- {path} (skipped, status {resp.status_code})")
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        h1 = soup.find("h1")
        main = soup.find("main")
        has_h1 = bool(h1)
        has_main = bool(main)
        h1_text = h1.get_text(strip=True)[:50] if h1 else ""
        if has_h1 or has_main:
            parts = []
            if has_h1:
                parts.append(f"h1=\"{h1_text}\"")
            if has_main:
                parts.append("<main> present")
            print(f"  [OK] {path} -- {', '.join(parts)}")
        else:
            print(f"  [FAIL] {path} -- No <h1> or <main> element found")


def test_accessibility(client: httpx.Client):
    print("\n" + "=" * 70)
    print("5. ACCESSIBILITY QUICK WINS")
    print("=" * 70)
    all_imgs_no_alt = []
    all_inputs_no_label = []
    lang_missing = []

    pages_checked = 0
    for path in PAGES:
        resp = fetch(BASE + path, client)
        if resp.status_code != 200:
            continue
        pages_checked += 1
        soup = BeautifulSoup(resp.text, "html.parser")

        html_tag = soup.find("html")
        if html_tag and not html_tag.get("lang"):
            lang_missing.append(path)

        imgs = soup.find_all("img")
        for img in imgs:
            if not img.get("alt"):
                src = img.get("src", "unknown")[:60]
                all_imgs_no_alt.append((path, src))

        inputs = soup.find_all(["input", "textarea", "select"])
        for inp in inputs:
            inp_type = inp.get("type", "text")
            if inp_type in ("hidden", "submit", "button", "checkbox", "radio", "range", "color"):
                continue
            has_label = bool(inp.get("aria-label") or inp.get("aria-labelledby") or inp.get("placeholder"))
            inp_id = inp.get("id")
            if inp_id:
                label = soup.find("label", attrs={"for": inp_id})
                has_label = has_label or bool(label)
            if not has_label:
                name = inp.get("name", inp.get("id", "unknown"))[:40]
                all_inputs_no_label.append((path, name))

    print(f"\n  Pages checked: {pages_checked}")
    print()

    print("  [lang attribute on <html>]")
    if lang_missing:
        print(f"  [FAIL] Missing in {len(lang_missing)} pages: {', '.join(lang_missing)}")
    else:
        print(f"  [OK] All {pages_checked} pages have lang attribute")

    print()
    print(f"  [img alt attributes] — {len(all_imgs_no_alt)} missing:")
    if all_imgs_no_alt:
        for page, src in all_imgs_no_alt[:10]:
            print(f"    -> {page}: <img src=\"{src}\">")
        if len(all_imgs_no_alt) > 10:
            print(f"    ... and {len(all_imgs_no_alt) - 10} more")
    else:
        print("    [OK] All img tags have alt attributes")

    print()
    print(f"  [input labels / aria-label] — {len(all_inputs_no_label)} missing:")
    if all_inputs_no_label:
        for page, name in all_inputs_no_label[:10]:
            print(f"    -> {page}: input name/id=\"{name}\"")
        if len(all_inputs_no_label) > 10:
            print(f"    ... and {len(all_inputs_no_label) - 10} more")
    else:
        print("    [OK] All input elements have labels or aria-label")

    return {
        "lang_missing": lang_missing,
        "imgs_no_alt": all_imgs_no_alt,
        "inputs_no_label": all_inputs_no_label,
    }


def main():
    print()
    print("=" * 70)
    print("         ResumeIQ Frontend Test Suite (httpx + bs4)")
    print("=" * 70)
    print(f"  Target: {BASE}")
    print()

    with httpx.Client() as client:
        avail = test_page_availability(client)
        landing = test_landing_page(client)
        notfound = test_404(client)
        test_content_structure(client)
        a11y = test_accessibility(client)

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    total = len(PAGES)
    passed = sum(1 for r in avail if r.ok)
    failed_pages = [r.page for r in avail if not r.ok]
    print(f"  Pages tested:  {total}")
    print(f"  Pages OK (200): {passed}")
    if failed_pages:
        print(f"  Pages FAILED:  {', '.join(failed_pages)}")
    print(f"  404 page:      {'OK' if notfound in (404, 200) else 'ISSUE'} (status {notfound})")
    print(f"  Landing page:  {len(landing['errors'])} errors, {len(landing['warnings'])} warnings")
    print(f"  Accessibility:")
    print(f"    lang missing:      {len(a11y['lang_missing'])} pages")
    print(f"    imgs without alt:  {len(a11y['imgs_no_alt'])}")
    print(f"    inputs w/o label:  {len(a11y['inputs_no_label'])}")
    print()


if __name__ == "__main__":
    main()
