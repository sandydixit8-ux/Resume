# रचना · Rachna Home — Real-World Launch Kit

India D2C storage brand. Rs 25,000 capital start. Prepaid-only. Built from the master plan and execution packs.

## What's in this folder

```
rachna/
├── README.md                 ← this file (start here)
├── brand/
│   └── brand-guide.md        ← name, story, colors, logo, voice, packaging
├── site/                     ← deployable static website (mobile-first)
│   ├── index.html            ← landing page (14 conversion sections)
│   ├── about.html
│   ├── contact.html
│   ├── faq.html
│   ├── shipping.html         ← shipping policy
│   ├── returns.html          ← return/refund policy
│   ├── privacy.html
│   ├── terms.html
│   ├── order-confirmation.html
│   ├── css/style.css
│   ├── js/main.js
│   └── assets/img/           ← DROP YOUR REAL FILES HERE (see below)
├── ads/
│   └── meta-ads.md           ← 10 ready-to-post Meta ad drafts
├── scripts/
│   └── video-scripts.md      ← 10 shot-by-shot phone scripts
├── suppliers/
│   └── supplier-checklist.md ← 20-question WhatsApp message + red flags
└── finance/
    ├── kpi-dashboard.csv     ← daily dashboard (import into Google Sheets)
    └── unit-economics.md     ← cost model, break-even ROAS, scenarios
```

## The 8 numbers you must not forget

| Metric | Value |
|---|---|
| Landed cost / 3-pc set | Rs 270 (target, ngapadi supplier quote) |
| Sell price | Rs 699 single (MRP Rs 999) · Buy 2 = Rs 1,299 · Buy 3 = Rs 1,699 |
| Blended AOV | Rs 990 |
| Break-even ROAS | 2.2 |
| Target ROAS / CAC | 4.5–5.5 / ≤ Rs 210 |
| Net / order (base) | Rs 240 |
| Ad budget month 1 | Rs 8,000 (Rs 250–400/day) |
| Initial inventory | 24 unit-sets |

## Media files to drop into `site/assets/img/`

| File name | Where it shows |
|---|---|
| `hero-cover.jpg` | demo video poster on landing page |
| `demo-reel.mp4` | hero demo video (15–30s) |
| `product-1.jpg` .. `product-4.jpg` | USP / benefits sections |
| `problem-vs-solution.jpg` | problem → solution section |
| `review-1.jpg`, `review-2.jpg`, `review-video.mp4` | social proof |
| `logo.svg` (optional) | header logo (else text logo renders) |

## Personal data to fill (search for `[YOUR...` in files)

`[YOUR-WHATSAPP]` · `[YOUR-GSTIN]` · `[YOUR-ADDRESS]` · `[YOUR-CITY]` · `[YOUR-EMAIL]` · `[YOUR-CHECKOUT-LINK]` (each Buy button links here) · `[YOUR-DOMAIN]`.

## Tracking (already wired into every page)

Every page already loads `site/js/tracking.js` (Meta Pixel + GA4 + event wiring: PageView, ViewContent on the product page, InitiateCheckout on all Buy buttons). Just open that file and replace the two IDs:

| Field | Where to get it |
|---|---|
| `[YOUR-META-PIXEL-ID]` | Meta Business Suite → Events Manager → Pixel |
| `[YOUR-GA4-ID]` | Google Analytics → Admin → Data Streams (`G-XXXXXXX`) |

Then verify with Meta Pixel Helper on a real test purchase. Purchase events must fire from your payment gateway's confirmation page — add the pixel `purchase` code there (Razorpay/Cashfree webhook docs), since checkout is hosted externally.

## Deploy options (cheap → free)

1. **Netlify Drop** — drag & drop this `site/` folder → get a public URL in 60 seconds (free). Point `rachna.in` to it later.
2. **GitHub Pages** — push `site/` → serve from repo.
3. **WordPress (later)** — copy the section copy into WooCommerce when you want cart/orders done properly.

## Go-live checklist (7 days)

- [ ] Day 1: Buy `rachna.in` · open Razorpay/Cashfree KYC (grab 0% fee promo) · take @rachna Instagram + WhatsApp
- [ ] Day 2: Send supplier checklist to 3 suppliers → order 3 samples
- [ ] Day 3: Deploy site (Netlify) · edit About/FAQ/policies with your data
- [ ] Day 4: Shoot creative batch 1 (video-scripts.md Formats 1–2) → drop media into assets
- [ ] Day 5: Install tracking: Meta Pixel + Conversions API + GA4 (see master plan §Tracking)
- [ ] Day 6: Samples arrive → test routine (supplier-checklist.md) → order 24 units
- [ ] Day 7: Site live → test order end-to-end → launch ads 1–6 (ads/meta-ads.md)

## Compliance reminders

- MRP + GSTIN + "Made in India" must be on every pack (Legal Metrology).
- No health/medicinal claims in any ad copy (Meta ad account policy — bans kill budgets).
- Verify trademark + domain + social availability before printing brand onto anything.

Numbers marked "target/approx" are 2026 price ranges from search data and MUST be replaced with your real supplier quote.