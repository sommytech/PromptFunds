import { createHash } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

type Tx = Prisma.TransactionClient;

export async function audit(
  params: { actorId?: string; action: string; entityType: string; entityId?: string; before?: unknown; after?: unknown; ip?: string },
  tx: Tx | typeof db = db
) {
  // Serialise writers so the hash chain cannot fork under concurrency (transaction-scoped lock).
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(727274)`;
  const last = await tx.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { hash: true } });
  const prevHash = last?.hash ?? null;
  const payload = JSON.stringify({ ...params, prevHash, t: Date.now() }, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  const hash = createHash("sha256").update(payload).digest("hex");
  return tx.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before as Prisma.InputJsonValue | undefined,
      after: params.after as Prisma.InputJsonValue | undefined,
      ip: params.ip,
      prevHash,
      hash,
    },
  });
}
