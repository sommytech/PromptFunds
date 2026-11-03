import type { KycStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { Badge, Flash, fmtDate } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { approveKycAction, rejectKycAction } from "../../_actions";

export default async function Members({ searchParams }: { searchParams: { q?: string; status?: string; ok?: string; err?: string } }) {
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const queue = searchParams.status === "queue";
  // searchText is GIN-trigram indexed, so ILIKE '%term%' stays fast at scale.
  const where: Prisma.MemberWhereInput = {
    ...(q ? { searchText: { contains: q } } : {}),
    ...(queue ? { kycStatus: { in: ["SUBMITTED", "IN_REVIEW"] as KycStatus[] } } : {}),
  };
  const members = await db.member.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { email: true, phone: true } }, bankAccount: true } });
  return (
    <div className="space-y-5">
      <Flash searchParams={searchParams} />
      <h1 className="text-2xl font-bold">Members & verification</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={searchParams.q} placeholder="Search name, phone, email or PF number" className="input max-w-md" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="status" value="queue" defaultChecked={queue} className="accent-brand" /> KYC queue only</label>
        <button className="btn btn-ghost">Search</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Member</th><th>Contact</th><th>KYC</th><th>Payout account</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td><p className="font-semibold">{m.firstName} {m.lastName}</p><p className="font-mono text-xs text-ink-muted">{m.membershipNumber ?? "—"}</p></td>
                <td className="text-xs">{m.user.email}<br />+{m.user.phone}</td>
                <td><Badge status={m.kycStatus} />{m.kycMatchScore !== null && <p className="text-xs text-ink-muted">BVN match {m.kycMatchScore}%</p>}{m.kycRejectReason && <p className="max-w-[200px] text-xs text-danger">{m.kycRejectReason}</p>}</td>
                <td className="text-xs">{m.bankAccount ? <>{m.bankAccount.bankName} ••{m.bankAccount.accountNumber.slice(-4)}<br />{m.bankAccount.accountName} {m.bankAccount.nameMatched ? "✓" : <span className="text-danger">name mismatch</span>}</> : "—"}</td>
                <td className="text-xs">{fmtDate(m.createdAt)}</td>
                <td>
                  {["SUBMITTED", "IN_REVIEW"].includes(m.kycStatus) && (
                    <div className="flex flex-col gap-2">
                      <form action={approveKycAction}><input type="hidden" name="memberId" value={m.id} /><input type="hidden" name="q" value={searchParams.q ?? ""} /><SubmitButton className="btn btn-primary btn-sm w-full">Approve</SubmitButton></form>
                      <form action={rejectKycAction} className="flex gap-1"><input type="hidden" name="memberId" value={m.id} /><input type="hidden" name="q" value={searchParams.q ?? ""} /><input name="reason" placeholder="Reason" className="input min-h-[36px] py-1 text-xs" /><SubmitButton className="btn btn-danger btn-sm">Reject</SubmitButton></form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-ink-muted">No members found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
