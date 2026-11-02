[README.md](https://github.com/user-attachments/files/34295360/README.md)
# Infinite Cooperative Platform

Mobile-first savings and lending platform for a cooperative: free registration, KYC, ledger-backed savings wallet, deposits, admin-approved withdrawals, daily interest, and (Phase 2) loans.

> **Compliance note:** the cooperative's licence covers lending, not transaction services. This codebase deliberately has **no** member-to-member or third-party transfers; payouts go only to the member's verified own bank account. Get written legal/regulatory confirmation before accepting savings or paying withdrawals.

## Stack
Next.js 14 (App Router) · React · TypeScript · Tailwind · PostgreSQL · Prisma · Zod · argon2 · Vitest · Docker

## Quick start
```bash
cp .env.example .env            # set SESSION_SECRET and PAYMENT_WEBHOOK_SECRET
docker compose up -d db
npm install
npx prisma migrate dev --name init   # or: npx prisma db push
psql "$DATABASE_URL" -f prisma/sql/ledger_constraints.sql
psql "$DATABASE_URL" -f prisma/sql/search_indexes.sql
npm run db:seed
npm run dev                     # http://localhost:3000
npm test
```
Full containerised run: `docker compose up --build` (then run migrations and the SQL files against the db).

## Deposit webhook (local test)
```bash
BODY='{"event":"deposit.confirmed","reference":"TEST-0001","accountNumber":"<member virtual acct>","amountKobo":"500000"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$PAYMENT_WEBHOOK_SECRET" | awk '{print $2}')
curl -X POST localhost:3000/api/webhooks/payments -H "x-signature: $SIG" -d "$BODY"
```
Replaying the same `reference` is a no-op (idempotent).

## Interest jobs
```bash
npm run job:interest            # daily accrual (schedule at 00:30)
npx tsx src/jobs/interest.ts credit   # month-end credit
```

## Layout
- `docs/` — pitch deck, cost proposal, PRD, TRD, app flow, UI/UX brief, backend schema, implementation plan
- `prisma/schema.prisma` — data model; `prisma/sql/` — ledger triggers, search indexes
- `src/lib/` — money, ledger, interest, amortisation, auth, audit, payment adapter
- `src/services/` — members/KYC, deposits, withdrawals
- `src/app/` — pages and API routes

## Status: starter, not production-ready
Implemented: registration, sessions, KYC approval flow, ledger, deposits via webhook, withdrawal request/approval with maker-checker and payout adapter, interest accrual/credit, loan schedule maths, member dashboard, admin overview.
Still to build before launch: KYC document upload and provider integration, OTP delivery, MFA for staff, loan application/approval/repayment endpoints and UI, reconciliation job, statements/exports, notifications, rate limiting, real payment provider adapter, security review and penetration test.

## Deploy
Any container host (Render, Fly.io, Railway, AWS ECS, Azure Container Apps) with managed PostgreSQL. Set env vars from `.env.example`, run `npx prisma migrate deploy`, apply `prisma/sql/*.sql`, seed, and point the payment provider webhook to `/api/webhooks/payments`. Use `/api/health` for health checks.
