import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/auth";
import { ACCOUNTS, memberAccountCode, postEntry } from "@/lib/ledger";
import { getPaymentProvider } from "@/lib/providers/payments";
import { POLICY } from "@/lib/policy";
import { notify } from "./notify";

const DUAL_APPROVAL_THRESHOLD_KOBO = POLICY.dualApprovalThresholdKobo;

/** Member requests withdrawal. Row-locks the wallet so parallel requests cannot overdraw. */
export async function requestWithdrawal(memberId: string, userId: string, amountKobo: bigint, idempotencyKey: string) {
  if (amountKobo <= 0n) throw new HttpError(422, "Amount must be positive");
  const arrears = await db.loan.count({ where: { memberId, status: "IN_ARREARS" } });
  if (arrears > 0) throw new HttpError(422, "Please clear your overdue loan repayment before withdrawing");

  return db.$transaction(async (tx) => {
    const dup = await tx.withdrawal.findUnique({ where: { idempotencyKey } });
    if (dup) return dup;

    const bank = await tx.bankAccount.findUnique({ where: { memberId } });
    if (!bank || !bank.nameMatched) throw new HttpError(422, "Verified bank account required");

    // Pessimistic lock on the wallet row
    const rows = await tx.$queryRaw<{ balanceKobo: bigint; heldKobo: bigint }[]>`
      SELECT "balanceKobo", "heldKobo" FROM "Wallet" WHERE "memberId" = ${memberId} FOR UPDATE`;
    const w = rows[0];
    if (!w) throw new HttpError(404, "Wallet not found");
    const available = w.balanceKobo - w.heldKobo;
    if (amountKobo > available) throw new HttpError(422, "Insufficient available balance");

    await tx.wallet.update({ where: { memberId }, data: { heldKobo: { increment: amountKobo }, version: { increment: 1 } } });
    const wd = await tx.withdrawal.create({ data: { memberId, amountKobo, idempotencyKey, makerId: userId } });
    await tx.transaction.create({
      data: { memberId, type: "WITHDRAWAL", status: "PENDING", amountKobo, reference: `WD-${wd.id}`, narration: "Withdrawal request" },
    });
    await audit({ actorId: userId, action: "WITHDRAWAL_REQUESTED", entityType: "Withdrawal", entityId: wd.id, after: { amountKobo } }, tx);
    return wd;
  });
}

/** Staff approval (checker). Must differ from any prior approver; large amounts need an approver role. */
export async function approveWithdrawal(withdrawalId: string, approverId: string, approverRole: string) {
  if (!["FINANCE_OFFICER", "FINANCE_APPROVER", "ADMIN"].includes(approverRole)) throw new HttpError(403, "Finance role required");
  const wd = await db.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId }, include: { member: { include: { bankAccount: true } } } });
  if (wd.status !== "PENDING_APPROVAL") throw new HttpError(409, "Withdrawal not pending");
  if (wd.makerId === approverId) throw new HttpError(403, "Maker cannot approve own request");
  if (wd.amountKobo >= DUAL_APPROVAL_THRESHOLD_KOBO && approverRole !== "FINANCE_APPROVER" && approverRole !== "ADMIN")
    throw new HttpError(403, "Finance approver required for this amount");

  const bank = wd.member.bankAccount;
  if (!bank || !bank.nameMatched) throw new HttpError(422, "Payout account not verified");

  await db.withdrawal.update({ where: { id: wd.id }, data: { status: "PROCESSING", checkerId: approverId, approvedAt: new Date() } });

  const result = await getPaymentProvider().payout({
    reference: `wd_${wd.id}`,
    amountKobo: wd.amountKobo,
    bankCode: bank.bankCode,
    accountNumber: bank.accountNumber,
    accountName: bank.accountName,
    recipientCode: bank.recipientCode,
    narration: "Prompt Funds savings withdrawal",
  });

  if (result.status === "FAILED") {
    await failWithdrawal(wd.id, result.reason ?? "Payout failed", approverId);
    throw new HttpError(502, "Payout failed; funds released back to the member");
  }

  if (result.status === "PAID") return markPaid(wd.id, wd.memberId, wd.amountKobo, result.providerRef, approverId);
  await db.withdrawal.update({ where: { id: wd.id }, data: { payoutRef: result.providerRef } });
  return db.withdrawal.findUniqueOrThrow({ where: { id: wd.id } });
}

/** Provider reported failure/reversal: release the hold. Safe to call more than once. */
export async function failWithdrawal(withdrawalId: string, reason: string, actorId?: string) {
  return db.$transaction(async (tx) => {
    const wd = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    if (wd.status === "FAILED" || wd.status === "PAID") return wd;
    await tx.wallet.update({ where: { memberId: wd.memberId }, data: { heldKobo: { decrement: wd.amountKobo } } });
    await tx.transaction.update({ where: { reference: `WD-${wd.id}` }, data: { status: "FAILED" } });
    await audit({ actorId, action: "WITHDRAWAL_PAYOUT_FAILED", entityType: "Withdrawal", entityId: wd.id, after: { reason } }, tx);
    await notify(wd.memberId, "Withdrawal not completed", `Your withdrawal could not be paid (${reason}). The money is back in your available balance.`, tx);
    return tx.withdrawal.update({ where: { id: wd.id }, data: { status: "FAILED", failureReason: reason } });
  });
}

export async function markPaid(withdrawalId: string, memberId: string, amountKobo: bigint, providerRef: string, actorId?: string) {
  return db.$transaction(async (tx) => {
    const current = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    if (current.status === "PAID") return current; // webhook replay
    const entry = await postEntry(tx, {
      idempotencyKey: `withdrawal:${withdrawalId}`,
      reference: `WD-${withdrawalId}`,
      txType: "WITHDRAWAL",
      description: "Withdrawal paid to member bank account",
      lines: [
        { accountCode: memberAccountCode(memberId), debit: amountKobo },
        { accountCode: ACCOUNTS.BANK_PAYOUTS, credit: amountKobo },
      ],
      createdBy: actorId,
    });
    await tx.wallet.update({
      where: { memberId },
      data: {
        balanceKobo: { decrement: amountKobo },
        heldKobo: { decrement: amountKobo },
        totalWithdrawalsKobo: { increment: amountKobo },
        version: { increment: 1 },
      },
    });
    await tx.transaction.update({ where: { reference: `WD-${withdrawalId}` }, data: { status: "POSTED", entryId: entry.id, settledAt: new Date() } });
    const wd = await tx.withdrawal.update({ where: { id: withdrawalId }, data: { status: "PAID", paidAt: new Date(), payoutRef: providerRef } });
    await audit({ actorId, action: "WITHDRAWAL_PAID", entityType: "Withdrawal", entityId: withdrawalId, after: { amountKobo } }, tx);
    await notify(memberId, "Withdrawal paid", `Your withdrawal has been paid to your bank account.`, tx);
    return wd;
  });
}

export async function rejectWithdrawal(withdrawalId: string, actorId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const wd = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    if (wd.status !== "PENDING_APPROVAL") throw new HttpError(409, "Withdrawal not pending");
    await tx.wallet.update({ where: { memberId: wd.memberId }, data: { heldKobo: { decrement: wd.amountKobo } } });
    await tx.transaction.update({ where: { reference: `WD-${wd.id}` }, data: { status: "FAILED" } });
    await audit({ actorId, action: "WITHDRAWAL_REJECTED", entityType: "Withdrawal", entityId: wd.id, after: { reason } }, tx);
    await notify(wd.memberId, "Withdrawal declined", reason, tx);
    return tx.withdrawal.update({ where: { id: wd.id }, data: { status: "REJECTED", failureReason: reason, checkerId: actorId } });
  });
}
