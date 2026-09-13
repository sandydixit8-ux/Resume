# Unit Economics — Rachna Home (reference model)

All figures 2026 ranges from public data; REPLACE with your real supplier + courier quote.

## Cost stack (per 3-pc set, GST-cleaned)

| Item | ₹ |
|---|---:|
| Product (wholesale, net of ITC) | 220 |
| Packaging (box, tissue, label, card) | 45 |
| Pick/pack labour | 10 |
| Forward shipping (500g–1kg prepaid surface, incl fuel+GST) | 70 |
| Payment gateway (0% new-merchant promo — else 2.36%) | 0 / 14 |
| Returns/RTO allowance (~5% leakage) | 40 |
| **Total non-ad cost / single order** | **385** |

## Pricing matrix (single set)

| Sell | Contribution before ads | Break-even CAC | Net @ CAC ₹200 |
|---|---:|---:|---:|
| ₹599 | ₹214 | ₹214 | ₹14 |
| ₹699 | ₹314 | ₹314 | ₹114 |
| ₹899 | ₹514 | ₹514 | ₹314 |
| ₹999 | ₹614 | ₹614 | ₹414 |

**Optimal single price: ₹699 (MRP ₹999).** Real profit comes from bundles.

## Bundles

| Offer | Price | Contribution | Note |
|---|---:|---:|---|
| 1 × set | ₹699 | ₹314 | funnel anchor |
| 2 × set | ₹1,299 | ₹599 | ⭐ default CTA |
| 3 × set | ₹1,699 | ₹879 | best margin % |
| Kit (2 sets + vacuum bags) | ₹2,299 | ~₹1,150 | month-2 |

## Blended base case (52% singles + 48% Buy-2 → AOV ₹990)

- Contribution before ads: ₹451/order
- Break-even ROAS = 990/451 ≈ **2.2**
- Target CAC ₹150–210 → Target ROAS ~4.5–5.5
- Net / delivered order ≈ ₹240

## Break-even formula (per master plan)

```
Break-even ROAS = Selling Price / Contribution Before Ads
Break-even CAC  = Contribution Before Ads
```
High ROAS ≠ high profit if contribution is thin — judge net ₹/order, not ROAS alone.

## Volume scenarios (base case, ₹240 net/order)

| Orders/day | Monthly orders | Revenue | Contribution | Ad spend (~44% of rev) | Net/month |
|---|---:|---:|---:|---:|---:|
| 10 | 280 | ₹2.8L | ₹67k | ₹1.2L | ₹33k |
| 25 | 700 | ₹6.9L | ₹1.7L | ₹3.0L | ₹84k |
| 50 | 1,400 | ₹13.9L | ₹3.3L | ₹6.1L | ₹1.7L |
| 100 | 2,800 | ₹27.7L | ₹6.7L | ₹12.2L | ₹3.3L |

## Working capital needed (self-funded)

| Scale | Approx capital in pipeline | Note |
|---|---:|---|
| 10/day | ~₹2.0L | supplier + shipping advanced before PG payout |
| 25/day | ~₹5.0L | |
| 50/day | ~₹10L | |
| 100/day | ~₹20L | |

**Rule:** restock only what the previous 2 weeks sold. Scale costs cash — reinvest 55–65% of contribution into ads, never spend the ₹2,000 reserve.

## Dashboard formulas (Google Sheets)

```
CTR%        = Clicks / Impressions
CPC         = Spend / Clicks
ATC%        = ATC / Clicks
IC%         = IC / ATC
ROAS        = Revenue / Spend
Delivered%  = Delivered / Orders
CAC         = Spend / Orders
AOV         = Revenue / Orders
COGS        = Orders * 340
PackShipFees= Orders * 150
PG Fees     = Revenue * 0.025   (steady-state incl GST)
NetContribution = Revenue − COGS − PackShipFees − PG Fees − Refunds − Spend
```

## Bad / Base / Good (full stack)

| Line | Bad | Base | Good |
|---|---:|---:|---:|
| Revenue (AOV) | ₹699 | ₹990 | ₹1,299 |
| COGS | 260 | 340 | 440 |
| Packaging + FF | 55 | 60 | 65 |
| Shipping | 70 | 85 | 95 |
| PG | 16 | 7 | 7 |
| Returns/RTO | 55 | 48 | 40 |
| Contribution before ads | 243 | 450 | 652 |
| CAC | 600 | 210 | 150 |
| Net/order | −357 | +240 | +502 |