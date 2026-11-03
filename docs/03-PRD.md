---
title: Product Requirements Document
subtitle: Prompt Funds — member savings wallet and lending platform
doc: PRD
version: "1.0"
---

# 1. Purpose and scope

This document defines **what** Prompt Funds must do for members, staff and the cooperative’s management. It is the reference for design, build, testing and acceptance. The Technical Requirements Document (TRD) defines **how**.

**Product in one sentence.** A mobile-first web platform on which anyone can join a cooperative for free, verify their identity online, save any amount into a personal wallet that earns interest, withdraw to their own bank account, and apply for and repay loans — without visiting an office.

**Guiding principle.** A member must be able to register for free, deposit money, see the updated balance, withdraw eligible savings and apply for a loan entirely online. Every balance a member sees must be supported by the cooperative’s reconciled accounting records.

## 1.1 Licence boundary (non-negotiable)

The operator is licensed to **lend**, not to provide payment or transfer services. The product therefore:

| Allowed | Not allowed (must not be built or exposed) |
|---|---|
| Members deposit into their **own** wallet via a dedicated account number or approved channel | Member-to-member transfers, “send money”, P2P |
| Withdrawals paid **only** to the member’s own, name-verified bank account | Payouts to third-party accounts or arbitrary account numbers |
| Loan disbursement to the member’s own verified account | Bill payments, airtime, merchant payments, cards |
| Loan repayment from the member’s own savings or deposits | Inter-bank transfer features of any kind |

The payout account can only be changed through a staff-verified process (see §6.4). This is enforced in code: the payment adapter has no generic “transfer to account” function.

## 1.2 Out of scope for launch

Native Android/iOS apps (the responsive web app is installable on phones); group/ajo savings; fixed-term deposits; guarantor workflows; credit bureau integration; USSD channel; investment products. These are scheduled in the roadmap (§10).

# 2. Users and roles

| Role | Who | Primary goals |
|---|---|---|
| **Prospective member** | Public visitor | Understand products and rates; join quickly and free |
| **Member** | Verified individual | Save, see balances and interest, withdraw, borrow, repay, download statements |
| **KYC officer** | Staff | Review identity results; approve or reject memberships |
| **Loan officer** | Staff | Assess applications and repayment capacity; recommend |
| **Loan committee** | Staff / board delegates | Approve or decline loans (must differ from assessor) |
| **Finance officer** | Staff | Approve withdrawals, disburse loans, reconcile |
| **Finance approver** | Senior staff | Second approval for large withdrawals (≥ ₦500,000 by default) |
| **Administrator** | Operations lead | Configure products/policies, run jobs, manage staff |
| **Auditor** | Internal/external | Read-only access to ledger, reports and audit trail |

## 2.1 Personas

- **Amaka, 34, trader in Onitsha.** Saves irregularly from daily sales; wants a safe place that pays something and a quick loan to restock. Uses an Android phone on 3G; distrusts hidden charges.
- **Tunde, 27, salaried in Lagos.** Wants a disciplined savings habit with interest and an emergency loan option without payday-lender abuse.
- **Mrs. Bello, finance officer.** Needs a clear daily queue of withdrawals and disbursements, confidence that the books balance, and an audit trail for examiners.

# 3. Success metrics

| Metric | Target (first 6 months) |
|---|---|
| Registration → verified member conversion | ≥ 60% |
| Time to complete registration + KYC | Median < 5 minutes |
| Deposits reflected after provider confirmation | 95% within 2 minutes |
| Withdrawals paid within SLA (1 business day) | ≥ 98% |
| Loan decision time (submission → decision) | Median ≤ 2 business days |
| Ledger trial balance variance | **Always ₦0.00** |
| Unreconciled items older than 2 days | 0 |
| Portfolio at risk > 30 days (PAR30) | < 5% |
| Mobile Lighthouse performance score | ≥ 85 on mid-range Android |

# 4. Module overview

| Module | Launch (MVP) | Later phases |
|---|---|---|
| **A. Public website** | Home, About, Savings, Loans (with calculator), FAQ, Register, Log in | Blog, testimonials, multilingual (Yoruba, Hausa, Igbo, Pidgin) |
| **B. Member portal** | Registration, KYC, dashboard, wallet, history, statements, profile, notifications | Push notifications, savings goals, PWA offline mode |
| **C. Savings management** | Dedicated deposit accounts, webhook crediting, withdrawals with maker-checker, daily interest accrual + monthly credit, reconciliation | Fixed deposits, target savings, auto-save |
| **D. Loan management** | Products, online application, automated checks, assessment, committee approval, offer acceptance, disbursement, schedules, repayment from savings, auto-debit, arrears | Guarantors, credit bureau, partial prepayment rebates, restructuring, write-off workflow |
| **E. Administration** | Member search & KYC queue, withdrawal queue, loan pipeline, overview KPIs (liquidity, PAR), trial balance, portfolio ageing, audit trail, job runner | Configurable policies UI with maker-checker, regulator report packs, BI dashboards |

# 5. Functional requirements — Public website (A)

| ID | Requirement | Priority |
|---|---|---|
| A-1 | Home page explains the offer, the four-step journey, and shows the current savings rate and loan products **read live from the database** | Must |
| A-2 | Loan calculator: choose product, amount, tenor; shows monthly instalment, total interest, processing fee, total repayable and full schedule | Must |
| A-3 | Savings page discloses rate, accrual method, withdrawal SLA, and that savings are **not NDIC-insured** | Must |
| A-4 | Footer states that the service is for members only and offers no transfers to third parties | Must |
| A-5 | FAQ covers fees, deposits, interest, withdrawals, loans, missed payments, data protection | Must |
| A-6 | Pages are server-rendered with metadata for search engines; product pages revalidate every 5 minutes | Should |

# 6. Functional requirements — Member portal (B)

## 6.1 Registration

| ID | Requirement | Priority |
|---|---|---|
| B-1 | Register with first name, last name (as on BVN), email, phone, password (≥ 10 chars), and consent to terms/privacy | Must |
| B-2 | **No fee and no deposit** at any point of registration | Must |
| B-3 | Duplicate email/phone rejected with a clear message | Must |
| B-4 | Phone numbers normalised to 234XXXXXXXXXX | Must |
| B-5 | After registration the member is signed in and taken to identity verification | Must |
| B-6 | Phone OTP verification before KYC | Phase 2 |

## 6.2 Identity verification (KYC)

| ID | Requirement | Priority |
|---|---|---|
| B-10 | Member enters date of birth, address, BVN (11 digits), optional NIN, and payout bank + account number | Must |
| B-11 | BVN checked electronically against the provider (name + DOB match score stored) | Must |
| B-12 | Payout account name resolved via name-enquiry and matched to the member’s name | Must |
| B-13 | BVN stored **encrypted**; a keyed hash prevents the same BVN joining twice | Must |
| B-14 | Members under 18 rejected | Must |
| B-15 | Matched applications go to the KYC queue (or auto-approve when policy allows) | Must |
| B-16 | On approval the system issues a **unique membership number** (`PF-YYYY-NNNNNN`), opens the savings ledger account and wallet, and creates a dedicated deposit account number | Must |
| B-17 | Rejection shows the reason and lets the member resubmit | Must |
| B-18 | Selfie/liveness and document upload | Phase 2 |

## 6.3 Dashboard

The dashboard must show, on one mobile screen where possible:

- Total savings balance, **available** balance, pending (held) amount, interest earned to date, interest accrued this month.
- Quick actions: Deposit, Withdraw, Get a loan.
- Loan summary: outstanding balance, next instalment amount and due date (red when overdue), any pending application/offer.
- Latest notifications and the six most recent transactions with status.

## 6.4 Wallet, history and statements

| ID | Requirement | Priority |
|---|---|---|
| B-30 | Wallet page shows total savings, available, total deposits, total withdrawals, interest rate and interest earned | Must |
| B-31 | Deposit panel shows the member’s dedicated bank, account number and account name | Must |
| B-32 | Withdrawal form shows available balance and the destination account (masked) and SLA | Must |
| B-33 | Withdrawal list with status (pending approval, processing, paid, rejected, failed + reason) | Must |
| B-34 | Transaction history filterable by type, keyset-paginated, newest first | Must |
| B-35 | Statement download (CSV) for any date range; PDF statement | Must / Phase 2 |
| B-36 | Changing payout account requires staff verification and a 24-hour cooling-off before the first payout | Phase 2 |

## 6.5 Notifications

In-app notifications for: verification outcome, deposit received, withdrawal paid/declined/failed, loan received/approved/declined/disbursed, repayment received, overdue, interest credited. SMS and email delivery for the same events in Phase 2 (Termii/Resend).

# 7. Functional requirements — Savings management (C)

## 7.1 Deposits

| ID | Requirement | Priority |
|---|---|---|
| C-1 | Each verified member has a dedicated virtual account (Paystack DVA or equivalent) | Must |
| C-2 | Provider webhook is signature-verified, re-verified against the provider API, and **idempotent** on provider reference | Must |
| C-3 | A confirmed deposit posts a balanced ledger entry (Dr Bank-Collections, Cr Member Savings) and updates the cached wallet in the same database transaction | Must |
| C-4 | Deposits with unknown account numbers are parked for manual reconciliation, never lost | Must |
| C-5 | Daily reconciliation compares provider settlement report to ledger; differences become reconciliation items that must be resolved | Must (job) / Phase 2 (UI) |
| C-6 | Sandbox “simulate deposit” only when `DEMO_MODE=true` | Must |

## 7.2 Withdrawals

| ID | Requirement | Priority |
|---|---|---|
| C-10 | Member requests any amount ≤ available balance; the amount is **held** immediately (row lock prevents double-spend) | Must |
| C-11 | Requests are idempotent (double-tap safe) | Must |
| C-12 | Blocked while the member has a loan in arrears | Must |
| C-13 | Finance officer approves (maker ≠ checker); ≥ ₦500,000 requires Finance Approver | Must |
| C-14 | Payout goes only to the verified own account; on success Dr Member Savings / Cr Bank-Payouts and the hold is released | Must |
| C-15 | On provider failure or reversal the hold is released and the member notified | Must |
| C-16 | Target SLA: paid within 1 business day; queue shows age of each request | Must |

## 7.3 Interest on savings

| ID | Requirement | Priority |
|---|---|---|
| C-20 | Rate, day-count basis, minimum eligible balance and effective date are held in versioned **interest policies** (history never edited) | Must |
| C-21 | Daily accrual on end-of-day balance: `balance × rate ÷ dayCount`, stored in micro-kobo to avoid rounding loss | Must |
| C-22 | Month-end credit: accrued amounts rounded half-to-even to kobo and posted (Dr Interest Expense, Cr Member Savings) | Must |
| C-23 | Jobs are idempotent (unique per member per day) and resumable | Must |
| C-24 | Dashboard shows interest earned and accrued-not-yet-credited | Must |

# 8. Functional requirements — Loan management (D)

## 8.1 Loan lifecycle

`Submitted → Under assessment → Approved (offer) → Offer accepted → Active → Closed`, with branches to **Declined**, **In arrears** and **Written off** (Phase 2).

| ID | Requirement | Priority |
|---|---|---|
| D-1 | Products define min/max amount, min/max tenor, annual rate, method (reducing balance or flat) and processing fee | Must |
| D-2 | Application captures product, amount, tenor, purpose, monthly income and monthly expenses; shows the live schedule before submission | Must |
| D-3 | One open loan or application per member | Must |
| D-4 | Automated checks displayed to the officer: KYC approved, membership age, no other open loan, instalment ≤ 40% of disposable income, amount ≤ 3× savings, savings history | Must |
| D-5 | Loan officer records assessment notes (maker); committee approves (checker) — **the same person cannot do both** | Must |
| D-6 | Decline requires a reason that is shown to the member | Must |
| D-7 | Member must explicitly accept the offer (key facts: amount, fee, rate, instalment, total repayable, schedule, auto-debit consent) | Must |
| D-8 | Finance disburses the net amount (principal − fee) to the verified own account; approver ≠ disburser | Must |
| D-9 | Disbursement posts Dr Loans Receivable (principal) / Cr Bank-Payouts (net) / Cr Fee Income (fee) and generates dated instalments | Must |
| D-10 | Member can repay any amount from available savings; allocation is **oldest instalment first, interest before principal** | Must |
| D-11 | Daily job auto-collects due instalments from available savings, then flags instalments overdue after a 3-day grace period and moves the loan to arrears | Must |
| D-12 | Loan closes automatically when all instalments are paid | Must |
| D-13 | Ethical recovery: no contact-list access, no public shaming, reminders only to the member | Must |
| D-14 | Early settlement quote, restructuring, write-off with provisioning | Phase 2 |
| D-15 | Credit bureau check and bank-statement analysis (e.g. Mono) | Phase 3 |

# 9. Functional requirements — Administration (E)

| ID | Requirement | Priority |
|---|---|---|
| E-1 | Overview KPIs from the ledger: active members, KYC queue, member savings liability, cash at bank, liquidity cover %, loans receivable, loan pipeline, PAR %, trial balance variance (red if ≠ 0) | Must |
| E-2 | Member search by name, phone, email or membership number (trigram index) with KYC actions | Must |
| E-3 | Withdrawal queue with dual-approval flag; approve-and-pay or reject with reason | Must |
| E-4 | Loan pipeline tabs: to assess, committee, to disburse, active book, arrears, closed | Must |
| E-5 | Loan detail: application, automated checks, decision actions per role, schedule, history | Must |
| E-6 | Reports: income vs expense, trial balance (member accounts rolled up), portfolio ageing buckets | Must |
| E-7 | Operations: run accrual / credit / arrears jobs on demand; view current policy | Must |
| E-8 | Audit trail: hash-chained, filterable by entity | Must |
| E-9 | Role-based access on every action; auditor read-only | Must |
| E-10 | Exports (CSV/XLSX) for all reports; regulator/board report pack | Phase 2 |
| E-11 | Staff MFA (TOTP) | Must before go-live |

# 10. Non-functional requirements (summary)

| Area | Requirement |
|---|---|
| Mobile | Designed for 360 px wide screens first; 48 px touch targets; works on 3G; bottom navigation |
| Performance | Dashboard server response < 500 ms p95; first load < 200 KB JS for member pages |
| Availability | 99.5% monthly for member portal; scheduled maintenance announced 48 h ahead |
| Security | OWASP ASVS L2; encryption in transit and at rest; field-level encryption for BVN/NIN; session cookies httpOnly + SameSite |
| Privacy | Nigeria Data Protection Act 2023 compliance; consent capture; data minimisation; DPO named |
| Accuracy | Integer kobo arithmetic only; double-entry ledger; zero trial-balance variance |
| Auditability | Every state change audited with actor, time, before/after |
| Accessibility | WCAG 2.1 AA |

# 11. Roadmap

| Phase | Contents |
|---|---|
| **1 — Savings launch** | Public site, registration, KYC, wallet, deposits, withdrawals, interest, admin, reconciliation |
| **2 — Digital lending** | Loan products, applications, assessment, approval, disbursement, repayments, arrears (code already included; activated after core is stable) |
| **3 — Engagement** | SMS/email/WhatsApp notifications, PDF statements, savings goals, PWA install, referral programme |
| **4 — Scale** | Native apps (React Native) once volume justifies; credit bureau; guarantors; USSD; BI dashboards |

# 12. Regulatory dependencies before go-live

1. Confirm cooperative registration and that savings are taken **from registered members only**.
2. Confirm the lending licence covers digital lending; register with the **FCCPC** under the Digital, Electronic, Online or Non-Traditional Consumer Lending Regulations 2025 before launching digital loans (new entrants must obtain approval before launch).
3. NDPA 2023 compliance: privacy notice, lawful basis, DPIA, data processing agreements with KYC, SMS and payment vendors.
4. Board-approved savings, withdrawal, lending, provisioning, liquidity and investment policies; the rates seeded in the system are placeholders.
5. Written confirmation from the payment partner that the integration (dedicated accounts + own-account payouts) fits the cooperative’s licence.

# 13. Acceptance criteria (launch)

- A new member can register, verify, receive a membership number and deposit account in under 5 minutes on a mid-range Android phone.
- A test deposit via provider sandbox appears on the dashboard within 2 minutes and in the ledger as one balanced entry; replaying the webhook changes nothing.
- A withdrawal cannot exceed the available balance even with two simultaneous requests.
- Accrual and credit jobs produce interest that matches an independent spreadsheet to the kobo for 100 sample wallets.
- Loan schedule principal sums exactly to the amount disbursed; repayments allocate interest before principal.
- The trial balance is ₦0.00 after the full UAT script; every action in the script appears in the audit trail.
- Penetration test finds no high or critical issues outstanding.
