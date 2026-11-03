"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Register() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) {
      router.push("/kyc");
      router.refresh();
    } else {
      const p = await res.json();
      const fields = p.detail?.fieldErrors ? Object.entries(p.detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[])[0]}`).join(" · ") : "";
      setError(fields || p.title || "Registration failed");
    }
  }
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="eyebrow">Free membership</p>
      <h1 className="mt-1 text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-ink-soft">No fee. No minimum deposit. Takes about 3 minutes.</p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="firstName">First name</label><input id="firstName" name="firstName" required className="input" autoComplete="given-name" /></div>
          <div><label className="label" htmlFor="lastName">Last name</label><input id="lastName" name="lastName" required className="input" autoComplete="family-name" /></div>
        </div>
        <p className="hint -mt-2">Use the name on your BVN.</p>
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" autoComplete="email" /></div>
        <div><label className="label" htmlFor="phone">Phone number</label><input id="phone" name="phone" type="tel" inputMode="tel" placeholder="0803 123 4567" required className="input" autoComplete="tel" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={10} required className="input" autoComplete="new-password" /><p className="hint">At least 10 characters.</p></div>
        <label className="flex items-start gap-2 text-sm text-ink-soft"><input type="checkbox" required className="mt-1 accent-brand" /> I agree to the membership terms and privacy notice, and understand Prompt Funds does not offer transfers to other people or banks.</label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button disabled={busy} className="btn btn-primary w-full">{busy ? "Creating account…" : "Create free account"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-muted">Already a member? <Link href="/login" className="font-semibold text-brand">Log in</Link></p>
    </div>
  );
}
