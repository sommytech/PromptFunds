export const dynamic = "force-dynamic";
import { z } from "zod";
import { handle, json } from "@/lib/http";
import { registerMember } from "@/services/members";
import { createSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  phone: z.string().transform((v) => v.replace(/[\s-]/g, "")).pipe(z.string().regex(/^\+?\d{10,15}$/, "Enter a valid phone number")),
  password: z.string().min(10).max(128),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
});

export const POST = handle(async (req: Request) => {
  const input = schema.parse(await req.json());
  const { user } = await registerMember(input);
  await createSession(user.id, req.headers.get("x-forwarded-for") ?? undefined, req.headers.get("user-agent") ?? undefined);
  return json({ ok: true, next: "/kyc" }, { status: 201 });
});
