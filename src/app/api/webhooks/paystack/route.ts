export const dynamic = "force-dynamic";
import { handle, json, problem } from "@/lib/http";
import { verifyPaystackSignature } from "@/lib/providers/payments";
import { creditDeposit } from "@/services/deposits";
import { failWithdrawal, markPaid } from "@/services/withdrawals";
import { confirmDisbursement, reverseDisbursement } from "@/services/loans";
import { db } from "@/lib/db";

/**
 * Paystack events. Signature = HMAC-SHA512(raw body, secret key). Every handler is idempotent,
 * because Paystack retries until it receives 200.
 *  - charge.success via dedicated_nuban  -> member deposit
 *  - transfer.success / failed / reversed -> withdrawal or loan disbursement outcome
 */
type Evt = {
  event: string;
  data: {
    reference: string;
    amount: number;
    status?: string;
    reason?: string;
    channel?: string;
    authorization?: { channel?: string; receiver_bank_account_number?: string };
    customer?: { customer_code?: string };
  };
};

export const POST = handle(async (req: Request) => {
  const raw = await req.text();
  if (!verifyPaystackSignature(raw, req.headers.get("x-paystack-signature"))) return problem(401, "Invalid signature");
  const evt = JSON.parse(raw) as Evt;
  const d = evt.data;

  if (evt.event === "charge.success" && (d.channel === "dedicated_nuban" || d.authorization?.channel === "dedicated_nuban")) {
    // Defence in depth: re-verify the transaction with Paystack before crediting.
    const v = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(d.reference)}`, {
      headers: { authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      cache: "no-store",
    }).then((r) => r.json() as Promise<{ data?: { status: string; amount: number } }>);
    if (v.data?.status !== "success" || v.data.amount !== d.amount) return problem(422, "Verification mismatch");
    const r = await creditDeposit({
      virtualAccountNumber: d.authorization?.receiver_bank_account_number,
      providerCustomerRef: d.customer?.customer_code,
      providerReference: d.reference,
      amountKobo: BigInt(d.amount),
      channel: "dedicated_nuban",
      raw: evt,
    });
    return json({ ok: true, duplicate: r.duplicate });
  }

  if (evt.event.startsWith("transfer.")) {
    const [kind, id] = d.reference.split("_");
    const success = evt.event === "transfer.success";
    if (kind === "wd") {
      const wd = await db.withdrawal.findUnique({ where: { id } });
      if (!wd) return json({ ok: true, ignored: true });
      if (success) await markPaid(wd.id, wd.memberId, wd.amountKobo, d.reference);
      else await failWithdrawal(wd.id, d.reason ?? evt.event);
    } else if (kind === "ln") {
      if (success) await confirmDisbursement(id);
      else await reverseDisbursement(id, d.reason ?? evt.event);
    }
    return json({ ok: true });
  }
  return json({ ok: true, ignored: evt.event });
});
