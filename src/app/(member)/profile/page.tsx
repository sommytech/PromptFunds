import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptField, mask } from "@/lib/crypto";
import { Badge, fmtDate } from "@/components/ui";
import { logoutAction } from "../../_actions";

export const metadata = { title: "Profile" };

export default async function Profile() {
  const user = (await currentUser())!;
  const m = user.member!;
  const bank = await db.bankAccount.findUnique({ where: { memberId: m.id } });
  let bvn = "—";
  try { if (m.bvnEncrypted) bvn = mask(decryptField(m.bvnEncrypted), 3); } catch { bvn = "•••••••••••"; }
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Profile</h1>
      <dl className="card divide-y divide-slate-100 py-1">
        {row("Name", `${m.firstName} ${m.lastName}`)}
        {row("Membership number", <span className="font-mono">{m.membershipNumber ?? "Pending"}</span>)}
        {row("Verification", <Badge status={m.kycStatus} />)}
        {row("Member since", fmtDate(m.kycReviewedAt))}
        {row("Email", user.email)}
        {row("Phone", `+${user.phone}`)}
        {row("BVN", <span className="font-mono">{bvn}</span>)}
        {row("Payout account", bank ? `${bank.bankName} ••${bank.accountNumber.slice(-4)} · ${bank.accountName}` : "—")}
      </dl>
      <p className="text-xs text-ink-muted">To change your payout bank account or phone number, contact support — we re-verify ownership before any change to protect your money.</p>
      <form action={logoutAction}><button className="btn btn-ghost w-full">Log out</button></form>
    </div>
  );
}
