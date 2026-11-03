import Link from "next/link";
import type { LoanStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { Badge, fmtDate, humanize, Money, pct } from "@/components/ui";

const TABS: { key: string; label: string; statuses: LoanStatus[] }[] = [
  { key: "new", label: "To assess", statuses: ["SUBMITTED"] },
  { key: "committee", label: "Committee", statuses: ["UNDER_ASSESSMENT"] },
  { key: "disburse", label: "To disburse", statuses: ["OFFER_ACCEPTED"] },
  { key: "book", label: "Active book", statuses: ["ACTIVE", "DISBURSED"] },
  { key: "arrears", label: "Arrears", statuses: ["IN_ARREARS"] },
  { key: "closed", label: "Closed / declined", statuses: ["CLOSED", "DECLINED", "APPROVED", "WRITTEN_OFF"] },
];

export default async function AdminLoans({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = TABS.find((t) => t.key === searchParams.tab) ?? TABS[0];
  const [loans, counts] = await Promise.all([
    db.loan.findMany({ where: { status: { in: tab.statuses } }, orderBy: { createdAt: "asc" }, take: 100, include: { member: true, product: true } }),
    db.loan.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: LoanStatus[]) => counts.filter((c) => s.includes(c.status)).reduce((a, c) => a + c._count, 0);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Loans</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => <Link key={t.key} href={`/admin/loans?tab=${t.key}`} className={`rounded-full px-3 py-1.5 ${t.key === tab.key ? "bg-ink text-white" : "bg-white ring-1 ring-slate-200"}`}>{t.label} <span className="opacity-60">{count(t.statuses)}</span></Link>)}
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Reference</th><th>Member</th><th>Amount</th><th>Tenor / rate</th><th>Affordability</th><th>Status</th><th>Applied</th></tr></thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id}>
                <td><Link href={`/admin/loans/${l.id}`} className="font-mono font-semibold text-brand">{l.reference}</Link></td>
                <td>{l.member.firstName} {l.member.lastName}<p className="font-mono text-xs text-ink-muted">{l.member.membershipNumber}</p></td>
                <td className="font-semibold"><Money kobo={l.principalKobo} />{l.outstandingPrincipalKobo > 0n && <p className="text-xs font-normal text-ink-muted">o/s <Money kobo={l.outstandingPrincipalKobo} /></p>}</td>
                <td className="text-xs">{l.tenorMonths} mo · {pct(l.annualRateBps)}<br />{humanize(l.method)}</td>
                <td className="text-xs">{l.affordabilityBps === null ? "—" : `${(l.affordabilityBps / 100).toFixed(1)}%`}</td>
                <td><Badge status={l.status} /></td>
                <td className="text-xs">{fmtDate(l.createdAt)}</td>
              </tr>
            ))}
            {loans.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-ink-muted">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
