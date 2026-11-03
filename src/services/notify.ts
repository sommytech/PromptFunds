import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

/**
 * In-app notification (always) + outbound channel hook.
 * Wire SMS (Termii) / email (Resend) in deliver(); keep it out of DB transactions.
 */
export async function notify(memberId: string, subject: string, body: string, tx: Tx | typeof db = db) {
  return tx.notification.create({ data: { memberId, channel: "IN_APP", subject, body, sentAt: new Date() } });
}
