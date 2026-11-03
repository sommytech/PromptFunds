import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { logoutAction } from "../_actions";
import { MemberNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.member) redirect("/admin");
  const approved = user.member.kycStatus === "APPROVED";
  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard"><Logo /></Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-muted sm:inline">Hi, {user.member.firstName}</span>
            <form action={logoutAction}><button className="btn btn-ghost btn-sm">Log out</button></form>
          </div>
        </div>
        {approved && <div className="mx-auto hidden max-w-5xl px-4 md:block"><MemberNav variant="top" /></div>}
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
      {approved && <MemberNav variant="bottom" />}
    </div>
  );
}
