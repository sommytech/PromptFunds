"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) {
      const { role } = await res.json();
      router.push(role === "MEMBER" ? "/dashboard" : "/admin");
      router.refresh();
    } else setError((await res.json()).title ?? "Login failed");
  }
  return (
    <form onSubmit={onSubmit} className="card mt-6 space-y-4">
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" autoComplete="email" /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required className="input" autoComplete="current-password" /></div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button disabled={busy} className="btn btn-primary w-full">{busy ? "Logging in…" : "Log in"}</button>
    </form>
  );
}
