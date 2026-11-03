---
title: Application Flow
subtitle: Prompt Funds — screen map, user journeys and money flows
doc: App Flow
version: "1.0"
---

# 1. Screen map

```mermaid
flowchart LR
  subgraph Public
    H[Home] --> S[Savings]
    H --> L[Loans + calculator]
    H --> A[About]
    H --> F[FAQ]
    H --> R[Register]
    H --> LI[Log in]
  end
  R --> K[Verify identity / KYC]
  LI -->|member| D[Dashboard]
  LI -->|staff| AD[Admin overview]
  K -->|approved| D
  subgraph Member portal
    D --> W[Savings wallet: deposit + withdraw]
    D --> T[Transactions + statement]
    D --> LN[Loans]
    LN --> AP[Apply]
    LN --> LD[Loan detail: offer, schedule, repay]
    D --> P[Profile]
  end
  subgraph Admin portal
    AD --> M[Members & KYC]
    AD --> WQ[Withdrawal queue]
    AD --> LQ[Loan pipeline] --> LQD[Loan decision]
    AD --> RP[Reports]
    AD --> OP[Operations / jobs]
    AD --> AU[Audit trail]
  end
```

The member portal uses a **bottom navigation bar** on phones (Home · Savings · Loans · History · Profile) and a top tab bar on larger screens. Until identity is approved, members only see the verification screen.

# 2. Journey 1 — Join and verify

```mermaid
sequenceDiagram
  actor M as Member
  participant App as Prompt Funds
  participant KYC as Identity provider (Dojah)
  participant PSP as Payment partner (Paystack)
  actor O as KYC officer
  M->>App: Register (name, email, phone, password, consent)
  App-->>M: Account created, signed in → Verify identity
  M->>App: DOB, address, BVN, (NIN), payout bank + account no.
  App->>KYC: BVN + name + DOB
  KYC-->>App: Match score
  App->>PSP: Resolve account name
  PSP-->>App: Account name
  App->>App: Encrypt BVN, check duplicate hash, name match
  alt Matched
    App-->>M: "Details matched — awaiting approval"
    O->>App: Approve (or auto-approve by policy)
    App->>PSP: Create customer + dedicated account
    App->>App: Membership no. PF-YYYY-NNNNNN, ledger account, wallet
    App-->>M: Welcome + deposit account number
  else Not matched
    App-->>M: Reason shown, officer reviews or member resubmits
  end
```

**Rules:** free at every step; one membership per BVN; must be 18+; payout account must be in the member’s own name.

# 3. Journey 2 — Deposit

```mermaid
sequenceDiagram
  actor M as Member
  participant Bank as Member's bank app
  participant PSP as Paystack
  participant App as Prompt Funds
  participant DB as Ledger (PostgreSQL)
  M->>Bank: Transfer ₦X to own Prompt Funds account no.
  Bank->>PSP: NIP transfer to dedicated account
  PSP->>App: Webhook charge.success (signed)
  App->>App: Verify HMAC-SHA512 signature
  App->>PSP: GET /transaction/verify/{ref}
  PSP-->>App: success, amount
  App->>DB: One transaction: deposit row (unique ref), entry Dr Bank-Collections / Cr Member, wallet += X, notification
  App-->>PSP: 200 OK (replays are no-ops)
  M->>App: Opens dashboard → new balance
```

# 4. Journey 3 — Withdraw

```mermaid
stateDiagram-v2
  [*] --> PendingApproval: Member requests (≤ available, no arrears)<br/>Amount held (row lock)
  PendingApproval --> Rejected: Finance rejects<br/>hold released
  PendingApproval --> Processing: Finance approves (maker ≠ checker,<br/>≥ ₦500k needs approver)<br/>payout to own account
  Processing --> Paid: transfer.success<br/>Dr Member / Cr Bank-Payouts
  Processing --> Failed: transfer.failed / reversed<br/>hold released
  Paid --> [*]
  Rejected --> [*]
  Failed --> [*]
```

Target: paid within **1 business day**. The member sees the status on the wallet page and gets a notification at each outcome.

# 5. Journey 4 — Loan

```mermaid
stateDiagram-v2
  [*] --> Submitted: Member applies<br/>(schedule preview, income, expenses)
  Submitted --> UnderAssessment: Loan officer records assessment<br/>(automated checks shown)
  Submitted --> Declined
  UnderAssessment --> Approved: Committee approves<br/>(≠ assessor)
  UnderAssessment --> Declined: with reason
  Approved --> OfferAccepted: Member accepts key facts<br/>+ auto-debit consent
  Approved --> Declined
  OfferAccepted --> Active: Finance disburses net amount<br/>to own account (≠ approver)
  Active --> InArrears: instalment > 3 days overdue
  InArrears --> Active: arrears cleared
  Active --> Closed: all instalments paid
  InArrears --> Closed
  Closed --> [*]
  Declined --> [*]
```

**Repayment:** any time from the loan page (from savings), and automatically each night for due instalments if savings are available. Allocation: oldest instalment first, interest before principal.

# 6. Journey 5 — Interest

```mermaid
flowchart TD
  A[00:30 WAT daily] --> B[For each wallet, 500 at a time]
  B --> C{balance ≥ policy minimum?}
  C -- yes --> D[accrual = balance × rate ÷ 365<br/>stored in micro-kobo<br/>unique per member+day]
  C -- no --> E[skip]
  D --> F[Last day of month]
  F --> G[Sum uncredited accruals → round half-even to kobo]
  G --> H[Ledger: Dr Interest expense / Cr Member savings<br/>wallet.interestEarned += amount<br/>notify member]
```

# 7. Money flow between accounts

```mermaid
flowchart TB
  subgraph Banks["Cooperative bank accounts (via payment partner)"]
    COLL[Collections account]
    PAY[Payouts account]
  end
  MEM((Member's own bank account))
  MEM -- deposit --> COLL
  COLL -- sweep / treasury --> PAY
  PAY -- withdrawal --> MEM
  PAY -- loan disbursement --> MEM
  COLL -- surplus within investment policy --> INV[Permitted investments]
  INV -- returns --> COLL
```

Liquidity rule: the finance team keeps enough in the payouts account to cover pending withdrawals plus expected disbursements; the admin overview shows **liquidity cover** (cash at bank ÷ member savings) and flags it red below 20%.

# 8. Staff daily routine

| Time | Who | Screen | Action |
|---|---|---|---|
| 08:00 | Finance | Overview | Check trial balance = ₦0, liquidity cover, overnight job results |
| 08:15 | Finance | Operations / Reconciliation | Resolve unreconciled deposits from the provider report |
| 09:00 – 16:00 | KYC officer | Members & KYC (queue) | Approve / reject verified applicants |
| 09:00 – 16:00 | Finance | Withdrawals | Approve & pay; escalate ≥ ₦500k to approver |
| 10:00 | Loan officer | Loans → To assess | Assess new applications |
| Weekly / as needed | Committee | Loans → Committee | Approve / decline |
| Daily | Finance | Loans → To disburse | Disburse accepted offers |
| Weekly | Collections | Loans → Arrears | Member outreach (respectful, member only) |
| Month-end | Finance / Auditor | Reports | Trial balance, income vs expense, PAR ageing, board pack |

# 9. Error and edge states

| Situation | What the member sees | What the system does |
|---|---|---|
| Deposit to an unknown account number | Nothing (not their account) | Parked in reconciliation for staff |
| Webhook delivered twice | One deposit | Unique provider reference → no-op |
| Two withdrawals tapped at once | One request | Idempotency key + wallet row lock |
| Withdrawal while in arrears | “Please clear your overdue repayment first” | Request refused |
| Payout fails at the bank | “Withdrawal not completed — money is back in your available balance” | Hold released, audit + notification |
| BVN already used | “This BVN is already linked to another membership” | Rejected before any record is changed |
| Payout account name mismatch | “An officer will contact you” | KYC stays in manual review |
| Loan disbursement transfer fails | Offer remains accepted | Reversal entry; instalments removed; finance retries |
| Session expired | Sent to log in | Server-side session check on every page |
