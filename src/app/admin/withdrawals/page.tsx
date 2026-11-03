import { db } from "@/lib/db";
import { POLICY } from "@/lib/policy";
import { Badge, Flash, fmtDateTime, Money } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { approveWithdrawalAction, rejectWithdrawalAction } from "../../_actions";

export default async function Withdrawals({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const [pending, recent] = await Promise.all([
    db.withdrawal.findMany({ where: { status: { in: ["PENDING_APPROVAL", "PROCESSING"] } }, orderBy: { requestedAt: "asc" }, include: { member: { include: { bankAccount: true, wallet: true } } } }),
    db.withdrawal.findMany({ where: { status: { notIn: ["PENDING_APPROVAL", "PROCESSING"] } }, orderBy: { requestedAt: "desc" }, take: 20, include: { member: true } }),
  ]);
  return (
    <div className="space-y-5">
      <Flash searchParams={searchParams} />
      <div><h1 className="text-2xl font-bold">Withdrawals</h1><p className="text-sm text-ink-muted">Maker-checker: the member requests, finance approves. Amounts ≥ <Money kobo={POLICY.dualApprovalThresholdKobo} /> need a Finance Approver. Payouts go only to the member’s verified account.</p></div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Requested</th><th>Member</th><th>Amount</th><th>Pay to</th><th>Status</th><th /></tr></thead>
          <tbody>
            {pending.map((w) => (
              <tr key={w.id}>
                <td className="text-xs">{fmtDateTime(w.requestedAt)}</td>
                <td><p className="font-semibold">{w.member.firstName} {w.member.lastName}</p><p className="font-mono text-xs text-ink-muted">{w.member.membershipNumber}</p></td>
                <td className="font-semibold"><Money kobo={w.amountKobo} />{w.amountKobo >= POLICY.dualApprovalThresholdKobo && <p><Badge status="PENDING" label="Dual approval" /></p>}</td>
                <td className="text-xs">{w.member.bankAccount?.bankName} {w.member.bankAccount?.accountNumber}<br />{w.member.bankAccount?.accountName}</td>
                <td><Badge status={w.status} /></td>
                <td>
                  {w.status === "PENDING_APPROVAL" && (
                    <div className="flex flex-col gap-2">
                      <form action={approveWithdrawalAction}><input type="hidden" name="id" value={w.id} /><SubmitButton className="btn btn-primary btn-sm w-full" confirm="Approve and send payout?">Approve & pay</SubmitButton></form>
                      <form action={rejectWithdrawalAction} className="flex gap-1"><input type="hidden" name="id" value={w.id} /><input name="reason" placeholder="Reason" className="input min-h-[36px] py-1 text-xs" /><SubmitButton className="btn btn-danger btn-sm">Reject</SubmitButton></form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {pending.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-ink-muted">Queue is clear.</td></tr>}
          </tbody>
        </table>
      </div>
      <h2 className="font-semibold">Recently processed</h2>
      <div className="card overflow-x-auto p-0">
        <table className="table"><thead><tr><th>Requested</th><th>Member</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{recent.map((w) => <tr key={w.id}><td className="text-xs">{fmtDateTime(w.requestedAt)}</td><td>{w.member.firstName} {w.member.lastName}</td><td><Money kobo={w.amountKobo} /></td><td><Badge status={w.status} /></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
