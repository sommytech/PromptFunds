import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { humanize } from "@/components/ui";
import { logoutAction } from "../_actions";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/members", label: "Members & KYC" },
  { href: "/admin/withdrawals", label: "Withdrawals" },
  { href: "/admin/loans", label: "Loans" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/operations", label: "Operations" },
  { href: "/admin/audit", label: "Audit trail" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "MEMBER") redirect("/dashboard");
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="bg-ink text-slate-300 md:min-h-screen">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <Logo light />
          <p className="mt-0 text-xs text-slate-400 md:mt-2">Admin · {humanize(user.role)}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm md:flex-col md:pb-0">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-white/10 hover:text-white">{n.label}</Link>
          ))}
        </nav>
        <form action={logoutAction} className="hidden px-6 py-6 md:block"><button className="text-sm text-slate-400 hover:text-white">Log out ({user.email})</button></form>
      </aside>
      <div className="px-4 py-6 md:px-8">{children}</div>
    </div>
  );
}
