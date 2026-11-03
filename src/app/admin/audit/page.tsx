import { db } from "@/lib/db";
import { fmtDateTime, humanize } from "@/components/ui";

export default async function Audit({ searchParams }: { searchParams: { entity?: string } }) {
  const logs = await db.auditLog.findMany({
    where: searchParams.entity ? { entityType: searchParams.entity } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { email: true, role: true } } },
  });
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Audit trail</h1><p className="text-sm text-ink-muted">Append-only and hash-chained: each entry stores the hash of the one before it, so any edit breaks the chain.</p></div>
      <form className="flex gap-2"><select name="entity" defaultValue={searchParams.entity ?? ""} className="input max-w-xs"><option value="">All entities</option>{["Member", "Deposit", "Withdrawal", "Loan"].map((e) => <option key={e}>{e}</option>)}</select><button className="btn btn-ghost">Filter</button></form>
      <div className="card overflow-x-auto p-0">
        <table className="table"><thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Actor</th><th>Hash</th></tr></thead>
          <tbody>{logs.map((l) => <tr key={l.id}><td className="whitespace-nowrap text-xs">{fmtDateTime(l.createdAt)}</td><td className="font-medium">{humanize(l.action)}</td><td className="text-xs">{l.entityType} <span className="font-mono text-ink-muted">{l.entityId?.slice(-8)}</span></td><td className="text-xs">{l.actor ? `${l.actor.email} (${humanize(l.actor.role)})` : "system"}</td><td className="font-mono text-xs text-ink-muted">{l.hash.slice(0, 12)}…</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
