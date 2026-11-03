import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { LoanCalculator } from "@/components/LoanCalculator";
import { toCalc } from "@/lib/calc";
import { pct } from "@/components/ui";

export const revalidate = 300;

const steps = [
  { n: "1", t: "Join free", d: "Register with your phone and email. No fee, no minimum deposit." },
  { n: "2", t: "Verify online", d: "Confirm your identity with your BVN in minutes — no office visit." },
  { n: "3", t: "Save any amount", d: "Transfer to your personal Prompt Funds account number from any bank app." },
  { n: "4", t: "Earn & borrow", d: "Earn interest on savings and apply for fair, transparent loans." },
];

export default async function Home() {
  const { savingsRateBps, products } = await getCatalog();
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-canvas">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="eyebrow">Member savings · Fair loans</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.08] sm:text-5xl">
              Save what you can.<br /><span className="text-brand">Borrow when you need.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-soft">
              Prompt Funds is a member-owned savings and loans platform on your phone. Register free, deposit any amount,
              watch your balance and interest grow, and apply for a loan without visiting an office.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-primary">Create your free account</Link>
              <Link href="/loans-info" className="btn btn-ghost">See loan rates</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              <li>✓ ₦0 registration</li><li>✓ No minimum balance</li><li>✓ {savingsRateBps ? `${pct(savingsRateBps)} p.a. on savings` : "Interest on savings"}</li>
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-spark/20 blur-3xl" aria-hidden />
            <div className="card relative mx-auto max-w-sm bg-ink p-6 text-white shadow-2xl">
              <p className="text-sm text-slate-400">Total savings</p>
              <p className="mt-1 text-4xl font-extrabold">₦248,500.00</p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-slate-400">Available</p><p className="font-semibold">₦238,500</p></div>
                <div><p className="text-slate-400">Interest</p><p className="font-semibold text-spark">₦4,212</p></div>
                <div><p className="text-slate-400">Loan due</p><p className="font-semibold">₦18,640</p></div>
              </div>
              <div className="mt-6 rounded-xl bg-white/5 p-3 text-sm">
                <p className="text-slate-400">Deposit to</p>
                <p className="font-mono text-base">Wema Bank · 74•• ••• 219</p>
              </div>
              <p className="mt-4 text-center text-xs text-slate-500">Illustration</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="card">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light font-bold text-brand-dark">{s.n}</span>
              <h3 className="mt-4 font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-ink-soft">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
          <div>
            <p className="eyebrow">Loan calculator</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Know your repayment before you apply</h2>
            <p className="mt-3 text-ink-soft">Every loan shows the rate, fee, monthly repayment and total cost up front. No hidden charges, no surprises.</p>
          </div>
          <div className="card"><LoanCalculator products={products.map(toCalc)} compact /></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="card flex flex-col items-start justify-between gap-6 bg-brand p-8 text-white md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold">Your savings, your cooperative.</h2>
            <p className="mt-1 text-white/80">Membership is free and always will be.</p>
          </div>
          <Link href="/register" className="btn bg-white text-brand-dark hover:bg-brand-light">Join Prompt Funds</Link>
        </div>
      </section>
    </>
  );
}
