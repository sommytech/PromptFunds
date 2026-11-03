import { db } from "@/lib/db";
import { ACCOUNTS } from "@/lib/ledger";
import { Money } from "@/components/ui";

type Row = { code: string; name: string; type: string; debit: bigint; credit: bigint };

export default async function Reports() {
  // Trial balance by account (member sub-accounts rolled up). Raw SQL keeps it a single aggregate scan.
  const rows = await db.$queryRaw<Row[]>`
    SELECT CASE WHEN a.code LIKE '2000-MEMBER-%' THEN '2000-MEMBERS' ELSE a.code END AS code,
           CASE WHEN a.code LIKE '2000-MEMBER-%' THEN 'Member savings (all members)' ELSE a.name END AS name,
           a.type::text AS type,
           COALESCE(SUM(l.debit),0)::bigint AS debit, COALESCE(SUM(l.credit),0)::bigint AS credit
    FROM "LedgerAccount" a LEFT JOIN "LedgerLine" l ON l."accountId" = a.id
    GROUP BY 1,2,3 ORDER BY 1`;
  const td = rows.reduce((a, r) => a + r.debit, 0n), tc = rows.reduce((a, r) => a + r.credit, 0n);
  const bal = (code: string) => { const r = rows.find((x) => x.code === code); return r ? r.credit - r.debit : 0n; };
  const income = bal(ACCOUNTS.LOAN_INTEREST_INCOME) + bal(ACCOUNTS.FEE_INCOME);
  const expense = -(bal(ACCOUNTS.INTEREST_EXPENSE) + bal(ACCOUNTS.LOSS_PROVISION));
  const aging = await db.$queryRaw<{ bucket: string; loans: bigint; amount: bigint }[]>`
    SELECT CASE WHEN i."daysOverdue" = 0 THEN 'Current' WHEN i."daysOverdue" <= 30 THEN '1–30 days' WHEN i."daysOverdue" <= 60 THEN '31–60 days' WHEN i."daysOverdue" <= 90 THEN '61–90 days' ELSE '90+ days' END AS bucket,
           COUNT(DISTINCT i."loanId")::bigint AS loans, COALESCE(SUM(i."principalKobo" + i."interestKobo" - i."paidKobo"),0)::bigint AS amount
    FROM "LoanInstalment" i JOIN "Loan" l ON l.id = i."loanId"
    WHERE i.status <> 'PAID' AND l.status IN ('ACTIVE','IN_ARREARS','DISBURSED')
    GROUP BY 1 ORDER BY MIN(i."daysOverdue")`;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financial reports</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card"><p className="text-sm text-ink-muted">Income to date</p><p className="text-xl font-bold"><Money kobo={income} /></p><p className="text-xs text-ink-muted">Loan interest + fees</p></div>
        <div className="card"><p className="text-sm text-ink-muted">Expenses to date</p><p className="text-xl font-bold"><Money kobo={expense} /></p><p className="text-xs text-ink-muted">Savings interest + provisions</p></div>
        <div className="card"><p className="text-sm text-ink-muted">Net margin</p><p className="text-xl font-bold"><Money kobo={income - expense} /></p></div>
      </div>
      <section className="card overflow-x-auto">
        <h2 className="font-semibold">Trial balance</h2>
        <table className="table mt-2"><thead><tr><th>Code</th><th>Account</th><th>Type</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.code}><td className="font-mono text-xs">{r.code}</td><td>{r.name}</td><td className="text-xs">{r.type}</td><td className="text-right"><Money kobo={r.debit} /></td><td className="text-right"><Money kobo={r.credit} /></td></tr>)}
            <tr className="font-bold"><td colSpan={3}>Total {td === tc ? "✓ balanced" : "✗ OUT OF BALANCE"}</td><td className="text-right"><Money kobo={td} /></td><td className="text-right"><Money kobo={tc} /></td></tr>
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="font-semibold">Loan portfolio ageing</h2>
        <table className="table mt-2"><thead><tr><th>Bucket</th><th>Loans</th><th className="text-right">Amount due</th></tr></thead>
          <tbody>{aging.map((a) => <tr key={a.bucket}><td>{a.bucket}</td><td>{String(a.loans)}</td><td className="text-right"><Money kobo={a.amount} /></td></tr>)}{aging.length === 0 && <tr><td colSpan={3} className="text-ink-muted">No active loans.</td></tr>}</tbody>
        </table>
      </section>
    </div>
  );
}
