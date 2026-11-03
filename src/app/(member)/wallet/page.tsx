import { randomUUID } from "crypto";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemo, POLICY } from "@/lib/policy";
import { redirect } from "next/navigation";
import { Badge, Empty, Flash, fmtDateTime, Money, pct } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { simulateDepositAction, withdrawAction } from "../../_actions";
import { currentPolicy } from "@/services/interest";

export const metadata = { title: "Savings wallet" };

export default async function Wallet({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const member = (await currentUser())!.member!;
  if (member.kycStatus !== "APPROVED") redirect("/kyc");
  const [wallet, va, bank, pendingWds, policy] = await Promise.all([
    db.wallet.findUniqueOrThrow({ where: { memberId: member.id } }),
    db.virtualAccount.findUnique({ where: { memberId: member.id } }),
    db.bankAccount.findUnique({ where: { memberId: member.id } }),
    db.withdrawal.findMany({ where: { memberId: member.id }, orderBy: { requestedAt: "desc" }, take: 5 }),
    currentPolicy(),
  ]);
  const available = wallet.balanceKobo - wallet.heldKobo;

  return (
    <div className="space-y-5">
      <Flash searchParams={searchParams} />
      <h1 className="text-2xl font-bold">Savings wallet</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total savings", wallet.balanceKobo],
          ["Available", available],
          ["Total deposits", wallet.totalDepositsKobo],
          ["Total withdrawals", wallet.totalWithdrawalsKobo],
        ].map(([l, v]) => (
          <div key={l as string} className="card"><p className="text-sm text-ink-muted">{l as string}</p><p className="mt-1 text-xl font-bold"><Money kobo={v as bigint} /></p></div>
        ))}
      </div>
      <p className="text-sm text-ink-muted">Interest: {policy ? `${pct(policy.annualRateBps)} a year, accrued daily, credited monthly` : "not yet configured"}. Earned to date <Money kobo={wallet.interestEarnedKobo} className="font-semibold text-ink" />.</p>

      <div className="grid gap-5 md:grid-cols-2">
        <section id="deposit" className="card">
          <h2 className="font-semibold">Deposit</h2>
          <p className="mt-1 text-sm text-ink-soft">Transfer any amount from your bank app to your personal account below. It reflects as soon as the payment is confirmed.</p>
          {va && (
            <dl className="mt-4 space-y-2 rounded-xl bg-brand-50 p-4 ring-1 ring-brand/15">
              <div className="flex justify-between text-sm"><dt className="text-ink-muted">Bank</dt><dd className="font-semibold">{va.bankName}</dd></div>
              <div className="flex justify-between text-sm"><dt className="text-ink-muted">Account number</dt><dd className="font-mono text-lg font-bold tracking-wider">{va.accountNumber}</dd></div>
              <div className="flex justify-between text-sm"><dt className="text-ink-muted">Account name</dt><dd className="text-right font-semibold">{va.accountName}</dd></div>
            </dl>
          )}
          {isDemo() && (
            <form action={simulateDepositAction} className="mt-4 flex gap-2 rounded-xl border border-dashed border-spark p-3">
              <input name="amount" inputMode="decimal" placeholder="Sandbox amount (₦)" required className="input" />
              <SubmitButton className="btn btn-ghost whitespace-nowrap">Simulate</SubmitButton>
            </form>
          )}
        </section>

        <section id="withdraw" className="card">
          <h2 className="font-semibold">Withdraw</h2>
          <p className="mt-1 text-sm text-ink-soft">Paid to your own account {bank ? <strong>{bank.bankName} ••{bank.accountNumber.slice(-4)}</strong> : null} {POLICY.withdrawalSla}.</p>
          <form action={withdrawAction} className="mt-4 space-y-3">
            <input type="hidden" name="idem" value={randomUUID()} />
            <div>
              <label className="label" htmlFor="amount">Amount (₦)</label>
              <input id="amount" name="amount" inputMode="decimal" required className="input" placeholder="e.g. 5000" />
              <p className="hint">Available: <Money kobo={available} /></p>
            </div>
            <SubmitButton className="btn btn-primary w-full" confirm="Request this withdrawal to your bank account?">Request withdrawal</SubmitButton>
          </form>
        </section>
      </div>

      <section className="card">
        <h2 className="font-semibold">Withdrawal requests</h2>
        {pendingWds.length === 0 ? <div className="mt-3"><Empty title="No withdrawals yet" /></div> : (
          <table className="table mt-2">
            <thead><tr><th>Requested</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{pendingWds.map((w) => <tr key={w.id}><td>{fmtDateTime(w.requestedAt)}</td><td className="font-semibold"><Money kobo={w.amountKobo} /></td><td><Badge status={w.status} />{w.failureReason && <p className="text-xs text-ink-muted">{w.failureReason}</p>}</td></tr>)}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
