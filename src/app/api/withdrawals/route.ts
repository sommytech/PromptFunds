export const dynamic = "force-dynamic";
import { z } from "zod";
import { handle, json, problem } from "@/lib/http";
import { requireApprovedMember } from "@/lib/auth";
import { nairaToKobo } from "@/lib/money";
import { requestWithdrawal } from "@/services/withdrawals";

const schema = z.object({ amount: z.string().regex(/^\d+(\.\d{1,2})?$/) });

export const POST = handle(async (req: Request) => {
  const { user, member } = await requireApprovedMember();
  const key = req.headers.get("idempotency-key");
  if (!key) return problem(400, "Idempotency-Key header required");
  const { amount } = schema.parse(await req.json());
  const wd = await requestWithdrawal(member.id, user.id, nairaToKobo(amount), `${member.id}:${key}`);
  return json(wd, { status: 201 });
});
