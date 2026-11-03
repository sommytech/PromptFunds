import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, Flash, fmtDate, fmtDateTime, humanize, Money, pct } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { assessmentChecks } from "@/services/loans";
import { approveLoanAction, assessLoanAction, declineLoanAction, disburseLoanAction } from "../../../_actions";

export default async function AdminLoan({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; err?: string } }) {
  const loan = await db.loan.findUnique({ where: { id: params.id }, include: { product: true, member: { include: { wallet: true, bankAccount: true } }, instalments: { orderBy: { number: "asc" } } } });
  if (!loan) notFound();
  const [checks, history] = await Promise.all([
    assessmentChecks(loan),
    db.auditLog.findMany({ where: { entityType: "Loan", entityId: loan.id }, orderBy: { createdAt: "asc" }, include: { actor: { select: { email: true } } } }),
  ]);
  const disposable = (loan.monthlyIncomeKobo ?? 0n) - (loan.monthlyExpensesKobo ?? 0n);
  return (
    <div className="space-y-5">
      <Flash searchParams={searchParams} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-bold">{loan.reference}</h1><p className="text-sm text-ink-muted">{loan.member.firstName} {loan.member.lastName} · {loan.member.membershipNumber}</p></div>
        <Badge status={loan.status} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card text-sm">
          <h2 className="mb-3 font-semibold">Application</h2>
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="text-ink-muted">Product</dt><dd className="font-semibold">{loan.product.name}</dd></div>
            <div><dt className="text-ink-muted">Amount</dt><dd className="font-semibold"><Money kobo={loan.principalKobo} /></dd></div>
            <div><dt className="text-ink-muted">Tenor / rate</dt><dd>{loan.tenorMonths} months · {pct(loan.annualRateBps)} {humanize(loan.method)}</dd></div>
            <div><dt className="text-ink-muted">Instalment</dt><dd className="font-semibold"><Money kobo={loan.instalmentKobo} /></dd></div>
            <div><dt className="text-ink-muted">Income / expenses</dt><dd><Money kobo={loan.monthlyIncomeKobo ?? 0n} /> / <Money kobo={loan.monthlyExpensesKobo ?? 0n} /></dd></div>
            <div><dt className="text-ink-muted">Disposable</dt><dd><Money kobo={disposable} /></dd></div>
            <div><dt className="text-ink-muted">Savings</dt><dd><Money kobo={loan.member.wallet?.balanceKobo ?? 0n} /></dd></div>
            <div><dt className="text-ink-muted">Payout to</dt><dd>{loan.member.bankAccount ? `${loan.member.bankAccount.bankName} ••${loan.member.bankAccount.accountNumber.slice(-4)}` : "—"}</dd></div>
            <div className="col-span-2"><dt className="text-ink-muted">Purpose</dt><dd>{loan.purpose}</dd></div>
            {loan.assessmentNotes && <div className="col-span-2"><dt className="text-ink-muted">Officer notes</dt><dd>{loan.assessmentNotes}</dd></div>}
          </dl>
        </section>
        <section className="card text-sm">
          <h2 className="mb-3 font-semibold">Automated credit checks</h2>
          <ul className="space-y-2">
            {checks.map((c) => <li key={c.label} className="flex items-center justify-between gap-3"><span><span className={c.pass ? "text-brand" : "text-danger"}>{c.pass ? "✓" : "✗"}</span> {c.label}</span><span className="text-ink-muted">{c.detail}</span></li>)}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">Checks inform — they do not replace — the officer’s judgement. Record reasons for any override in the notes.</p>
        </section>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">Decision</h2>
        {loan.status === "SUBMITTED" && (
          <form action={assessLoanAction} className="space-y-2">
            <input type="hidden" name="id" value={loan.id} />
            <textarea name="notes" required className="input min-h-[90px]" placeholder="Assessment: repayment capacity, savings behaviour, recommendation" />
            <SubmitButton>Record assessment & send to committee</SubmitButton>
          </form>
        )}
        {loan.status === "UNDER_ASSESSMENT" && (
          <form action={approveLoanAction}><input type="hidden" name="id" value={loan.id} /><SubmitButton confirm="Approve this loan and send the offer?">Approve (committee)</SubmitButton><p className="hint">Must be a different person from the assessing officer.</p></form>
        )}
        {loan.status === "OFFER_ACCEPTED" && (
          <form action={disburseLoanAction}><input type="hidden" name="id" value={loan.id} /><SubmitButton confirm="Send disbursement to the member's bank account?">Disburse <Money kobo={loan.principalKobo - loan.processingFeeKobo} /></SubmitButton><p className="hint">Net of processing fee <Money kobo={loan.processingFeeKobo} />. Paid only to the member’s verified account.</p></form>
        )}
        {["SUBMITTED", "UNDER_ASSESSMENT", "APPROVED"].includes(loan.status) && (
          <form action={declineLoanAction} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={loan.id} /><input name="reason" required className="input max-w-md" placeholder="Reason given to the member" /><SubmitButton className="btn btn-danger">Decline</SubmitButton></form>
        )}
        {loan.status === "APPROVED" && <p className="text-sm text-ink-muted">Waiting for the member to accept the offer.</p>}
        {["ACTIVE", "IN_ARREARS", "CLOSED", "DECLINED"].includes(loan.status) && <p className="text-sm text-ink-muted">No action required.</p>}
      </section>

      {loan.instalments.length > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="font-semibold">Schedule</h2>
          <table className="table mt-2"><thead><tr><th>#</th><th>Due</th><th>Principal</th><th>Interest</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody>{loan.instalments.map((i) => <tr key={i.id}><td>{i.number}</td><td>{fmtDate(i.dueDate)}</td><td><Money kobo={i.principalKobo} /></td><td><Money kobo={i.interestKobo} /></td><td><Money kobo={i.paidKobo} /></td><td><Badge status={i.status} />{i.daysOverdue > 0 && <span className="ml-1 text-xs text-danger">{i.daysOverdue}d</span>}</td></tr>)}</tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h2 className="font-semibold">History</h2>
        <ol className="mt-2 space-y-1 text-sm">{history.map((h) => <li key={h.id}><span className="text-ink-muted">{fmtDateTime(h.createdAt)}</span> · {humanize(h.action)} {h.actor && <span className="text-ink-muted">by {h.actor.email}</span>}</li>)}</ol>
      </section>
    </div>
  );
}
