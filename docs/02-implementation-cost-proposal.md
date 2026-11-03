---
title: Implementation Cost & Support Proposal
subtitle: Prompt Funds digital savings and lending platform — for cooperative and credit-lending clients
doc: Commercial Proposal
version: "1.0"
---

# 1. Summary

Prompt Funds gives a licensed lender or cooperative a complete, mobile-first platform for **free online membership, an interest-earning savings wallet, and end-to-end digital lending** — without any transfer or payment-service features that would fall outside a lending licence.

We offer two ways to implement it:

| | **Option A — Managed platform** | **Option B — Dedicated build & licence** |
|---|---|---|
| What you get | Prompt Funds configured and branded for you, hosted and operated by us | A dedicated deployment in your own cloud accounts, source code licence, full handover |
| One-time fee | **₦4,500,000** | **₦19,000,000** (phased, see §3) |
| Monthly fee | From **₦350,000** (by active members, includes hosting & support) | Optional support retainer from **₦450,000** |
| Time to savings launch | 6–8 weeks after licences and bank accounts are ready | ~14 weeks |
| Best for | Cooperatives up to ~50,000 members wanting speed and low upfront cost | Larger lenders needing data residency in their own accounts, custom integrations, or in-house IT |

All fees are in Naira and **exclude 7.5% VAT** and third-party pass-through costs (§5). Quote valid for 30 days.

# 2. Scope included in both options

- Public website: home, savings, loans with live calculator, about, FAQs, registration.
- Member portal: registration, electronic BVN verification, own-account bank verification, dashboard, savings wallet, dedicated deposit account, withdrawals, transaction history, CSV statements, loans (apply, offer, schedule, repay), profile, notifications.
- Savings engine: double-entry ledger, webhook deposits with re-verification, maker-checker withdrawals, daily interest accrual and monthly credit, reconciliation job.
- Lending engine: configurable products (reducing balance or flat), automated credit checks, assessment → committee approval → offer acceptance → disbursement, repayment schedules, repayment from savings, auto-debit, arrears tracking.
- Admin portal: KPIs (liquidity cover, PAR, trial balance), member search & KYC queue, withdrawal queue, loan pipeline, reports (trial balance, income/expense, portfolio ageing), operations, hash-chained audit trail.
- Integrations: Paystack (or Monnify/Flutterwave) dedicated accounts and transfers; Dojah (or Prembly/Monnify) identity checks.
- Security: field-level encryption, maker-checker controls, role-based access, staff MFA, rate limiting, penetration-test remediation.
- Training for KYC, finance, loan and admin staff; runbooks; user guides.

# 3. Option B — phased implementation fees

| Phase | Weeks | Deliverables | Fee (₦) |
|---|---|---|---|
| 1. Discovery & design | 1–3 | Requirements sign-off, brand application, prototype on staging, UAT plan | 2,400,000 |
| 2. Core savings build-out | 3–10 | Live-sandbox integrations, reconciliation, MFA, notifications, PDF statements, exports, automated tests | 7,800,000 |
| 3. Hardening & UAT | 9–12 | Financial UAT support, concurrency and load tests, pen-test remediation, DR drill, training | 2,600,000 |
| 4. Savings pilot | 13–14 | Pilot support, daily reconciliation reviews, fixes | 900,000 |
| 5. Digital lending activation | 13–18 | Product configuration, loan agreement & key facts in-app, provisioning, collections tooling, lending UAT | 4,200,000 |
| 6. Lending go-live & hypercare | 19–20 | Go-live, 30 days priority support | 1,100,000 |
| **Total** | | | **19,000,000** |

**Payment schedule (Option B):** 30% on signing · 30% at start of UAT · 30% at savings go-live · 10% at lending go-live.

**Optional add-ons:**

| Add-on | Fee (₦) |
|---|---|
| Native Android + iOS apps (React Native, reusing the API) | 12,500,000 |
| Fixed-term deposits & target savings | 2,800,000 |
| Guarantor loans + credit bureau integration | 3,600,000 |
| USSD channel (via aggregator) | 4,200,000 |
| Data migration from spreadsheets / legacy system (per 10,000 members) | 950,000 |
| BI dashboards (Metabase) & automated board pack | 1,800,000 |

# 4. Option A — managed platform pricing

**One-time setup: ₦4,500,000** — branding, configuration of products and policies, integration with your payment and KYC accounts, staff training, pilot support.

| Plan | Active members | Monthly fee (₦) | Includes |
|---|---|---|---|
| Starter | up to 2,000 | 350,000 | Hosting, database, backups, monitoring, Essential support, updates |
| Growth | up to 10,000 | 650,000 | As Starter + Standard support, monthly performance report |
| Scale | up to 50,000 | 1,200,000 | As Growth + Premium support, quarterly security review |
| Enterprise | 50,000+ | Quoted | Dedicated infrastructure, custom SLAs |

Minimum term 12 months. Your data remains yours: full database export on request and at exit.

# 5. Third-party running costs (paid by the client, at cost)

These are paid directly to providers (or passed through at cost). Figures are indicative from providers’ published pricing at the time of writing and must be confirmed with each provider.

| Item | Indicative price | Notes |
|---|---|---|
| Paystack Dedicated Virtual Account deposits | 1% per deposit, capped at ₦300 | Largest variable cost; negotiate at volume |
| Paystack transfers (withdrawals, disbursements) | ₦10 (≤ ₦5,000), ₦25 (₦5,001–₦50,000), ₦50 (> ₦50,000) | Plus ₦50 stamp duty on transfers ≥ ₦10,000 |
| BVN / NIN verification | e.g. Monnify ₦10 per BVN, ₦60 per NIN; Dojah per-call wallet pricing | Budget ₦50–₦100 per applicant incl. retries |
| SMS (OTP, alerts) | ~₦5–₦12 per SMS depending on route | DND/corporate routes cost more |
| Hosting (Netlify Pro) + database (Neon Launch/Scale) | ~US$40–150 / month at launch scale | Usage-based; grows with traffic |
| Error monitoring, uptime, email | ~US$50–80 / month | Sentry, Better Stack, Resend |
| External penetration test | ₦1,500,000 – ₦3,000,000 | Once before launch, then annually |
| FCCPC digital lending registration | Application fee ₦100,000 plus further regulatory fees | Per DEON Regulations 2025; confirm current schedule |

## 5.1 Worked example — 2,000 active members

Assumptions: each member makes 2 deposits a month averaging ₦15,000; 1,000 withdrawals a month (60% ≥ ₦10,000); 300 new applicants; 6 SMS per member a month; exchange rate assumed at ₦1,550/US$ for USD-billed tools.

| Cost line | Monthly (₦) |
|---|---|
| Deposit fees: 4,000 × ₦150 | 600,000 |
| Transfer fees: 1,000 × ₦25 | 25,000 |
| Stamp duty on transfers ≥ ₦10k: 600 × ₦50 | 30,000 |
| Identity checks: 300 × ₦100 | 30,000 |
| SMS: 12,000 × ₦6 | 72,000 |
| Hosting, database, monitoring (~US$150) | 232,500 |
| **Total third-party** | **≈ 989,500** |

**Insight:** deposit fees dominate. Levers: negotiate the DVA cap at volume, encourage fewer larger monthly deposits (e.g. salary-day saving), compare Monnify/Flutterwave pricing, and include the cost in the savings-rate decision.

# 6. Support and maintenance (Option B retainer; included in Option A)

| | **Essential** | **Standard** | **Premium** |
|---|---|---|---|
| Monthly fee (₦) | 450,000 | 850,000 | 1,600,000 |
| Support hours | Mon–Fri 09:00–17:00 WAT | Mon–Sat 08:00–20:00 WAT | 24/7 for Sev-1; Mon–Sat 08:00–20:00 others |
| Sev-1 response / workaround | 4 h / 8 h | 1 h / 4 h | 30 min / 2 h |
| Sev-2 response | 8 business hours | 4 h | 2 h |
| Enhancement hours included | 8 | 24 | 60 |
| Security patching & dependency updates | Monthly | Fortnightly | Weekly |
| Monitoring & alert handling | Business hours | Extended hours | 24/7 |
| DR restore drill | Annual | Quarterly | Quarterly |
| Reporting | Quarterly | Monthly | Monthly + quarterly security review |
| Uptime commitment | 99.0% | 99.5% | 99.9% |

**Severity definitions.** **Sev-1:** money cannot be deposited, withdrawn or reconciled, data breach suspected, or platform down. **Sev-2:** a major function degraded with workaround (e.g. statements failing). **Sev-3:** minor defect or cosmetic issue. **Sev-4:** question or enhancement.

Additional enhancement work beyond included hours: **₦45,000 per hour** or fixed-price change requests.

# 7. Client responsibilities

- Cooperative registration, lending licence, FCCPC registration, and legal review of terms and loan agreements.
- Board-approved savings, lending, liquidity, provisioning and investment policies (rates and limits).
- Bank and payment-partner accounts, KYC provider account, and funding of provider wallets.
- A product owner and finance lead available for weekly reviews and UAT.
- Customer service for members (we provide tooling and training).

# 8. Assumptions and exclusions

- Prices assume one legal entity, one currency (NGN), English-language UI and up to two loan products at launch.
- Excludes regulatory and licensing fees, legal fees, third-party running costs, external penetration test fees, hardware, and marketing.
- Interest rates, fees and limits in the platform are configured from the client’s approved policies; we do not set financial policy.
- The platform does not, and will not be configured to, provide transfers to third parties or other payment services.
- Timeline starts once Phase 0 dependencies (licence confirmation, bank/payment accounts, KYC account) are in progress; delays there move go-live.

# 9. Why this proposal is low-risk

- **Working software from day one** — the platform already runs end to end; you review a live staging site, not slides.
- **Accounting-grade core** — double-entry ledger with database-enforced balance and append-only history; balances on screen always tie to the books.
- **Licence-safe by design** — no transfer features exist in the codebase; payouts only to verified own accounts.
- **No lock-in** — Option B gives you the source code; Option A includes full data export.
- **Serverless economics** — hosting costs start in the tens of dollars a month and scale with use.

# 10. Next steps

1. Choose Option A or B and support tier.
2. Kick-off workshop (2 hours) and access to policy documents.
3. Sign agreement and DPA; first invoice.
4. Staging site with your branding within 10 business days.
