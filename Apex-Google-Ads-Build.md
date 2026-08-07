# Apex Logistics Group — Google Ads Campaign Build

Concrete account structure applying the Google Ads Performance Playbook v2.1 (Section 10 architecture, Sections 7–9 measurement standards).

| Prepared For | Apex Logistics Group |
| --- | --- |
| Version | 1.0 |
| Budget Basis | $40,000 / month (baseline, scalable) |
| Status | Ready for Phase 0 (measurement) before launch |
| Last Updated | June 2026 |

## Contents

1. Assumptions
2. Budget Allocation
3. Campaign Inventory & Naming
4. Ad Group Themes + Keyword Lists
5. Negative Keyword Strategy
6. Performance Max Setup
7. Demand Gen / Remarketing
8. RSA Asset Copy
9. Measurement & Tracking
10. Playbook Validation & Blockers
11. Launch Roadmap
12. KPIs
13. Risks

---

## 1. Assumptions

| # | Assumption | Rationale |
| --- | --- | --- |
| 1 | $40k/month baseline (scales upward) | Per business input. |
| 2 | Launch priority: US first, then Canada, then international lanes | Prevents thin-data markets from wrecking Smart Bidding learning (Playbook §8, §15). |
| 3 | Three service lines: Freight Brokerage (LTL/FTL), International Forwarding (Ocean/Air), Warehousing & 3PL | Mixed offers need service-line separation (§10) so messaging, bids and landing pages match intent. |
| 4 | CRM exists (HubSpot/Salesforce-class) for SQL + offline conversion import | §7 requires the revenue feedback loop to function. |
| 5 | Conversion targets (tCPA) are placeholders set from Apex 90-day history via the §15 percentile method | Never guess guardrails from external benchmarks. |
| 6 | Account state is a mix of existing history and gaps | Verify rather than assume. |

---

## 2. Budget Allocation ($40,000 / month)

| Layer | Campaign Group | $/mo | % |
| --- | --- | --- | --- |
| Brand defense | Search | Brand | All Services | 2,000 | 5% |
| Search — Freight Brokerage | Lead Gen | Exact + Phrase | 9,000 | 22.5% |
| Search — International Forwarding | Lead Gen | Exact + Phrase | 5,400 | 13.5% |
| Search — Warehousing & 3PL | Lead Gen | Exact + Phrase | 3,600 | 9% |
| Performance Max | Brokerage + Forwarding + 3PL | 12,000 | 30% |
| Demand Gen / Remarketing | Nurture + Retarget | 6,000 | 15% |
| Test reserve | A/B tests, experiments | 2,000 | 5% |
| **Total** | | **40,000** | **100%** |

Why: Search owns high-intent demand (largest slice for a quote-driven B2B account). PMax complements rather than replaces Search (§10) and is budget-isolated to prevent cannibalization. The test reserve institutionalizes the §11 protocol.

---

## 3. Campaign Inventory & Naming

Naming follows the §5 convention: `Channel | Market | Objective | Service | Type`.

| # | Campaign Name | Bid Strategy | Launch |
| --- | --- | --- | --- |
| 1 | Search | US | Brand | All Services | Exact | Max Conversions | W2 |
| 2 | Search | US | Lead Gen | Freight Brokerage | Exact | tCPA | W2 |
| 3 | Search | US | Lead Gen | Freight Brokerage | Phrase | tCPA | W4 |
| 4 | Search | US | Lead Gen | Intl Forwarding | Exact | tCPA | W3 |
| 5 | Search | US | Lead Gen | Intl Forwarding | Phrase | tCPA | W5 |
| 6 | Search | US | Lead Gen | 3PL Warehousing | Exact | tCPA | W3 |
| 7 | Search | US | Lead Gen | 3PL Warehousing | Phrase | tCPA | W5 |
| 8 | Search | CA | Lead Gen | Full Suite | Phrase | Max Conversions | W6 |
| 9 | Search | Intl | Lead Gen | Forwarding Lanes | Phrase | Max Conversions | W8 |
| 10 | PMax | US | Lead Gen | Freight Brokerage | Max Conversions | W5 |
| 11 | PMax | US | Lead Gen | Intl Forwarding | Max Conversions | W5 |
| 12 | PMax | US | Lead Gen | 3PL Warehousing | Max Conversions | W6 |
| 13 | Demand Gen | US | Remarketing | All Services | Max Conversions | W6 |
| 14 | Demand Gen | US | Nurture | Non-Converters | Max Conversions | W7 |

Bid strategy logic (§8): new campaigns start on Maximize Conversions, switch to tCPA only after 30+ conversions in the learning period — not on a calendar schedule.

---

## 4. Ad Group Themes + Keyword Lists

### Freight Brokerage (Campaigns #2–3)

| Ad Group | Intent | Keywords |
| --- | --- | --- |
| Freight Quote | Transactional | `freight quote`, `get a freight quote`, `online freight quote`, `freight quotes online`, `request freight quote` |
| LTL Shipping | Transactional | `ltl shipping quote`, `ltl carriers`, `less than truckload rates`, `ltl freight quote`, `ltl shipping rates` |
| FTL / Full Truckload | Transactional | `full truckload quote`, `ftl carriers`, `full truckload rates`, `ftl shipping`, `truckload freight quote` |
| Freight Broker Services | Commercial | `freight broker`, `freight brokerage services`, `freight broker for shippers`, `freight brokerage company` |
| Industry Lanes | Commercial | `food freight shipping`, `pharmaceutical freight`, `hazmat freight shipping`, `temperature controlled freight` |

### International Forwarding (Campaigns #4–5)

| Ad Group | Intent | Keywords |
| --- | --- | --- |
| Ocean Import | Transactional | `ocean freight import`, `sea freight import quote`, `ocean shipping rates`, `import freight services` |
| Ocean Export | Transactional | `ocean freight export`, `export shipping services`, `sea freight export quote` |
| Air Freight | Transactional | `air freight quote`, `air cargo shipping`, `air freight rates`, `air cargo quote` |
| Customs Brokerage | Commercial | `customs brokerage services`, `customs broker`, `customs clearance service` |
| Lane-Specific | Commercial | `china to usa shipping`, `usa to uk freight`, `freight forwarding usa to europe` |

### Warehousing & 3PL (Campaigns #6–7)

| Ad Group | Intent | Keywords |
| --- | --- | --- |
| 3PL Services | Commercial | `3pl services`, `third party logistics company`, `3pl providers` |
| Warehousing | Commercial | `warehousing services`, `warehouse distribution services`, `warehousing solutions` |
| Fulfillment | Commercial | `order fulfillment services`, `ecommerce fulfillment 3pl`, `fulfillment company` |

---

## 5. Negative Keyword Strategy

Apply account-level, reviewed weekly (§6).

| Category | Examples |
| --- | --- |
| Job seekers | `freight broker salary`, `freight broker jobs`, `truck driver jobs` |
| Non-buyer / vehicle | `freightliner trucks for sale`, `used freight trucks` |
| Informational | `what is ltl`, `how does a freight broker work` |
| Low-intent modifiers | `cheapest`, `free`, `student`, `course`, `training` |
| Competitor brands | Pause at search-term level; add as negatives once confirmed non-converting |

Match-type discipline (§10): Phrase/Broad live only inside designated campaigns; account-level negatives stop bleed between service lines.

---

## 6. Performance Max Setup

- One campaign per service line (#10–12).
- Audience signals: In-market "Freight & Logistics", uploaded customer list, remarketing visitors, keyword + URL signals per service line.
- Exclusions: existing customers, converted visitors (30-day), competitor keywords.
- Required assets per campaign: 15 headlines, 5 long headlines, 4 descriptions, sitelinks + callouts, 4 images, 1 video.
- Guardrail (§8): weekly cost-per-SQL check. If PMax degrades efficiency on high-intent queries vs. Search, add negatives and tighten exclusions before touching budgets.

---

## 7. Demand Gen / Remarketing

- Retargeting: site visitors 30 days, quote-page visitors, non-converters — recency windows per §10.
- Nurture: uploaded qualified-but-unclosed lead list (30–90 day).
- Creative: image + short video + Discovery; max 2 concurrent test concepts (§11 concurrency rule).

---

## 8. RSA Asset Copy

Use per service line; swap the bracketed descriptor as applicable.

### Headlines (15)
1. Get a Freight Quote in Minutes
2. Fast [Service Line] Quotes
3. Trusted [Service Line] Provider
4. National Coverage, Local Care
5. Transparent Freight Pricing
6. Book Your [Service] Online
7. Dedicated Logistics Experts
8. Reliable. On-Time. Every Time.
9. Instant Freight Rate Quotes
10. Save on [Service Line] Costs
11. 24/7 Shipping Support
12. Quote, Book, Track — All in One
13. Your Cargo, Our Priority
14. No-Obligation Freight Quotes
15. Industry-Leading [Service] Solutions

### Long Headlines (5)
1. Get a Custom Freight Quote From Experienced Logistics Professionals
2. Compare [Service Line] Rates Without the Hassle — Get Your Quote Today
3. A Dedicated Team Handling Your [Service Line] End to End
4. Move Your Goods With a 3PL That Prioritizes On-Time Delivery
5. From Quote to Delivery, We Manage Your Entire Supply Chain

### Descriptions (4)
1. Get an accurate freight quote fast. Real logistics experts, transparent rates, no hidden fees.
2. Nationwide [service] with dedicated account management and 24/7 tracking on every shipment.
3. We move your goods on time and on budget. Request a quote and see the Apex difference.
4. Flexible [service line] solutions scaled to your volume. Talk to a logistics specialist today.

### Sitelinks
- Request a Quote
- Our Services
- Track a Shipment
- Why Apex
- Service Coverage
- Contact Us

### Callouts
- On-Time Guarantee
- Dedicated Account Manager
- 24/7 Support
- Competitive Rates
- 30+ Years Experience
- Nationwide Coverage

---

## 9. Measurement & Tracking

Locked before launch per §9.

| Item | Standard |
| --- | --- |
| Primary conversions | `Lead | Quote Submit | Web Form`, `Lead | Quote Request | Call` (>60s) |
| Secondary conversions | `Engagement | Chat Start`, `Engagement | Email Click` |
| GA4 events | `lead/quote_submit`, `call_started` (snake_case, matched to Ads names) |
| Attribution | Data-driven once >15 conv/30 days; Last-click below that — state in every report |
| Consent | CMP + Consent Mode; mandatory once CA/Intl/EU traffic runs |
| Offline import | SQLs + revenue value imported weekly from CRM |
| Reconciliation | Monthly: Ads vs GA4 vs CRM variance check before budget decisions |
| UTM | `utm_source=google`, `utm_medium=cpc`, `utm_campaign=<campaign_name>`; verified monthly |

---

## 10. Playbook Validation & Blockers

| Playbook Section | Apex Application | Action Required |
| --- | --- | --- |
| §7 Lead Quality | Confirmed critical — mixed suite generates mixed lead quality | Blocking: agree MQL/SQL definitions with sales; CRM source capture per campaign |
| §8 Bidding | Confirmed — staged tCPA rollout | Needs 90-day history if account exists; else placeholder targets |
| §9 Measurement | Confirmed — wired before any spend | Blocking: tracking audit + consent + offline import |
| §10 Architecture | Applied — service-line separation | Verify 3 unique service-line landing pages exist |
| §11 Testing | Test reserve = 5% ($2k) | Confirmed in budget |
| §15 Baselines | Targets set from Apex 90-day data | Needs real account pull |

**Two blockers (cannot be guessed):**
1. Conversion tracking verified firing before launch — spending without it violates §6 and §9.
2. Service-line landing pages exist — one generic homepage breaks message-match (§4 Quality Score logic).

---

## 11. Launch Roadmap

| Phase | Timeline | Deliverable |
| --- | --- | --- |
| 0 — Measurement | Week 1 | Tracking audit, GTM + GA4 + Consent, conversion actions, CRM/offline import. Gate: no spend without this. |
| 1 — Brand + Brokerage Search | Week 2 | Campaigns #1–2 live; negatives + call tracking |
| 2 — Forwarding + 3PL Search | Weeks 3–4 | Campaigns #4, #6; then Phrase expansions (#3, #5, #7) |
| 3 — PMax + Remarketing | Weeks 5–6 | PMax (#10–12), Demand Gen (#13–14), CA Search (#8) |
| 4 — Scale + International | Weeks 7–8+ | Intl lanes (#9), budget shifts from learnings, first tests (§11) |

---

## 12. KPIs

Weekly: spend vs pacing (±10%), CPC, CTR, conversions, conversion rate, CPA, cost per MQL.
Monthly: cost per SQL, MQL-to-SQL, lead-to-close, revenue per lead (from CRM), ROAS where revenue imports run.

Targets set from Apex baselines (§15), not industry benchmarks.

---

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| PMax cannibalizes Search | Negatives, exclusions, weekly cost-per-SQL monitoring (§10) |
| Thin data in CA/Intl wrecks learning | Phased launch — US first, expand after baselines (§15) |
| Mixed suite dilutes message match | Service-line campaign + landing page separation |
| Attribution noise on migration | Document model, reconcile monthly, flag period breaks (§9) |
| Lead quality drift | Weekly cost-per-SQL review with sales (§7) |
