import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BANKS } from "@/lib/banks";
import { Badge, Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { submitKycAction } from "../../_actions";

export const metadata = { title: "Verify your identity" };

export default async function Kyc({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const user = await currentUser();
  const member = user!.member!;
  if (member.kycStatus === "APPROVED") redirect(`/dashboard${searchParams.ok ? `?ok=${encodeURIComponent(searchParams.ok)}` : ""}`);
  const bank = await db.bankAccount.findUnique({ where: { memberId: member.id } });
  const submitted = member.kycStatus === "IN_REVIEW";

  return (
    <div className="mx-auto max-w-xl">
      <Flash searchParams={searchParams} />
      <ol className="mb-6 flex items-center gap-2 text-xs font-semibold text-ink-muted">
        <li className="rounded-full bg-brand px-3 py-1 text-white">1 Account</li>
        <li className={`rounded-full px-3 py-1 ${submitted ? "bg-brand text-white" : "bg-brand-light text-brand-dark"}`}>2 Identity</li>
        <li className="rounded-full bg-slate-100 px-3 py-1">3 Wallet ready</li>
      </ol>
      <h1 className="text-2xl font-bold">Verify your identity</h1>
      <p className="mt-1 text-ink-soft">We check your details electronically against your BVN. No office visit, no documents to post.</p>
      <p className="mt-3">Status: <Badge status={member.kycStatus} /></p>
      {member.kycRejectReason && <p className="mt-2 rounded-xl bg-spark-light p-3 text-sm text-[#6B4700]">{member.kycRejectReason}</p>}

      {submitted ? (
        <div className="card mt-6">
          <h2 className="font-semibold">Thanks, {member.firstName} — you’re in the queue</h2>
          <p className="mt-1 text-sm text-ink-soft">Your BVN matched. A verification officer will approve your membership shortly and your savings account number will appear on your dashboard.</p>
        </div>
      ) : (
        <form action={submitKycAction} className="card mt-6 space-y-4">
          <div><label className="label" htmlFor="dateOfBirth">Date of birth</label><input id="dateOfBirth" name="dateOfBirth" type="date" required className="input" defaultValue={member.dateOfBirth?.toISOString().slice(0, 10)} /></div>
          <div><label className="label" htmlFor="address">Home address</label><input id="address" name="address" required className="input" defaultValue={member.address ?? ""} autoComplete="street-address" /></div>
          <div>
            <label className="label" htmlFor="bvn">BVN</label>
            <input id="bvn" name="bvn" inputMode="numeric" pattern="\d{11}" maxLength={11} required className="input font-mono tracking-widest" placeholder="11 digits" />
            <p className="hint">Dial *565*0# to get your BVN. We encrypt it and never show it in full.</p>
          </div>
          <div><label className="label" htmlFor="nin">NIN (optional)</label><input id="nin" name="nin" inputMode="numeric" pattern="\d{11}" maxLength={11} className="input font-mono tracking-widest" /></div>
          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold">Your bank account for withdrawals</legend>
            <p className="mb-3 text-xs text-ink-muted">Must be in your own name. Withdrawals and loans are paid only to this account.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="bankCode">Bank</label>
                <select id="bankCode" name="bankCode" required className="input" defaultValue={bank?.bankCode ?? ""}>
                  <option value="" disabled>Select bank</option>
                  {BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select></div>
              <div><label className="label" htmlFor="accountNumber">Account number</label><input id="accountNumber" name="accountNumber" inputMode="numeric" pattern="\d{10}" maxLength={10} required className="input font-mono" defaultValue={bank?.accountNumber ?? ""} /></div>
            </div>
          </fieldset>
          <SubmitButton className="btn btn-primary w-full" pendingText="Verifying…">Verify and continue</SubmitButton>
          <p className="text-xs text-ink-muted">By continuing you consent to Prompt Funds verifying your identity with licensed verification partners, as described in our privacy notice (NDPA 2023).</p>
        </form>
      )}
    </div>
  );
}
