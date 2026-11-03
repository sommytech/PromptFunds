import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { pct } from "@/components/ui";

export const revalidate = 300;
export const metadata = { title: "Savings" };

export default async function Savings() {
  const { savingsRateBps } = await getCatalog();
  const rate = savingsRateBps ? pct(savingsRateBps) : "our published rate";
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="eyebrow">Savings wallet</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Save any amount. Earn {rate} a year.</h1>
      <p className="mt-4 text-lg text-ink-soft">Every member gets a personal account number. Transfer from any Nigerian bank app and your balance updates as soon as the payment is confirmed.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {[
          ["No minimum", "No compulsory first deposit or monthly contribution. Save when you can."],
          ["Interest, calculated daily", `Interest accrues every day on your balance at ${rate} p.a. and is credited at month-end.`],
          ["Withdraw to your bank", "Request a withdrawal online. We pay it to your own verified bank account within 1 business day."],
          ["Always reconciled", "Your balance comes from a double-entry ledger that is reconciled with our bank records every day."],
        ].map(([t, d]) => (
          <div key={t} className="card"><h2 className="font-semibold">{t}</h2><p className="mt-1 text-sm text-ink-soft">{d}</p></div>
        ))}
      </div>
      <div className="mt-8 rounded-2xl bg-spark-light p-5 text-sm text-[#6B4700]">
        <strong>Good to know:</strong> Prompt Funds is a members-only savings and loans service, not a bank. You cannot send money to other people or other banks from your wallet. Savings are not covered by NDIC deposit insurance.
      </div>
      <Link href="/register" className="btn btn-primary mt-8">Start saving — it’s free</Link>
    </div>
  );
}
