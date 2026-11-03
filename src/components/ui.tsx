import { formatNaira } from "@/lib/money";

export const Money = ({ kobo, className = "" }: { kobo: bigint; className?: string }) => <span className={className}>{formatNaira(kobo)}</span>;

const tone: Record<string, string> = {
  green: "bg-brand-light text-brand-dark",
  amber: "bg-spark-light text-[#8A5A00]",
  red: "bg-danger-light text-danger",
  slate: "bg-slate-100 text-ink-soft",
  blue: "bg-sky-50 text-sky-800",
};
const statusTone: Record<string, keyof typeof tone> = {
  APPROVED: "green", POSTED: "green", PAID: "green", ACTIVE: "green", CLOSED: "slate", RECONCILED: "green",
  PENDING: "amber", PENDING_APPROVAL: "amber", SUBMITTED: "amber", IN_REVIEW: "blue", UNDER_ASSESSMENT: "blue", PROCESSING: "blue",
  OFFER_ACCEPTED: "blue", DISBURSED: "blue", DUE: "slate", PARTIAL: "amber", NOT_STARTED: "slate",
  REJECTED: "red", FAILED: "red", DECLINED: "red", IN_ARREARS: "red", OVERDUE: "red", WRITTEN_OFF: "red", REVERSED: "slate",
};
export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[statusTone[status] ?? "slate"]}`}>
      {label ?? humanize(status)}
    </span>
  );
}
export const humanize = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function Stat({ label, value, sub, warn }: { label: string; value: React.ReactNode; sub?: React.ReactNode; warn?: boolean }) {
  return (
    <div className={`card ${warn ? "border-danger/40 bg-danger-light/40" : ""}`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

export function Flash({ searchParams }: { searchParams?: { ok?: string; err?: string } }) {
  if (searchParams?.err)
    return <div data-flash="err" role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">{searchParams.err}</div>;
  if (searchParams?.ok)
    return <div data-flash="ok" role="status" className="mb-4 rounded-xl border border-brand/30 bg-brand-light px-4 py-3 text-sm text-brand-dark">{searchParams.ok}</div>;
  return null;
}

export const fmtDate = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(d) : "—");
export const fmtDateTime = (d: Date) => new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(d);
export const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-muted">{children}</div>}
    </div>
  );
}
