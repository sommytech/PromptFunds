import { db } from "@/lib/db";
import { dailyAccrualMicroKobo, microToKobo } from "@/lib/interest";
import { ACCOUNTS, memberAccountCode, postEntry } from "@/lib/ledger";
import { formatNaira } from "@/lib/money";
import { notify } from "./notify";

const CHUNK = 500; // keyset-paginated batches keep memory flat at any member count

export async function currentPolicy(at = new Date()) {
  return db.interestPolicy.findFirst({ where: { effectiveFrom: { lte: at } }, orderBy: { effectiveFrom: "desc" } });
}

/** Record today's accrual for each eligible wallet. Unique (memberId, date) makes re-runs safe. */
export async function accrue(date = new Date()) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const policy = await currentPolicy(day);
  if (!policy) return { accrued: 0, note: "No interest policy in effect" };
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const wallets = await db.wallet.findMany({
      take: CHUNK,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, memberId: true, balanceKobo: true },
    });
    if (wallets.length === 0) break;
    cursor = wallets[wallets.length - 1].id;
    const data = wallets
      .filter((w) => w.balanceKobo > 0n && w.balanceKobo >= policy.minBalanceKobo)
      .map((w) => ({ memberId: w.memberId, accrualDate: day, balanceKobo: w.balanceKobo, accruedMicroKobo: dailyAccrualMicroKobo(w.balanceKobo, policy.annualRateBps, policy.dayCount) }));
    if (data.length) count += (await db.interestAccrual.createMany({ data, skipDuplicates: true })).count;
  }
  return { accrued: count, date: day.toISOString().slice(0, 10) };
}

/** Month-end: credit uncredited accruals as ledger entries (Dr interest expense, Cr member savings). */
export async function credit() {
  const members = await db.interestAccrual.groupBy({ by: ["memberId"], where: { creditedEntryId: null } });
  let credited = 0;
  for (const { memberId } of members) {
    await db.$transaction(async (tx) => {
      const rows = await tx.interestAccrual.findMany({ where: { memberId, creditedEntryId: null }, orderBy: { accrualDate: "asc" } });
      const kobo = microToKobo(rows.reduce((a, r) => a + r.accruedMicroKobo, 0n));
      if (kobo <= 0n) return;
      const entry = await postEntry(tx, {
        idempotencyKey: `interest:${memberId}:${rows[0].id}:${rows.length}`,
        reference: `INT-${memberId.slice(-8)}-${rows[rows.length - 1].accrualDate.toISOString().slice(0, 10)}`,
        txType: "INTEREST_CREDIT",
        description: "Savings interest credit",
        lines: [
          { accountCode: ACCOUNTS.INTEREST_EXPENSE, debit: kobo },
          { accountCode: memberAccountCode(memberId), credit: kobo },
        ],
      });
      await tx.interestAccrual.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { creditedEntryId: entry.id } });
      await tx.transaction.create({
        data: { memberId, type: "INTEREST_CREDIT", status: "POSTED", amountKobo: kobo, reference: entry.reference, narration: "Interest credit", entryId: entry.id, settledAt: new Date() },
      });
      await tx.wallet.update({ where: { memberId }, data: { balanceKobo: { increment: kobo }, interestEarnedKobo: { increment: kobo }, version: { increment: 1 } } });
      await notify(memberId, "Interest credited", `${formatNaira(kobo)} interest has been added to your savings.`, tx);
      credited++;
    });
  }
  return { credited };
}

/** Accrued but not yet credited interest for a member, in kobo (for the dashboard). */
export async function pendingInterest(memberId: string) {
  const s = await db.interestAccrual.aggregate({ where: { memberId, creditedEntryId: null }, _sum: { accruedMicroKobo: true } });
  return microToKobo(s._sum.accruedMicroKobo ?? 0n);
}
