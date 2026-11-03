import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { POLICY } from "@/lib/policy";
import { Flash, Money } from "@/components/ui";
import { LoanCalculator } from "@/components/LoanCalculator";
import { toCalc } from "@/lib/calc";
import { SubmitButton } from "@/components/SubmitButton";
import { applyLoanAction } from "../../../_actions";

export const metadata = { title: "Apply for a loan" };

export default async function Apply({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const member = (await currentUser())!.member!;
  if (member.kycStatus !== "APPROVED") redirect("/kyc");
  const [products, wallet, open] = await Promise.all([
    db.loanProduct.findMany({ where: { active: true }, orderBy: { minAmountKobo: "asc" } }),
    db.wallet.findUniqueOrThrow({ where: { memberId: member.id } }),
    db.loan.findFirst({ where: { memberId: member.id, status: { notIn: ["CLOSED", "DECLINED", "WRITTEN_OFF"] } } }),
  ]);
  const cap = (wallet.balanceKobo * BigInt(POLICY.maxLoanToSavingsBps)) / 10_000n;
  if (open)
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-xl font-bold">You already have an open loan</h1>
        <p className="mt-2 text-ink-soft">You can apply again once {open.reference} is closed.</p>
        <Link href={`/loans/${open.id}`} className="btn btn-primary mt-4">View {open.reference}</Link>
      </div>
    );
  return (
    <div className="mx-auto max-w-2xl">
      <Flash searchParams={searchParams} />
      <h1 className="text-2xl font-bold">Apply for a loan</h1>
      <p className="mt-1 text-ink-soft">Based on your savings of <Money kobo={wallet.balanceKobo} className="font-semibold text-ink" />, you can borrow up to <Money kobo={cap} className="font-semibold text-ink" />.</p>
      <form action={applyLoanAction} className="mt-6 space-y-5">
        <section className="card"><LoanCalculator products={products.map(toCalc)} /></section>
        <section className="card space-y-4">
          <h2 className="font-semibold">About you</h2>
          <div><label className="label" htmlFor="purpose">What is the loan for?</label><input id="purpose" name="purpose" required minLength={3} className="input" placeholder="e.g. Stock for my shop" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="income">Monthly income (₦)</label><input id="income" name="income" inputMode="decimal" required className="input" /></div>
            <div><label className="label" htmlFor="expenses">Monthly expenses (₦)</label><input id="expenses" name="expenses" inputMode="decimal" required className="input" /><p className="hint">Rent, food, transport, other loans.</p></div>
          </div>
          <p className="text-xs text-ink-muted">We use this to check the repayment is affordable (no more than {POLICY.maxAffordabilityBps / 100}% of what’s left after expenses). We never contact your phone contacts.</p>
        </section>
        <SubmitButton className="btn btn-primary w-full" pendingText="Submitting…">Submit application</SubmitButton>
      </form>
    </div>
  );
}
