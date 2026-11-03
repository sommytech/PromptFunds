import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Empty, Flash, fmtDate, Money } from "@/components/ui";

export const metadata = { title: "Loans" };

export default async function Loans({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const member = (await currentUser())!.member!;
  if (member.kycStatus !== "APPROVED") redirect("/kyc");
  const loans = await db.loan.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "desc" }, include: { product: true } });
  const hasOpen = loans.some((l) => !["CLOSED", "DECLINED", "WRITTEN_OFF"].includes(l.status));
  return (
    <div className="space-y-5">
      <Flash searchParams={searchParams} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loans</h1>
        {!hasOpen && <Link href="/loans/apply" className="btn btn-primary btn-sm">Apply for a loan</Link>}
      </div>
      {loans.length === 0 ? (
        <Empty title="You have no loans">Borrow up to 3× your savings with clear, fixed repayments. <Link href="/loans/apply" className="font-semibold text-brand">Apply now</Link></Empty>
      ) : (
        <div className="space-y-3">
          {loans.map((l) => (
            <Link key={l.id} href={`/loans/${l.id}`} className="card flex items-center justify-between gap-4 transition hover:ring-2 hover:ring-brand/30">
              <div>
                <p className="font-semibold">{l.product.name} · <Money kobo={l.principalKobo} /></p>
                <p className="text-xs text-ink-muted">{l.reference} · applied {fmtDate(l.createdAt)} · {l.tenorMonths} months</p>
              </div>
              <div className="text-right">
                <Badge status={l.status} label={l.status === "APPROVED" ? "Offer ready" : undefined} />
                {l.outstandingPrincipalKobo > 0n && <p className="mt-1 text-xs text-ink-muted">Principal left <Money kobo={l.outstandingPrincipalKobo} /></p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
