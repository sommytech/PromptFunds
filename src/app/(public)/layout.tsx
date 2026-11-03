import Link from "next/link";
import { Logo } from "@/components/Logo";

const nav = [
  { href: "/savings", label: "Savings" },
  { href: "/loans-info", label: "Loans" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="Prompt Funds home"><Logo /></Link>
          <nav className="hidden gap-6 text-sm font-medium text-ink-soft md:flex">
            {nav.map((n) => <Link key={n.href} href={n.href} className="hover:text-brand">{n.label}</Link>)}
          </nav>
          <div className="flex gap-2">
            <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
            <Link href="/register" className="btn btn-primary btn-sm">Join free</Link>
          </div>
        </div>
        <nav className="flex justify-around border-t border-slate-100 py-2 text-sm font-medium text-ink-soft md:hidden">
          {nav.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-ink text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
          <div>
            <Logo light />
            <p className="mt-3 text-sm text-slate-400">Member savings and fair loans, on your phone.</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-white">Platform</p>
            <ul className="mt-2 space-y-1.5">
              {nav.map((n) => <li key={n.href}><Link href={n.href} className="hover:text-white">{n.label}</Link></li>)}
            </ul>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            Prompt Funds provides savings and loan services to its registered members only. We do not provide transfers to
            other people or other banks: withdrawals and loan disbursements are paid only to your own verified bank account.
            Savings are not insured by the NDIC. Interest rates and loan terms are set by our approved policies and may change with notice.
          </p>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} Prompt Funds</p>
      </footer>
    </div>
  );
}
