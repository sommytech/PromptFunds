import Link from "next/link";
import { db } from "@/lib/db";
import { ACCOUNTS, trialBalanceVariance } from "@/lib/ledger";
import { Money, Stat } from "@/components/ui";

async function accountBalance(code: string) {
  const s = await db.ledgerLine.aggregate({ where: { account: { code } }, _sum: { debit: true, credit: true } });
  return (s._sum.debit ?? 0n) - (s._sum.credit ?? 0n); // debit-normal (assets)
}

export default async function AdminHome() {
  const [members, kycQueue, wd, savings, loansRec, collections, payouts, variance, active, arrears, appQueue, pending] = await Promise.all([
    db.member.count({ where: { kycStatus: "APPROVED" } }),
    db.member.count({ where: { kycStatus: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
    db.withdrawal.aggregate({ where: { status: "PENDING_APPROVAL" }, _count: true, _sum: { amountKobo: true } }),
    db.wallet.aggregate({ _sum: { balanceKobo: true, heldKobo: true } }),
    accountBalance(ACCOUNTS.LOANS_RECEIVABLE),
    accountBalance(ACCOUNTS.BANK_COLLECTIONS),
    accountBalance(ACCOUNTS.BANK_PAYOUTS),
    trialBalanceVariance(),
    db.loan.aggregate({ where: { status: { in: ["ACTIVE", "DISBURSED", "IN_ARREARS"] } }, _count: true, _sum: { outstandingPrincipalKobo: true } }),
    db.loan.aggregate({ where: { status: "IN_ARREARS" }, _count: true, _sum: { outstandingPrincipalKobo: true } }),
    db.loan.count({ where: { status: { in: ["SUBMITTED", "UNDER_ASSESSMENT", "OFFER_ACCEPTED"] } } }),
    db.transaction.count({ where: { status: "PENDING" } }),
  ]);
  const liabilities = savings._sum.balanceKobo ?? 0n;
  const cash = collections + payouts; // bank accounts net
  const liquidityBps = liabilities > 0n ? Number((cash * 10_000n) / liabilities) : 10_000;
  const parBps = (active._sum.outstandingPrincipalKobo ?? 0n) > 0n ? Number(((arrears._sum.outstandingPrincipalKobo ?? 0n) * 10_000n) / (active._sum.outstandingPrincipalKobo ?? 1n)) : 0;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Overview</h1><p className="text-sm text-ink-muted">All figures come from the double-entry ledger.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active members" value={members} sub={<Link className="text-brand" href="/admin/members?status=queue">{kycQueue} awaiting KYC →</Link>} />
        <Stat label="Member savings (liability)" value={<Money kobo={liabilities} />} sub={<>Held for withdrawals <Money kobo={savings._sum.heldKobo ?? 0n} /></>} />
        <Stat label="Cash at bank (ledger)" value={<Money kobo={cash} />} sub={`Liquidity cover ${(liquidityBps / 100).toFixed(1)}% of savings`} warn={liquidityBps < 2000} />
        <Stat label="Loans receivable" value={<Money kobo={loansRec} />} sub={`${active._count} active loans`} />
        <Stat label="Withdrawals awaiting approval" value={wd._count} sub={<Link className="text-brand" href="/admin/withdrawals"><Money kobo={wd._sum.amountKobo ?? 0n} /> →</Link>} />
        <Stat label="Loan pipeline" value={appQueue} sub={<Link className="text-brand" href="/admin/loans">Review applications →</Link>} />
        <Stat label="Portfolio at risk" value={`${(parBps / 100).toFixed(1)}%`} sub={`${arrears._count} loans in arrears`} warn={parBps > 500} />
        <Stat label="Trial balance variance" value={<Money kobo={variance} />} sub={variance === 0n ? "Ledger balanced ✓" : "INVESTIGATE"} warn={variance !== 0n} />
      </div>
      {pending > 0 && <p className="text-sm text-ink-muted">{pending} member transactions pending settlement.</p>}
    </div>
  );
}
