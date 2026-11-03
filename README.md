# Prompt Funds

Mobile-first **member savings wallet + digital lending** platform for cooperatives. Members join free, verify with BVN, save any amount into a personal deposit account, earn daily-accrued interest, withdraw to their own bank account, and apply for, accept and repay loans — without visiting an office.

> **Licence boundary.** The operator is licensed to lend, not to provide payment/transfer services. There are **no** member-to-member, third-party or inter-bank transfer features. Withdrawals and loan disbursements go **only** to the member's own, name-verified bank account. Confirm legal/regulatory arrangements (cooperative registration, lending licence, FCCPC digital-lending registration, NDPA 2023) before accepting savings or lending.

## What's inside

| Area | Features |
|---|---|
| Public site | Home, Savings, Loans (live calculator), About, FAQ, Register, Log in |
| Member portal | KYC (BVN + own-account name check), dashboard, savings wallet, deposit account, withdrawals, history + CSV statement, loans (apply → offer → repay), profile, notifications |
| Savings engine | Double-entry ledger, signed + re-verified deposit webhooks (idempotent), maker-checker withdrawals, daily interest accrual + month-end credit |
| Lending engine | Products (reducing/flat), automated credit checks, officer assessment → committee approval (different people) → member acceptance → finance disbursement, schedules, repay from savings, nightly auto-debit, arrears |
| Admin portal | KPIs (liquidity cover, PAR, trial balance), member search + KYC queue, withdrawal queue, loan pipeline, reports (trial balance, income/expense, ageing), operations (jobs), hash-chained audit trail |
| Docs | `docs/` — pitch deck, cost & support proposal, PRD, TRD, app flow, UI/UX brief, backend schema, implementation plan (Markdown + PDF) |

## Stack

Next.js 14 (App Router, React Server Components, server actions) · TypeScript · Tailwind · PostgreSQL 16 · **Prisma 7 (Rust-free client + `pg` adapter — no native binaries, ideal for Netlify Functions)** · Zod · scrypt · AES-256-GCM field encryption · Vitest · Netlify (or Docker).

## Deploy to Netlify (recommended)

1. **Database:** easiest is Netlify DB (Site → Extensions → Neon) which sets `NETLIFY_DATABASE_URL` / `NETLIFY_DATABASE_URL_UNPOOLED` automatically — the app reads those. Or create Postgres on [Neon](https://neon.tech) yourself and set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct).
2. **Import the repo** in Netlify → *Add new site → Import from Git → GitHub → PromptFunds*. `netlify.toml` already sets the build command (`npm run netlify:build` = generate → migrate → seed → build) and the Next.js runtime.
3. **Environment variables** (Site settings → Environment variables):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled URL (`...-pooler...?sslmode=require`) |
   | `DIRECT_URL` | Neon direct URL |
   | `FIELD_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `IDENTITY_HASH_SECRET` | any long random string |
   | `CRON_SECRET` | any long random string |
   | `SEED_ADMIN_PASSWORD` | initial password for staff accounts |
   | `DEMO_MODE` | `true` for a sandbox demo (sandbox deposits + demo logins), `false` for real money |
   | `PAYMENT_PROVIDER` / `PAYSTACK_SECRET_KEY` | `mock` for demo, `paystack` + key for live |
   | `KYC_PROVIDER` / `DOJAH_APP_ID` / `DOJAH_SECRET_KEY` | `mock` for demo, `dojah` + keys for live |
   | `KYC_AUTO_APPROVE` | `true` to approve automatically on a full BVN match |

4. **Deploy.** The nightly scheduled function (`netlify/functions/cron.mts`) runs interest accrual, auto-debit/arrears and month-end interest credit.
5. **Live payments:** set the Paystack webhook URL to `https://<your-site>/api/webhooks/paystack`.

**Demo logins** (when `DEMO_MODE=true`; password = `SEED_ADMIN_PASSWORD`, default `ChangeMe-Now-12345`): member `ada@promptfunds.demo`; staff `admin@`, `kyc@`, `loans@`, `committee@`, `finance@`, `approver@`, `auditor@promptfunds.local`. **Change all passwords and set `DEMO_MODE=false` before handling real money.**

## Run locally

```bash
cp .env.example .env            # set DATABASE_URL / DIRECT_URL, DEMO_MODE=true
docker compose up -d db         # or any local Postgres 16
npm install                     # runs prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev                     # http://localhost:3000
npm test                        # unit tests
```

Jobs from the CLI: `npm run job:accrue`, `npm run job:arrears`, `npm run job:credit` (also on Admin → Operations).

Test a signed deposit webhook (mock provider):

```bash
BODY='{"event":"deposit.confirmed","reference":"TEST-0001","accountNumber":"<member deposit acct>","amountKobo":"500000"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$PAYMENT_WEBHOOK_SECRET" | awk '{print $2}')
curl -X POST localhost:3000/api/webhooks/payments -H "x-signature: $SIG" -d "$BODY"   # replay = no-op
```

## Project layout

```
prisma/schema.prisma, migrations/, seed.ts   data model, SQL migrations (incl. ledger triggers), idempotent seed
src/app/(public) (member) admin api _actions  pages, API routes, server actions
src/services/                                members, deposits, withdrawals, interest, loans, notify
src/lib/                                     ledger, money, interest, amortisation, password, crypto, audit, auth, policy, providers/
netlify.toml, netlify/functions/cron.mts     Netlify build + scheduled jobs
docs/                                        8 project documents (Markdown + PDF)
```

## Verified

- `tsc` clean, 14 unit tests (money, interest, schedules, due dates, crypto, passwords).
- Browser end-to-end run: register → KYC → officer approval → sandbox + signed-webhook deposits (replay ignored, bad signature rejected) → parallel withdrawals (no overdraw) → finance approval → loan apply → assess → committee approve → accept → disburse → repay → accrual/arrears/credit jobs → CSV statement. Trial balance ₦0.00; wallets match ledger; ledger UPDATE blocked by trigger.
- Arrears path: auto-debit, overdue flag, withdrawal block while in arrears, recovery after top-up; self-approval and wrong-role approval refused.

## Before go-live (see docs/08)

Staff TOTP MFA · rate limiting (Upstash) · CSP header · SMS/email delivery (Termii/Resend) · settlement-file reconciliation UI · payout-account change workflow · penetration test · replace placeholder rates with board-approved policy.
