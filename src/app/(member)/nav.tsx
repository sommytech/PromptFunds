"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Home", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/wallet", label: "Savings", icon: "M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2" },
  { href: "/loans", label: "Loans", icon: "M12 3v18M7 7h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" },
  { href: "/transactions", label: "History", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/profile", label: "Profile", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0" },
];

export function MemberNav({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const active = (h: string) => path === h || (h !== "/dashboard" && path.startsWith(h));
  if (variant === "top")
    return (
      <nav className="flex gap-6 text-sm font-medium">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={`border-b-2 py-3 ${active(i.href) ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink"}`}>
            {i.label}
          </Link>
        ))}
      </nav>
    );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active(i.href) ? "text-brand" : "text-ink-muted"}`}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={i.icon} /></svg>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
