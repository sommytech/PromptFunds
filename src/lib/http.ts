import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

/** Wrap route handlers: consistent problem+json errors, no stack leaks. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      // Let Next.js control-flow signals (dynamic usage, redirects, notFound) propagate.
      const digest = (e as { digest?: unknown })?.digest;
      if (typeof digest === "string" && (digest === "DYNAMIC_SERVER_USAGE" || digest.startsWith("NEXT_"))) throw e;
      if (e instanceof HttpError) return problem(e.status, e.message);
      if (e instanceof ZodError) return problem(422, "Validation failed", e.flatten());
      console.error(e);
      return problem(500, "Internal error");
    }
  };
}

export function problem(status: number, title: string, detail?: unknown) {
  return NextResponse.json({ title, status, detail }, { status, headers: { "content-type": "application/problem+json" } });
}

/** BigInt-safe JSON. */
export function json(data: unknown, init?: ResponseInit) {
  return new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}
