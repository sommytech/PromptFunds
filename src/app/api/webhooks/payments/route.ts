export const dynamic = "force-dynamic";
import { z } from "zod";
import { handle, json, problem } from "@/lib/http";
import { verifyWebhookSignature } from "@/lib/providers/payments";
import { creditDeposit } from "@/services/deposits";

const schema = z.object({
  event: z.literal("deposit.confirmed"),
  reference: z.string().min(4),
  accountNumber: z.string().min(10),
  // Generic signed webhook (mock provider / other partners). Paystack uses /api/webhooks/paystack.
  amountKobo: z.string().regex(/^\d+$/),
  channel: z.string().default("bank_transfer"),
});

// Raw body is needed for signature verification.
export const POST = handle(async (req: Request) => {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-signature"))) return problem(401, "Invalid signature");
  const p = schema.parse(JSON.parse(raw));
  const r = await creditDeposit({
    virtualAccountNumber: p.accountNumber,
    providerReference: p.reference,
    amountKobo: BigInt(p.amountKobo),
    channel: p.channel,
    raw: p,
  });
  return json({ ok: true, duplicate: r.duplicate });
});
