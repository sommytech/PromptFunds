import { db } from "@/lib/db";
import { Flash, fmtDate, Money, pct } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { currentPolicy } from "@/services/interest";
import { runJobAction } from "../../_actions";

export default async function Operations({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const [policy, lastAccrual, uncredited, products] = await Promise.all([
    currentPolicy(),
    db.interestAccrual.findFirst({ orderBy: { accrualDate: "desc" } }),
    db.interestAccrual.aggregate({ where: { creditedEntryId: null }, _sum: { accruedMicroKobo: true }, _count: true }),
    db.loanProduct.findMany(),
  ]);
  const job = (key: string, title: string, desc: string) => (
    <form action={runJobAction} className="card flex flex-col justify-between gap-3">
      <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-ink-soft">{desc}</p></div>
      <input type="hidden" name="job" value={key} />
      <SubmitButton className="btn btn-ghost" confirm={`Run ${title} now?`}>Run now</SubmitButton>
    </form>
  );
  return (
    <div className="space-y-5">
      <Flash searchParams={searchParams} />
      <div><h1 className="text-2xl font-bold">Operations</h1><p className="text-sm text-ink-muted">Jobs run automatically every night (Netlify scheduled function, 00:30 WAT). Manual runs are safe to repeat — each job is idempotent.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        {job("accrue", "Daily interest accrual", `Accrue today’s interest on every wallet. Last accrual: ${fmtDate(lastAccrual?.accrualDate)}.`)}
        {job("credit", "Month-end interest credit", `Credit ${uncredited._count} uncredited accrual rows (≈ ${Number((uncredited._sum.accruedMicroKobo ?? 0n) / 1_000_000n) / 100} naira) to members’ ledgers.`)}
        {job("arrears", "Repayments & arrears", "Auto-collect due instalments from savings, then flag overdue loans.")}
      </div>
      <section className="card">
        <h2 className="font-semibold">Approved policy parameters</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-muted">Savings rate</dt><dd className="font-semibold">{policy ? `${pct(policy.annualRateBps)} p.a. (actual/${policy.dayCount})` : "Not set"}</dd></div>
          <div><dt className="text-ink-muted">Minimum balance for interest</dt><dd className="font-semibold"><Money kobo={policy?.minBalanceKobo ?? 0n} /></dd></div>
          <div><dt className="text-ink-muted">Effective from</dt><dd className="font-semibold">{fmtDate(policy?.effectiveFrom)}</dd></div>
          {products.map((p) => <div key={p.id}><dt className="text-ink-muted">{p.name}</dt><dd className="font-semibold">{pct(p.annualRateBps)} · fee {pct(p.processingFeeBps)} · <Money kobo={p.minAmountKobo} />–<Money kobo={p.maxAmountKobo} /></dd></div>)}
        </dl>
        <p className="mt-3 text-xs text-ink-muted">Rate changes are board decisions: insert a new InterestPolicy row with a future effective date (never edit history) so past accruals stay reproducible.</p>
      </section>
    </div>
  );
}
