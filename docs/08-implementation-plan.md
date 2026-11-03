---
title: Implementation Plan
subtitle: Prompt Funds — phases, timeline, team, deliverables and go-live checklist
doc: Implementation Plan
version: "1.0"
---

# 1. Approach

Deliver in phases so the cooperative **accepts members’ money only after the core ledger is proven**, and switches on digital lending only once savings operations are stable. The codebase already contains a working implementation of every phase-1 and phase-2 module; the plan below takes it from working software to a licensed, tested, live service.

**Total time to savings launch: ~14 weeks. Lending live: ~20 weeks.** Regulatory and banking workstreams (Phase 0) run in parallel with engineering.

# 2. Timeline

| Week | 1–2 | 3–4 | 5–6 | 7–8 | 9–10 | 11–12 | 13–14 | 15–16 | 17–18 | 19–20 |
|---|---|---|---|---|---|---|---|---|---|---|
| **0 Regulatory & banking** | ■■ | ■■ | ■■ | ■■ | ■ | | | | | |
| **1 Discovery & design** | ■■ | ■ | | | | | | | | |
| **2 Core savings build-out** | | ■ | ■■ | ■■ | ■■ | | | | | |
| **3 Hardening & UAT** | | | | | ■ | ■■ | | | | |
| **4 Pilot (savings)** | | | | | | | ■■ | | | |
| **5 Digital lending** | | | | | | | ■ | ■■ | ■■ | |
| **6 Lending go-live & hypercare** | | | | | | | | | | ■■ |

# 3. Phases and deliverables

## Phase 0 — Regulatory, policy and banking (weeks 1–9, cooperative-led)

| Activity | Owner | Deliverable |
|---|---|---|
| Confirm cooperative registration, by-laws allow digital membership and savings from members | Board + counsel | Legal opinion |
| Confirm lending licence scope; FCCPC registration/approval under the DEON Consumer Lending Regulations 2025 before digital loans launch | Counsel | Registration filed / approval |
| Approve savings, withdrawal, lending, provisioning, liquidity, investment and complaints policies | Board | Signed policy pack (rates, limits, SLAs) |
| Select payment partner; open collections and payouts accounts; sign DVA + transfers agreement; written confirmation the setup fits the licence | Finance | Live + test API keys |
| Select KYC provider; sign data processing agreement | Ops | Sandbox + live keys |
| NDPA 2023: privacy notice, DPIA, DPO, vendor DPAs | DPO | Compliance file |
| Terms of membership, loan agreement, key facts statement | Counsel | Approved documents (loaded into the app) |

## Phase 1 — Discovery and design (weeks 1–3)

- Workshops: confirm requirements in the PRD, staff roles, approval limits, report formats.
- Brand finalisation (logo, colours, tone) and content for public pages.
- Design review of all screens on real mid-range Android devices.
- **Deliverables:** signed-off PRD, clickable prototype (the running staging site), content deck, UAT plan.

## Phase 2 — Core savings build-out (weeks 3–10)

The starter already implements registration, KYC, wallet, deposits, withdrawals, interest, admin queues and reports. Remaining work:

| Workstream | Tasks |
|---|---|
| Integrations | Paystack live DVA + transfers in staging; Dojah live BVN; settlement-report reconciliation job + resolution UI |
| Security | Staff TOTP MFA; rate limiting (Upstash); CSP; session device list; payout-account change workflow with cooling-off |
| Notifications | SMS (Termii) + email (Resend) via post-commit queue; templates |
| Statements | PDF statement; monthly e-statement email |
| Admin | Policy editor with maker-checker; staff management; CSV/XLSX exports; board pack |
| Quality | Integration tests on a Postgres service container; Playwright end-to-end suite on mobile viewport; load test |
| **Deliverables** | Staging environment with live sandbox integrations; test reports; admin user guide |

## Phase 3 — Hardening and UAT (weeks 9–12)

- Financial UAT: 100 test wallets, interest independently recomputed in a spreadsheet, every posting traced to the ledger, trial balance ₦0.
- Concurrency tests: parallel withdrawals, webhook replays, job re-runs.
- External penetration test; fix all high/critical findings.
- Disaster-recovery drill: restore production snapshot to a branch, verify trial balance.
- Staff training (KYC, finance, admin) and runbooks.
- **Deliverables:** UAT sign-off, pen-test report and remediation evidence, DR drill record, runbooks.

## Phase 4 — Savings pilot (weeks 13–14)

- Closed pilot with 50–200 members (staff, board, friendly members), real money with low limits (e.g. ₦200,000 balance cap, ₦50,000 daily withdrawal cap).
- Daily reconciliation review with finance; weekly steering meeting.
- **Go/no-go criteria:** zero unexplained variances for 10 consecutive business days; all withdrawals within SLA; no Sev-1 incidents.

## Phase 5 — Digital lending (weeks 13–18)

Lending code is present; this phase activates it safely.

| Task | Notes |
|---|---|
| Configure approved loan products, rates, fees, limits | From the board-approved lending policy |
| Loan agreement + key facts statement in the offer screen | Counsel-approved text |
| Credit policy rules tuning (affordability %, savings multiple, membership age) | Policy-driven settings |
| Disbursement through live transfers; failure reversal tested | Finance sign-off |
| Arrears process: reminders (SMS), collections scripts compliant with FCCPC rules | No contact-list access, no shaming |
| Provisioning: loss provision postings by ageing bucket (month-end) | Finance |
| FCCPC approval in hand | **Hard gate** |
| Lending UAT and pilot with capped amounts | 20–50 loans |

## Phase 6 — Lending go-live and hypercare (weeks 19–20)

- Gradual limits increase; daily PAR and liquidity monitoring.
- 30-day hypercare: priority support, daily stand-up, weekly report to management.

# 4. Team

| Role | FTE (build) | Responsibility |
|---|---|---|
| Product / delivery lead | 0.5 | Scope, priorities, stakeholder alignment, UAT |
| Senior full-stack engineer (Next.js/TypeScript) | 1.0 | Architecture, ledger, integrations, code review |
| Full-stack engineer | 1.0 | Features, admin portal, tests |
| UI/UX designer | 0.5 (weeks 1–6) | Design system, prototypes, usability tests |
| QA engineer | 0.5 | Test plans, automation, financial UAT support |
| DevOps / security (part-time) | 0.2 | Environments, monitoring, secrets, pen-test liaison |
| **Cooperative side** | — | Product owner, finance lead, KYC lead, counsel, DPO |

# 5. Governance

- **Weekly:** demo of working software on staging; risk and decision log reviewed.
- **Fortnightly:** steering committee (cooperative management + delivery lead).
- **Change control:** any change to money logic requires a written change request, test evidence, and finance sign-off.
- **Definition of done:** code reviewed, tests passing in CI, deployed to staging, acceptance criteria demonstrated, docs updated.

# 6. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Regulatory approval delayed (FCCPC / licence scope) | Medium | High | Start Phase 0 on day 1; launch savings first; lending behind feature gate |
| Payment partner onboarding slow | Medium | High | Shortlist two partners (Paystack, Monnify); adapter allows switching |
| Members misunderstand “wallet” as a bank account | Medium | Medium | Clear copy: members-only, no transfers, not NDIC-insured |
| Liquidity shortfall for withdrawals | Low | High | Liquidity cover KPI + alert; withdrawal SLA; investment policy limits |
| Loan defaults above plan | Medium | High | Conservative limits (3× savings, 40% affordability); auto-debit; provisioning |
| Fraud (identity, account takeover) | Medium | High | BVN match + duplicate hash; own-account payouts only; MFA; cooling-off on payout changes |
| Data breach | Low | High | Field encryption, least privilege, audit, pen test, NDPA processes |
| Key-person dependency | Medium | Medium | Documentation, runbooks, code in client-owned GitHub |

# 7. Go-live checklist

- [ ] Legal opinion and FCCPC registration status documented
- [ ] Board-approved policies loaded (rates, limits, products) — placeholder seed values replaced
- [ ] Live payment and KYC keys in Netlify env vars; webhook URLs registered and tested
- [ ] `DEMO_MODE=false`, `KYC_AUTO_APPROVE` set per policy, strong `FIELD_ENCRYPTION_KEY`, `IDENTITY_HASH_SECRET`, `CRON_SECRET`
- [ ] Seed staff passwords changed; MFA enforced; leavers removed
- [ ] Scheduled function running; last accrual visible on Operations page
- [ ] Monitoring and alerts live (trial balance, job health, payout failures, uptime)
- [ ] Backups + PITR confirmed; restore drill passed
- [ ] Pen-test high/critical findings closed
- [ ] Support channels staffed; complaint process published
- [ ] Privacy notice, terms, loan agreement published

# 8. Post-launch roadmap

| Quarter | Items |
|---|---|
| Q+1 | Savings goals, PWA install prompt, referral programme, WhatsApp notifications |
| Q+2 | Fixed-term deposits, guarantor loans, credit bureau, bank-statement analysis |
| Q+3 | React Native app (iOS/Android) reusing the API, USSD for feature phones |
| Q+4 | BI dashboards (Metabase), automated regulator returns, optional .NET reconciliation worker |
