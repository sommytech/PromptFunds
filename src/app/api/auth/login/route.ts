export const dynamic = "force-dynamic";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, problem } from "@/lib/http";
import { createSession, verifyPassword } from "@/lib/auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
const MAX_FAILS = 5;

export const POST = handle(async (req: Request) => {
  const { email, password } = schema.parse(await req.json());
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return problem(401, "Invalid credentials");
  if (user.lockedUntil && user.lockedUntil > new Date()) return problem(429, "Account temporarily locked");

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    const fails = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + 15 * 60_000) : null },
    });
    return problem(401, "Invalid credentials");
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await createSession(user.id, req.headers.get("x-forwarded-for") ?? undefined, req.headers.get("user-agent") ?? undefined);
  return json({ ok: true, role: user.role });
});
