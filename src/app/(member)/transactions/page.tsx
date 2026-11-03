import Link from "next/link";
import { redirect } from "next/navigation";
import type { TxType } from "@/generated/prisma/client";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Empty, fmtDateTime, humanize, Money } from "@/components/ui";

export const metadata = { title: "Transactions" };
const TYPES: TxType[] = ["DEPOSIT", "WITHDRAWAL", "INTEREST_CREDIT", "LOAN_DISBURSEMENT", "LOAN_REPAYMENT"];
const PAGE = 25;

export default async function Transactions({ searchParams }: { searchParams: { type?: string; cursor?: string } }) {
  const member = (await currentUser())!.member!;
  if (member.kycStatus !== "APPROVED") redirect("/kyc");
  const type = TYPES.includes(searchParams.type as TxType) ? (searchParams.type as TxType) : undefined;
  // Keyset pagination on (memberId, createdAt desc) index — constant cost per page.
  const rows = await db.transaction.findMany({
    where: { memberId: member.id, ...(type ? { type } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(searchParams.cursor ? { cursor: { id: searchParams.cursor }, skip: 1 } : {}),
  });
  const next = rows.length > PAGE ? rows.pop()!.id : null;
  const q = (p: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ type, ...p }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <form action="/api/statement" className="flex flex-wrap items-end gap-2 text-sm">
          <div><label className="label" htmlFor="from">From</label><input id="from" type="date" name="from" className="input min-h-[40px] py-2" /></div>
          <div><label className="label" htmlFor="to">To</label><input id="to" type="date" name="to" className="input min-h-[40px] py-2" /></div>
          <button className="btn btn-ghost btn-sm">Download statement (CSV)</button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/transactions" className={`rounded-full px-3 py-1.5 ${!type ? "bg-ink text-white" : "bg-white ring-1 ring-slate-200"}`}>All</Link>
        {TYPES.map((t) => <Link key={t} href={`/transactions?type=${t}`} className={`rounded-full px-3 py-1.5 ${type === t ? "bg-ink text-white" : "bg-white ring-1 ring-slate-200"}`}>{humanize(t)}</Link>)}
      </div>
      <section className="card p-0">
        {rows.length === 0 ? <div className="p-5"><Empty title="No transactions" /></div> : (
          <ul className="divide-y divide-slate-100">
            {rows.map((t) => {
              const credit = ["DEPOSIT", "INTEREST_CREDIT"].includes(t.type);
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0"><p className="font-medium">{humanize(t.type)}</p><p className="truncate text-xs text-ink-muted">{fmtDateTime(t.createdAt)} · {t.reference}</p></div>
                  <div className="text-right"><p className={`font-semibold ${credit ? "text-brand-dark" : ""}`}>{credit ? "+" : "−"}<Money kobo={t.amountKobo} /></p><Badge status={t.status} /></div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <div className="flex justify-between">
        {searchParams.cursor ? <Link href={`/transactions${q({})}`} className="btn btn-ghost btn-sm">← Newest</Link> : <span />}
        {next && <Link href={`/transactions${q({ cursor: next })}`} className="btn btn-ghost btn-sm">Older →</Link>}
      </div>
    </div>
  );
}
