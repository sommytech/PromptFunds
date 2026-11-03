"use client";
import { useMemo, useState } from "react";
import { flatSchedule, reducingBalanceSchedule } from "@/lib/amortisation";
import { formatNaira } from "@/lib/money";

import type { CalcProduct } from "@/lib/calc";

export function LoanCalculator({ products, onChange, compact = false }: { products: CalcProduct[]; onChange?: (s: { productId: string; amount: number; tenor: number }) => void; compact?: boolean }) {
  const [pid, setPid] = useState(products[0]?.id ?? "");
  const p = products.find((x) => x.id === pid) ?? products[0];
  const [amount, setAmount] = useState(p ? Math.min(Math.max(200_000, p.min), p.max) : 0);
  const [tenor, setTenor] = useState(p ? Math.min(6, p.maxTenor) : 6);

  const result = useMemo(() => {
    if (!p || amount < p.min || amount > p.max) return null;
    const kobo = BigInt(Math.round(amount * 100));
    const rows = p.method === "FLAT" ? flatSchedule(kobo, p.rateBps, tenor) : reducingBalanceSchedule(kobo, p.rateBps, tenor);
    const interest = rows.reduce((a, r) => a + r.interestKobo, 0n);
    const fee = (kobo * BigInt(p.feeBps)) / 10_000n;
    return { monthly: rows[0].totalKobo, interest, fee, total: kobo + interest, rows };
  }, [p, amount, tenor]);

  if (!p) return <p className="text-ink-muted">Loan products will appear here once configured.</p>;
  const emit = (patch: Partial<{ productId: string; amount: number; tenor: number }>) => onChange?.({ productId: pid, amount, tenor, ...patch });

  return (
    <div className="space-y-5">
      {products.length > 1 && (
        <div>
          <label className="label" htmlFor="productId">Loan product</label>
          <select id="productId" name="productId" className="input" value={pid} onChange={(e) => { setPid(e.target.value); emit({ productId: e.target.value }); }}>
            {products.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
      )}
      {products.length === 1 && <input type="hidden" name="productId" value={pid} />}
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="amount">Amount</label>
          <span className="text-lg font-bold">{formatNaira(BigInt(Math.round(amount * 100)))}</span>
        </div>
        <input type="range" min={p.min} max={p.max} step={5000} value={amount} onChange={(e) => { setAmount(Number(e.target.value)); emit({ amount: Number(e.target.value) }); }} className="w-full accent-brand" aria-label="Loan amount" />
        <input type="hidden" name="amount" value={amount} />
        <p className="hint">{formatNaira(BigInt(p.min * 100))} – {formatNaira(BigInt(p.max * 100))}</p>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="tenor">Repay over</label>
          <span className="text-lg font-bold">{tenor} months</span>
        </div>
        <input id="tenor" type="range" min={p.minTenor} max={p.maxTenor} value={tenor} onChange={(e) => { setTenor(Number(e.target.value)); emit({ tenor: Number(e.target.value) }); }} className="w-full accent-brand" />
        <input type="hidden" name="tenor" value={tenor} />
      </div>
      {result && (
        <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-brand/15">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-ink-muted">Monthly</p><p className="text-lg font-bold text-brand-dark">{formatNaira(result.monthly)}</p></div>
            <div><p className="text-ink-muted">Total interest</p><p className="font-semibold">{formatNaira(result.interest)}</p></div>
            <div><p className="text-ink-muted">Processing fee</p><p className="font-semibold">{formatNaira(result.fee)}</p></div>
            <div><p className="text-ink-muted">Total repayable</p><p className="font-semibold">{formatNaira(result.total)}</p></div>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            {(p.rateBps / 100).toFixed(1)}% a year, {p.method === "FLAT" ? "flat" : "reducing balance"}. Estimate only — your offer shows the final schedule before you accept.
          </p>
          {!compact && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-brand">See repayment schedule</summary>
              <table className="table mt-2">
                <thead><tr><th>#</th><th>Principal</th><th>Interest</th><th>Payment</th></tr></thead>
                <tbody>{result.rows.map((r) => <tr key={r.number}><td>{r.number}</td><td>{formatNaira(r.principalKobo)}</td><td>{formatNaira(r.interestKobo)}</td><td className="font-semibold">{formatNaira(r.totalKobo)}</td></tr>)}</tbody>
              </table>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
