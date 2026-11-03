import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ACCOUNTS, memberAccountCode, postEntry } from "@/lib/ledger";
import { formatNaira } from "@/lib/money";
import { notify } from "./notify";

/**
 * Handle a confirmed provider credit to a member's virtual account.
 * Idempotent on providerReference: replays create no duplicate entries.
 */
export async function creditDeposit(params: { virtualAccountNumber?: string; providerCustomerRef?: string; providerReference: string; amountKobo: bigint; channel: string; raw?: unknown }) {
  if (params.amountKobo <= 0n) throw new Error("Invalid amount");

  const va = params.virtualAccountNumber
    ? await db.virtualAccount.findUnique({ where: { accountNumber: params.virtualAccountNumber } })
    : params.providerCustomerRef
      ? await db.virtualAccount.findFirst({ where: { providerCustomerRef: params.providerCustomerRef } })
      : null;
  if (!va) throw new Error("Unknown virtual account");

  return db.$transaction(async (tx) => {
    const existing = await tx.deposit.findUnique({ where: { providerReference: params.providerReference } });
    if (existing) return { duplicate: true as const, deposit: existing };

    const deposit = await tx.deposit.create({
      data: {
        memberId: va.memberId,
        providerReference: params.providerReference,
        amountKobo: params.amountKobo,
        channel: params.channel,
        status: "RECONCILED", // provider-confirmed; daily reconciliation job verifies against settlement file
        rawPayload: params.raw as object | undefined,
        reconciledAt: new Date(),
      },
    });

    const entry = await postEntry(tx, {
      idempotencyKey: `deposit:${params.providerReference}`,
      reference: `DEP-${params.providerReference}`,
      txType: "DEPOSIT",
      description: "Deposit via virtual account",
      lines: [
        { accountCode: ACCOUNTS.BANK_COLLECTIONS, debit: params.amountKobo },
        { accountCode: memberAccountCode(va.memberId), credit: params.amountKobo },
      ],
    });

    await tx.transaction.create({
      data: {
        memberId: va.memberId,
        type: "DEPOSIT",
        status: "POSTED",
        amountKobo: params.amountKobo,
        reference: `DEP-${params.providerReference}`,
        narration: "Deposit",
        entryId: entry.id,
        settledAt: new Date(),
      },
    });
    await tx.deposit.update({ where: { id: deposit.id }, data: { status: "POSTED" } });
    await tx.wallet.update({
      where: { memberId: va.memberId },
      data: {
        balanceKobo: { increment: params.amountKobo },
        totalDepositsKobo: { increment: params.amountKobo },
        version: { increment: 1 },
      },
    });
    await audit({ action: "DEPOSIT_POSTED", entityType: "Deposit", entityId: deposit.id, after: { amountKobo: params.amountKobo } }, tx);
    await notify(va.memberId, "Deposit received", `${formatNaira(params.amountKobo)} has been added to your savings.`, tx);
    return { duplicate: false as const, deposit };
  });
}
