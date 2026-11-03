import Link from "next/link";
import { isDemo } from "@/lib/policy";
import { LoginForm } from "./form";

export const metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default function Login() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-ink-soft">Log in to your Prompt Funds account.</p>
      <LoginForm />
      <p className="mt-4 text-center text-sm text-ink-muted">New here? <Link href="/register" className="font-semibold text-brand">Join free</Link></p>
      {isDemo() && (
        <div className="mt-6 rounded-xl border border-spark/40 bg-spark-light p-4 text-sm text-[#6B4700]">
          <p className="font-semibold">Sandbox mode — demo logins</p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            <li>member: ada@promptfunds.demo</li>
            <li>admin: admin@promptfunds.local</li>
            <li>loan officer: loans@promptfunds.local</li>
            <li>committee: committee@promptfunds.local</li>
            <li>finance: finance@promptfunds.local</li>
          </ul>
          <p className="mt-2 text-xs">Password: the SEED_ADMIN_PASSWORD you set (default <span className="font-mono">ChangeMe-Now-12345</span>).</p>
        </div>
      )}
    </div>
  );
}
