"""
ResumeIQ Frontend — Comprehensive UX/UI Audit
==============================================
Read-only audit of localhost:3000 pages via httpx + html.parser.
Covers: HTTP status, SEO, headings, images, links, a11y, responsive, errors.
"""

import json
import re
import sys
import time
from html.parser import HTMLParser
from urllib.parse import urljoin

try:
    import httpx
except ImportError:
    sys.exit("httpx not installed – run: pip install httpx")

BASE = "http://127.0.0.1:3000"

DESKTOP_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
)

PAGES = [
    "/", "/analyze", "/jd-match", "/builder", "/cover-letter",
    "/interview", "/hr-shortlist", "/recruiter", "/pricing",
    "/contact", "/dashboard", "/admin/login",
]

FINDINGS: list[dict] = []


def finding(severity, category, title, detail, page="global"):
    FINDINGS.append({
        "severity": severity,
        "category": category,
        "title": title,
        "detail": detail,
        "page": page,
    })


# ---------------------------------------------------------------------------
# Lightweight HTML analyser (no external dep beyond stdlib + httpx)
# ---------------------------------------------------------------------------
class HTMLAnalysis:
    """Stores parsed metrics for one HTML document."""

    def __init__(self, html: str, status_code: int, url: str, headers: dict):
        self.html = html
        self.status_code = status_code
        self.url = url
        self.headers = headers
        self.title = ""
        self.meta_desc = ""
        self.lang = ""
        self.headings: dict[str, list[str]] = {}
        self.images: list[dict] = []
        self.links: list[dict] = []
        self.forms: list[dict] = []
        self.inputs_without_label: list[dict] = []
        self.buttons: list[dict] = []
        self.skip_nav = False
        self.duplicate_ids: list[str] = []
        self.all_ids: list[str] = []
        self.aria_labels_present = 0
        self.anchor_links: list[str] = []

        self._parse()

    # ---- helpers ----
    def _get_attr(self, attrs, name):
        for k, v in attrs:
            if k == name:
                return v or ""
        return ""

    # ---- main parse ----
    def _parse(self):
        import re as _re
        tags_seen: list[tuple[str, dict]] = []
        id_count: dict[str, int] = {}
        self._all_ids: list[str] = []

        class _P(HTMLParser):
            def __init__(self2):
                super().__init__()
                self2._in_tag: str | None = None

            def handle_starttag(self2, tag, attrs):
                ad = dict(attrs)
                aid = ad.get("id", "")
                if aid:
                    self2._all_ids.append(aid)
                    id_count[aid] = id_count.get(aid, 0) + 1

                tags_seen.append((tag, ad))

            def handle_data(self2, data):
                pass

        p = _P()
        p.feed(self.html)

        # Store all ids found
        self.all_ids = p._all_ids
        self.duplicate_ids = [i for i, c in id_count.items() if c > 1]

        # Title
        m = re.search(r"<title[^>]*>(.*?)</title>", self.html, re.S | re.I)
        self.title = m.group(1).strip() if m else ""

        # Meta description
        m = re.search(
            r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']',
            self.html, re.I | re.S,
        )
        if not m:
            m = re.search(
                r'<meta\s+content=["\'](.*?)["\']\s+name=["\']description["\']',
                self.html, re.I | re.S,
            )
        self.meta_desc = m.group(1).strip() if m else ""

        # Lang
        m = re.search(r'<html[^>]*\slang=["\']([^"\']+)["\']', self.html, re.I)
        self.lang = m.group(1) if m else ""

        # Headings
        for level in range(1, 7):
            pattern = re.compile(rf"<h{level}[^>]*>(.*?)</h{level}>", re.S | re.I)
            matches = [re.sub(r"<[^>]+>", "", h).strip() for h in pattern.findall(self.html)]
            if matches:
                self.headings[f"h{level}"] = matches

        # Images — src and alt
        img_pattern = re.compile(r"<img\s[^>]*?>", re.I | re.S)
        for m in img_pattern.finditer(self.html):
            tag = m.group(0)
            src = re.search(r'\bsrc=["\']([^"\']+)["\']', tag, re.I)
            alt = re.search(r'\balt=["\']([^"\']*)["\']', tag, re.I)
            self.images.append({
                "src": src.group(1) if src else "",
                "alt": alt.group(1) if alt else None,
            })

        # Links
        link_pattern = re.compile(r"<a\s[^>]*?>", re.I | re.S)
        for m in link_pattern.finditer(self.html):
            tag = m.group(0)
            href = re.search(r'\bhref=["\']([^"\']*)["\']', tag, re.I)
            text = re.sub(r"<[^>]+>", "", tag).strip()
            h = href.group(1) if href else ""
            self.links.append({"href": h, "text": text})
            if h in ("#", ""):
                self.anchor_links.append(h or "(empty)")

        # Skip-nav
        self.skip_nav = bool(re.search(r"skip.*(to|nav|content)", self.html, re.I))

        # Forms / inputs / labels
        label_for: set[str] = set()
        lf_pattern = re.compile(r'<label[^>]*\sfor=["\']([^"\']+)["\']', re.I)
        for m2 in lf_pattern.finditer(self.html):
            label_for.add(m2.group(1).lower())

        inp_pattern = re.compile(r"<input\s[^>]*?>", re.I | re.S)
        for m2 in inp_pattern.finditer(self.html):
            tag = m2.group(0)
            inp_type = re.search(r'\btype=["\']([^"\']+)["\']', tag, re.I)
            inp_id = re.search(r'\bid=["\']([^"\']+)["\']', tag, re.I)
            inp_name = re.search(r'\bname=["\']([^"\']+)["\']', tag, re.I)
            has_aria = bool(re.search(r'\baria-label', tag, re.I))
            t = (inp_type.group(1) if inp_type else "text").lower()
            if t in ("hidden", "submit", "button", "reset"):
                continue
            iid = (inp_id.group(1).lower() if inp_id else "")
            if iid not in label_for and not has_aria:
                self.forms.append({
                    "type": t,
                    "id": inp_id.group(1) if inp_id else "",
                    "name": inp_name.group(1) if inp_name else "",
                    "has_label": False,
                    "has_aria": has_aria,
                })

        # Buttons
        btn_pattern = re.compile(r"<button\s[^>]*?>", re.I | re.S)
        for m2 in btn_pattern.finditer(self.html):
            tag = m2.group(0)
            has_aria = bool(re.search(r'\baria-label', tag, re.I))
            text = re.sub(r"<[^>]+>", "", tag).strip()
            self.buttons.append({"text": text, "has_aria": has_aria})

        # aria-labels count
        self.aria_labels_present = len(re.findall(r'\baria-label', self.html, re.I))

        # Colours — flag inline colour without sufficient contrast helpers
        # We look for hex colours in style attributes or <style> blocks
        self.hex_colours = re.findall(
            r"(?:color|background|background-color)\s*:\s*#([0-9a-fA-F]{3,8})",
            self.html, re.I,
        )


# ---------------------------------------------------------------------------
# Fetching & analysis helpers
# ---------------------------------------------------------------------------
def fetch_page(path: str, ua: str = DESKTOP_UA) -> httpx.Response:
    client = httpx.Client(timeout=15, follow_redirects=False, verify=False)
    resp = client.get(f"{BASE}{path}", headers={"User-Agent": ua})
    return resp


def analyse(path: str, ua: str = DESKTOP_UA) -> HTMLAnalysis | None:
    try:
        resp = fetch_page(path, ua)
        return HTMLAnalysis(resp.text, resp.status_code, str(resp.url), dict(resp.headers))
    except Exception as exc:
        finding("P0", "Availability", f"Failed to fetch {path}", str(exc), path)
        return None


# ---------------------------------------------------------------------------
# Audit sections
# ---------------------------------------------------------------------------

def audit_http_status(pages):
    print("\n[1] HTTP Status Codes")
    for p in pages:
        a = analyse(p)
        if a is None:
            continue
        if a.status_code != 200:
            finding("P0", "HTTP", f"Non-200 status {a.status_code}", f"{p} returned {a.status_code}", p)
            print(f"  {p:25s} {a.status_code}")
        else:
            print(f"  {p:25s} OK (200)")


def audit_seo(pages):
    print("\n[2] SEO Meta Tags")
    for p in pages:
        a = analyse(p)
        if a is None:
            continue
        if not a.title:
            finding("P1", "SEO", "Missing <title>", f"Page {p} has no title tag", p)
            print(f"  {p:25s} MISSING title")
        else:
            print(f"  {p:25s} title={a.title[:60]}")

        if not a.meta_desc:
            finding("P1", "SEO", "Missing meta description", f"Page {p} has no meta description", p)
            print(f"  {'':25s} MISSING meta description")
        else:
            print(f"  {'':25s} desc={a.meta_desc[:70]}")


def audit_headings(pages):
    print("\n[3] Heading Hierarchy")
    for p in pages:
        a = analyse(p)
        if a is None:
            continue
        h1s = a.headings.get("h1", [])
        if len(h1s) == 0:
            finding("P1", "Accessibility", "Missing <h1>", f"Page {p} has no h1", p)
        elif len(h1s) > 1:
            finding("P2", "SEO", "Multiple <h1> tags", f"Page {p} has {len(h1s)} h1 tags", p)
        # Check skip levels
        levels = sorted(int(k[1]) for k in a.headings.keys())
        for i in range(1, len(levels)):
            if levels[i] - levels[i - 1] > 1:
                finding("P2", "Accessibility", "Heading level skip", f"Page {p}: h{levels[i-1]} -> h{levels[i]}", p)
        summary = ", ".join(f"{k}={len(v)}" for k, v in sorted(a.headings.items()))
        print(f"  {p:25s} {summary or '(no headings)'}")


def audit_images(pages):
    print("\n[4] Image Audit")
    for p in pages:
        a = analyse(p)
        if a is None:
            continue
        for img in a.images:
            src = img["src"]
            alt = img["alt"]
            if alt is None:
                finding("P1", "Accessibility", "Image missing alt", f"src={src}", p)
                print(f"  {p:25s} MISSING alt  src={src[:80]}")
            elif alt == "":
                finding("P2", "Accessibility", "Empty alt text", f"src={src}", p)
            else:
                print(f"  {p:25s} OK  src={src[:60]}  alt={alt[:40]}")


def audit_links(pages):
    print("\n[5] Link Audit (empty href)")
    for p in pages:
        a = analyse(p)
        if a is None:
            continue
        for link in a.links:
            href = link["href"]
            if href in ("#", ""):
                text = link["text"][:50] or "(no text)"
                finding("P2", "UX", "Empty / placeholder link", f"href='{href}' text='{text}'", p)
                print(f"  {p:25s} href='{href}'  text={text}")


def audit_duplicate_ids(pages):
    print("\n[6] Duplicate IDs")
    for p in pages:
        a = analyse(p)
        if a is None:
            continue
        for did in a.duplicate_ids:
            finding("P1", "Accessibility", "Duplicate element ID", f"id='{did}'", p)
            print(f"  {p:25s} DUPLICATE id='{did}'")


def audit_forms(pages):
    print("\n[7] Form Label Audit")
    for p in pages:
        a = analyse(p)
        if a is None:
            continue
        for inp in a.forms:
            desc = inp["id"] or inp["name"] or inp["type"]
            finding("P1", "Accessibility", "Input without label/aria-label",
                    f"input id='{inp['id']}' name='{inp['name']}' type='{inp['type']}'", p)
            print(f"  {p:25s} MISSING label  id={inp['id']}  name={inp['name']}")


def audit_aria(pages):
    print("\n[8] ARIA Labels on Interactive Elements")
    for p in pages:
        a = analyse(p)
        if a is None:
            continue
        for btn in a.buttons:
            if not btn["has_aria"] and not btn["text"]:
                finding("P1", "Accessibility", "Button without accessible name",
                        f"button text='{btn['text']}' (no aria-label)", p)
                print(f"  {p:25s} button NO aria-label  text='{btn['text']}'")
        print(f"  {p:25s} aria-label elements found: {a.aria_labels_present}")


def audit_skip_nav(pages):
    print("\n[9] Skip Navigation")
    for p in pages[:4]:  # sample first few
        a = analyse(p)
        if a is None:
            continue
        status = "YES" if a.skip_nav else "NO"
        if not a.skip_nav:
            finding("P2", "Accessibility", "No skip-nav link", f"Page {p}", p)
        print(f"  {p:25s} {status}")


def audit_lang(pages):
    print("\n[10] HTML lang attribute")
    a = analyse("/")
    if a:
        if a.lang:
            print(f"  lang='{a.lang}'")
        else:
            finding("P1", "Accessibility", "Missing lang attribute", "On <html> element", "/")
            print("  MISSING lang attribute")


def audit_responsive(pages):
    print("\n[11] Responsive / Mobile Check")
    for p in pages[:5]:
        a_desk = analyse(p, DESKTOP_UA)
        a_mobi = analyse(p, MOBILE_UA)
        if a_desk is None or a_mobi is None:
            continue
        desk_size = len(a_desk.html)
        mobi_size = len(a_mobi.html)
        same = desk_size == mobi_size
        if same:
            finding("P2", "Responsive", "Same HTML served for desktop and mobile",
                    f"Size: {desk_size} bytes for both", p)
        print(f"  {p:25s} desktop={desk_size:>7}  mobile={mobi_size:>7}  same={same}")


def audit_404():
    print("\n[12] Error Page (404)")
    try:
        resp = fetch_page("/nonexistent-page-xyz-12345")
        a = analyse("/nonexistent-page-xyz-12345")
        code = resp.status_code
        print(f"  Status: {code}")
        if a:
            has_content = bool(a.title or a.headings)
            print(f"  Has useful content: {has_content}")
            if not has_content:
                finding("P2", "UX", "404 page lacks useful content",
                        f"Status {code} but no title or headings", "/nonexistent")
            elif code == 200:
                finding("P1", "UX", "404 page returns 200 instead of 404",
                        "Client-side routing may catch all routes", "/nonexistent")
    except Exception as e:
        print(f"  Could not fetch: {e}")


def audit_cta_links():
    print("\n[13] CTA / Nav Link Validation (header + footer)")
    all_links = {"/", "/analyze", "/jd-match", "/cover-letter", "/builder",
                 "/interview", "/recruiter", "/pricing", "/contact",
                 "/dashboard", "/admin/login", "/privacy", "/terms",
                 "/hr-shortlist"}
    for link in sorted(all_links):
        try:
            resp = fetch_page(link)
            ok = resp.status_code == 200
            print(f"  {link:25s} -> {resp.status_code}")
            if not ok:
                finding("P0", "Navigation", f"Link broken (HTTP {resp.status_code})",
                        f"Link /{link} returns {resp.status_code}", link)
        except Exception as e:
            finding("P0", "Navigation", f"Link unreachable", f"/{link}: {e}", link)
            print(f"  {link:25s} -> ERROR: {e}")


def audit_colours(pages):
    print("\n[14] Colour Palette Scan")
    all_hex: set[str] = set()
    for p in pages[:6]:
        a = analyse(p)
        if a is None:
            continue
        for h in a.hex_colours:
            all_hex.add(h.lower())
    print(f"  Distinct hex colour values found: {len(all_hex)}")
    for c in sorted(all_hex)[:20]:
        print(f"    #{c}")
    if len(all_hex) > 20:
        print(f"    ... and {len(all_hex) - 20} more")


def audit_css_backgrounds():
    print("\n[15] CSS Background Audit (inline style)")
    a = analyse("/")
    if a is None:
        return
    bgs = re.findall(r'background(?:-color)?\s*:\s*([^;"\']+)', a.html, re.I)
    print(f"  Inline background values found: {len(bgs)}")
    for bg in bgs[:10]:
        print(f"    {bg.strip()[:60]}")


def audit_focus_management():
    print("\n[16] Focus / Keyboard Accessibility Quick Check")
    a = analyse("/")
    if a is None:
        return
    has_tabindex = bool(re.search(r'tabindex', a.html, re.I))
    has_outline_none = bool(re.search(r'outline\s*:\s*none|outline\s*:\s*0', a.html, re.I))
    print(f"  tabindex present: {has_tabindex}")
    print(f"  outline:none detected: {has_outline_none}")
    if has_outline_none:
        finding("P2", "Accessibility", "outline:none detected", "May remove keyboard focus indicator", "/")


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
def print_report():
    sev_order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    sorted_f = sorted(FINDINGS, key=lambda f: sev_order.get(f["severity"], 9))
    by_sev: dict[str, list[dict]] = {}
    for f in sorted_f:
        by_sev.setdefault(f["severity"], []).append(f)

    print("\n" + "=" * 90)
    print("  RESUMEIQ FRONTEND AUDIT — FINDINGS REPORT")
    print("=" * 90)
    total = len(FINDINGS)
    for sev in ("P0", "P1", "P2", "P3"):
        items = by_sev.get(sev, [])
        print(f"\n{'-' * 90}")
        print(f"  {sev} — {len(items)} finding{'s' if len(items) != 1 else ''}")
        print(f"{'-' * 90}")
        for i, f in enumerate(items, 1):
            print(f"  [{i}] [{f['severity']}] [{f['category']}] {f['title']}")
            print(f"      Page: {f['page']}")
            print(f"      Detail: {f['detail']}")
            print()
    print("=" * 90)
    print(f"  TOTAL FINDINGS: {total}")
    print(f"    P0 (Critical): {len(by_sev.get('P0', []))}")
    print(f"    P1 (Major):    {len(by_sev.get('P1', []))}")
    print(f"    P2 (Minor):    {len(by_sev.get('P2', []))}")
    print(f"    P3 (Info):     {len(by_sev.get('P3', []))}")
    print("=" * 90)

    # Write JSON
    with open("frontend_audit_results.json", "w") as fp:
        json.dump({"findings": FINDINGS, "summary": {
            "P0": len(by_sev.get("P0", [])),
            "P1": len(by_sev.get("P1", [])),
            "P2": len(by_sev.get("P2", [])),
            "P3": len(by_sev.get("P3", [])),
            "total": total,
        }}, fp, indent=2)
    print(f"\n  JSON report saved to: frontend_audit_results.json")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 90)
    print("  RESUMEIQ FRONTEND AUDIT — Starting at", time.strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 90)

    audit_http_status(PAGES)
    audit_seo(PAGES)
    audit_headings(PAGES)
    audit_images(PAGES)
    audit_links(PAGES)
    audit_duplicate_ids(PAGES)
    audit_forms(PAGES)
    audit_aria(PAGES)
    audit_skip_nav(PAGES)
    audit_lang(PAGES)
    audit_responsive(PAGES)
    audit_404()
    audit_cta_links()
    audit_colours(PAGES)
    audit_css_backgrounds()
    audit_focus_management()

    print_report()


if __name__ == "__main__":
    main()
