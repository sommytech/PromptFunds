import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Empty, Flash, fmtDate, fmtDateTime, humanize, Money } from "@/components/ui";
import { pendingInterest } from "@/services/interest";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const user = await currentUser();
  const member = user!.member!;
  if (member.kycStatus !== "APPROVED") redirect("/kyc");

  const [wallet, recent, loans, notes, accrued] = await Promise.all([
    db.wallet.findUniqueOrThrow({ where: { memberId: member.id } }),
    db.transaction.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.loan.findMany({
      where: { memberId: member.id, status: { notIn: ["CLOSED", "DECLINED", "WRITTEN_OFF"] } },
      include: { instalments: { where: { status: { not: "PAID" } }, orderBy: { number: "asc" } } },
    }),
    db.notification.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    pendingInterest(member.id),
  ]);
  const available = wallet.balanceKobo - wallet.heldKobo;
  const loanOutstanding = loans.reduce((a, l) => a + l.instalments.reduce((s, i) => s + i.principalKobo + i.interestKobo - i.paidKobo, 0n), 0n);
  const nextDue = loans.flatMap((l) => l.instalments.map((i) => ({ ...i, ref: l.reference, loanId: l.id }))).sort((a, b) => +a.dueDate - +b.dueDate)[0];

  return (
    <div className="space-y-5">
      <Flash searchParams={searchParams} />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hello, {member.firstName}</h1>
          <p className="text-sm text-ink-muted">Member {member.membershipNumber}</p>
        </div>
      </div>

      <section className="card relative overflow-hidden bg-ink p-6 text-white">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/40 blur-2xl" aria-hidden />
        <p className="text-sm text-slate-400">Total savings</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight"><Money kobo={wallet.balanceKobo} /></p>
        <div className="relative mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><p className="text-slate-400">Available</p><p className="font-semibold"><Money kobo={available} /></p></div>
          <div><p className="text-slate-400">Pending</p><p className="font-semibold"><Money kobo={wallet.heldKobo} /></p></div>
          <div><p className="text-slate-400">Interest earned</p><p className="font-semibold text-spark"><Money kobo={wallet.interestEarnedKobo} /></p></div>
          <div><p className="text-slate-400">Accrued this month</p><p className="font-semibold"><Money kobo={accrued} /></p></div>
        </div>
        <div className="relative mt-6 grid grid-cols-3 gap-2">
          <Link href="/wallet#deposit" className="btn btn-sm bg-brand text-white hover:bg-brand-dark">Deposit</Link>
          <Link href="/wallet#withdraw" className="btn btn-sm bg-white/10 text-white hover:bg-white/20">Withdraw</Link>
          <Link href="/loans/apply" className="btn btn-sm bg-white/10 text-white hover:bg-white/20">Get a loan</Link>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Loans</h2><Link href="/loans" className="text-sm font-semibold text-brand">View</Link></div>
          {loans.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No active loans. <Link href="/loans/apply" className="font-semibold text-brand">Check what you can borrow →</Link></p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-ink-muted">Outstanding balance</span><Money kobo={loanOutstanding} className="font-semibold" /></div>
              {nextDue && (
                <Link href={`/loans/${nextDue.loanId}`} className={`block rounded-xl p-3 text-sm ${nextDue.status === "OVERDUE" ? "bg-danger-light" : "bg-brand-50"}`}>
                  <p className="text-ink-muted">Next repayment · {nextDue.ref}</p>
                  <p className="mt-0.5 flex justify-between font-semibold"><Money kobo={nextDue.principalKobo + nextDue.interestKobo - nextDue.paidKobo} /><span>{fmtDate(nextDue.dueDate)}</span></p>
                </Link>
              )}
              {loans.filter((l) => !l.instalments.length).map((l) => (
                <Link key={l.id} href={`/loans/${l.id}`} className="flex items-center justify-between text-sm"><span>{l.reference}</span><Badge status={l.status} /></Link>
              ))}
            </div>
          )}
        </section>
        <section className="card">
          <h2 className="font-semibold">Updates</h2>
          {notes.length === 0 ? <p className="mt-3 text-sm text-ink-muted">Nothing new.</p> : (
            <ul className="mt-3 space-y-3 text-sm">{notes.map((n) => <li key={n.id}><p className="font-medium">{n.subject}</p><p className="text-ink-muted">{n.body}</p></li>)}</ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Recent activity</h2><Link href="/transactions" className="text-sm font-semibold text-brand">All transactions</Link></div>
        {recent.length === 0 ? <div className="mt-3"><Empty title="No transactions yet">Make your first deposit to start earning interest.</Empty></div> : (
          <ul className="mt-2 divide-y divide-slate-100">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div><p className="font-medium">{humanize(t.type)}</p><p className="text-xs text-ink-muted">{fmtDateTime(t.createdAt)} · {t.narration}</p></div>
                <div className="text-right">
                  <p className={`font-semibold ${["DEPOSIT", "INTEREST_CREDIT"].includes(t.type) ? "text-brand-dark" : ""}`}>{["DEPOSIT", "INTEREST_CREDIT"].includes(t.type) ? "+" : "−"}<Money kobo={t.amountKobo} /></p>
                  {t.status !== "POSTED" && <Badge status={t.status} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
