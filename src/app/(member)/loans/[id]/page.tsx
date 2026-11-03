import { randomUUID } from "crypto";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Flash, fmtDate, Money, pct } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { acceptOfferAction, repayAction } from "../../../_actions";
import { scheduleFor } from "@/services/loans";

const koboToInput = (k: bigint) => `${k / 100n}.${String(k % 100n).padStart(2, "0")}`;
const steps = ["SUBMITTED", "UNDER_ASSESSMENT", "APPROVED", "OFFER_ACCEPTED", "ACTIVE", "CLOSED"];
const stepLabel = ["Applied", "Assessment", "Approved", "Accepted", "Disbursed", "Repaid"];

export default async function LoanDetail({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; err?: string } }) {
  const member = (await currentUser())!.member!;
  const loan = await db.loan.findFirst({ where: { id: params.id, memberId: member.id }, include: { product: true, instalments: { orderBy: { number: "asc" } }, repayments: { orderBy: { paidAt: "desc" } } } });
  if (!loan) notFound();
  const wallet = await db.wallet.findUniqueOrThrow({ where: { memberId: member.id } });
  const available = wallet.balanceKobo - wallet.heldKobo;
  const outstanding = loan.instalments.reduce((a, i) => a + i.principalKobo + i.interestKobo - i.paidKobo, 0n);
  const overdue = loan.instalments.filter((i) => i.status === "OVERDUE" || (i.dueDate <= new Date() && i.status !== "PAID")).reduce((a, i) => a + i.principalKobo + i.interestKobo - i.paidKobo, 0n);
  const nextInst = loan.instalments.find((i) => i.status !== "PAID");
  const nextDue = nextInst ? nextInst.principalKobo + nextInst.interestKobo - nextInst.paidKobo : loan.instalmentKobo;
  const preview = loan.instalments.length ? null : scheduleFor({ principalKobo: loan.principalKobo, annualRateBps: loan.annualRateBps, tenorMonths: loan.tenorMonths, method: loan.method });
  const stepIdx = loan.status === "IN_ARREARS" || loan.status === "DISBURSED" ? 4 : steps.indexOf(loan.status);

  return (
    <div className="space-y-5">
      <Flash searchParams={searchParams} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-bold">{loan.product.name}</h1><p className="text-sm text-ink-muted">{loan.reference}</p></div>
        <Badge status={loan.status} label={loan.status === "APPROVED" ? "Offer ready" : undefined} />
      </div>

      {!["DECLINED", "WRITTEN_OFF"].includes(loan.status) && (
        <ol className="grid grid-cols-6 gap-1 text-center text-[11px] font-medium">
          {stepLabel.map((s, i) => (
            <li key={s}><div className={`mb-1 h-1.5 rounded-full ${i <= stepIdx ? "bg-brand" : "bg-slate-200"}`} /><span className={i <= stepIdx ? "text-brand-dark" : "text-ink-muted"}>{s}</span></li>
          ))}
        </ol>
      )}
      {loan.status === "DECLINED" && <p className="rounded-xl bg-danger-light p-4 text-sm text-danger">Not approved: {loan.declineReason}</p>}

      <section className="card grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div><p className="text-ink-muted">Amount</p><p className="text-lg font-bold"><Money kobo={loan.principalKobo} /></p></div>
        <div><p className="text-ink-muted">Interest rate</p><p className="font-semibold">{pct(loan.annualRateBps)} p.a. {loan.method === "FLAT" ? "flat" : "reducing"}</p></div>
        <div><p className="text-ink-muted">Monthly repayment</p><p className="font-semibold"><Money kobo={loan.instalmentKobo} /></p></div>
        <div><p className="text-ink-muted">Total repayable</p><p className="font-semibold"><Money kobo={loan.principalKobo + loan.totalInterestKobo} /></p></div>
        <div><p className="text-ink-muted">Processing fee</p><p className="font-semibold"><Money kobo={loan.processingFeeKobo} /></p></div>
        <div><p className="text-ink-muted">You receive</p><p className="font-semibold"><Money kobo={loan.principalKobo - loan.processingFeeKobo} /></p></div>
        <div><p className="text-ink-muted">Tenor</p><p className="font-semibold">{loan.tenorMonths} months</p></div>
        <div><p className="text-ink-muted">Purpose</p><p className="font-semibold">{loan.purpose}</p></div>
      </section>

      {loan.status === "APPROVED" && (
        <section className="card border-brand/40 bg-brand-50">
          <h2 className="font-semibold">Your loan offer</h2>
          <p className="mt-1 text-sm text-ink-soft">Please review the key facts above and the schedule below. By accepting, you agree to repay {loan.tenorMonths} monthly instalments of <Money kobo={loan.instalmentKobo} className="font-semibold" /> and authorise Prompt Funds to collect due instalments from your available savings.</p>
          <form action={acceptOfferAction} className="mt-4"><input type="hidden" name="loanId" value={loan.id} /><SubmitButton confirm="Accept this loan offer?">Accept offer</SubmitButton></form>
        </section>
      )}

      {["ACTIVE", "IN_ARREARS", "DISBURSED"].includes(loan.status) && (
        <section className={`card ${loan.status === "IN_ARREARS" ? "border-danger/40" : ""}`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-sm text-ink-muted">Outstanding</p><p className="text-2xl font-bold"><Money kobo={outstanding} /></p>{overdue > 0n && <p className="text-sm font-semibold text-danger">Due now: <Money kobo={overdue} /></p>}</div>
            <p className="text-sm text-ink-muted">Available savings: <Money kobo={available} className="font-semibold text-ink" /></p>
          </div>
          <form action={repayAction} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="loanId" value={loan.id} />
            <input type="hidden" name="idem" value={randomUUID()} />
            <input name="amount" inputMode="decimal" required className="input max-w-[220px]" defaultValue={koboToInput(overdue > 0n ? overdue : nextDue)} aria-label="Repayment amount" />
            <SubmitButton confirm="Pay this amount from your savings?">Repay from savings</SubmitButton>
          </form>
          <p className="hint">Low on savings? Deposit to your Prompt Funds account first, then repay.</p>
        </section>
      )}

      <section className="card">
        <h2 className="font-semibold">{preview ? "Repayment schedule (estimate)" : "Repayment schedule"}</h2>
        <div className="overflow-x-auto">
          <table className="table mt-2">
            <thead><tr><th>#</th>{!preview && <th>Due</th>}<th>Principal</th><th>Interest</th><th>Total</th>{!preview && <th>Status</th>}</tr></thead>
            <tbody>
              {preview
                ? preview.map((r) => <tr key={r.number}><td>{r.number}</td><td><Money kobo={r.principalKobo} /></td><td><Money kobo={r.interestKobo} /></td><td className="font-semibold"><Money kobo={r.totalKobo} /></td></tr>)
                : loan.instalments.map((i) => (
                    <tr key={i.id}><td>{i.number}</td><td>{fmtDate(i.dueDate)}</td><td><Money kobo={i.principalKobo} /></td><td><Money kobo={i.interestKobo} /></td><td className="font-semibold"><Money kobo={i.principalKobo + i.interestKobo} /></td><td><Badge status={i.status} />{i.status === "PARTIAL" && <p className="text-xs text-ink-muted">paid <Money kobo={i.paidKobo} /></p>}</td></tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      {loan.repayments.length > 0 && (
        <section className="card">
          <h2 className="font-semibold">Payments</h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {loan.repayments.map((r) => <li key={r.id} className="flex justify-between py-2"><span>{fmtDate(r.paidAt)} · {r.source === "AUTO_DEBIT" ? "Auto-debit" : "From savings"}</span><Money kobo={r.amountKobo} className="font-semibold" /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
