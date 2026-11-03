import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { LoanCalculator } from "@/components/LoanCalculator";
import { toCalc } from "@/lib/calc";
import { Money, pct } from "@/components/ui";

export const revalidate = 300;
export const metadata = { title: "Loans" };

export default async function LoansInfo() {
  const { products } = await getCatalog();
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <p className="eyebrow">Member loans</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Fair loans, clearly priced.</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">Apply from your dashboard. A credit officer reviews your repayment capacity, the loan committee approves, and the money goes straight to your own bank account.</p>
      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          {products.map((p) => (
            <div key={p.id} className="card">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-ink-muted">Amount</dt><dd className="font-semibold"><Money kobo={p.minAmountKobo} /> – <Money kobo={p.maxAmountKobo} /></dd></div>
                <div><dt className="text-ink-muted">Tenor</dt><dd className="font-semibold">{p.minTenorMonths}–{p.maxTenorMonths} months</dd></div>
                <div><dt className="text-ink-muted">Interest</dt><dd className="font-semibold">{pct(p.annualRateBps)} p.a. {p.method === "FLAT" ? "flat" : "reducing"}</dd></div>
                <div><dt className="text-ink-muted">Processing fee</dt><dd className="font-semibold">{pct(p.processingFeeBps)}</dd></div>
              </dl>
            </div>
          ))}
          <div className="card text-sm text-ink-soft">
            <h2 className="font-semibold text-ink">Who can apply</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Verified members with an active savings wallet</li>
              <li>No other open loan, and no overdue repayments</li>
              <li>Monthly repayment within 40% of your disposable income</li>
              <li>Loan up to 3× your savings balance</li>
            </ul>
          </div>
        </div>
        <div className="card"><h2 className="mb-4 font-semibold">Estimate your repayments</h2><LoanCalculator products={products.map(toCalc)} /></div>
      </div>
      <Link href="/register" className="btn btn-primary mt-10">Become a member to apply</Link>
    </div>
  );
}
