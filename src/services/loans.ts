import { randomBytes } from "crypto";
import type { Loan, LoanProduct, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/auth";
import { ACCOUNTS, memberAccountCode, postEntry } from "@/lib/ledger";
import { flatSchedule, reducingBalanceSchedule, type ScheduleRow } from "@/lib/amortisation";
import { divRoundHalfEven, formatNaira } from "@/lib/money";
import { POLICY } from "@/lib/policy";
import { getPaymentProvider } from "@/lib/providers/payments";
import { notify } from "./notify";

type Tx = Prisma.TransactionClient;
const OPEN: Loan["status"][] = ["SUBMITTED", "UNDER_ASSESSMENT", "APPROVED", "OFFER_ACCEPTED", "DISBURSED", "ACTIVE", "IN_ARREARS"];
const FINANCE = ["FINANCE_OFFICER", "FINANCE_APPROVER", "ADMIN"];
const CREDIT = ["LOAN_OFFICER", "COMMITTEE", "ADMIN"];

export function scheduleFor(p: { principalKobo: bigint; annualRateBps: number; tenorMonths: number; method: "REDUCING_BALANCE" | "FLAT" }): ScheduleRow[] {
  return p.method === "FLAT"
    ? flatSchedule(p.principalKobo, p.annualRateBps, p.tenorMonths)
    : reducingBalanceSchedule(p.principalKobo, p.annualRateBps, p.tenorMonths);
}

export function addMonths(d: Date, n: number) {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return r;
}

/** Automated pre-assessment shown to the credit officer. Each check is explainable to the member. */
export async function assessmentChecks(loan: Loan & { product: LoanProduct }) {
  const [member, wallet, otherOpen, deposits] = await Promise.all([
    db.member.findUniqueOrThrow({ where: { id: loan.memberId } }),
    db.wallet.findUnique({ where: { memberId: loan.memberId } }),
    db.loan.count({ where: { memberId: loan.memberId, status: { in: OPEN }, NOT: { id: loan.id } } }),
    db.deposit.count({ where: { memberId: loan.memberId } }),
  ]);
  const days = member.kycReviewedAt ? Math.floor((Date.now() - member.kycReviewedAt.getTime()) / 86_400_000) : 0;
  const savings = wallet?.balanceKobo ?? 0n;
  const cap = POLICY.maxLoanToSavingsBps ? (savings * BigInt(POLICY.maxLoanToSavingsBps)) / 10_000n : null;
  return [
    { label: "Identity verified", pass: member.kycStatus === "APPROVED", detail: member.membershipNumber ?? "—" },
    { label: `Membership ≥ ${POLICY.minMembershipDaysForLoan} days`, pass: days >= POLICY.minMembershipDaysForLoan, detail: `${days} days` },
    { label: "No other open loan", pass: otherOpen === 0, detail: `${otherOpen} open` },
    { label: `Instalment ≤ ${POLICY.maxAffordabilityBps / 100}% of disposable income`, pass: loan.affordabilityBps !== null && loan.affordabilityBps <= POLICY.maxAffordabilityBps, detail: loan.affordabilityBps === null ? "no income data" : `${(loan.affordabilityBps / 100).toFixed(1)}%` },
    { label: `Loan ≤ ${POLICY.maxLoanToSavingsBps / 10000}× savings`, pass: cap === null || loan.principalKobo <= cap, detail: `savings ${formatNaira(savings)}` },
    { label: "Savings history", pass: deposits >= 1, detail: `${deposits} deposit(s)` },
  ];
}

export async function applyForLoan(
  userId: string,
  memberId: string,
  input: { productId: string; principalKobo: bigint; tenorMonths: number; purpose: string; monthlyIncomeKobo: bigint; monthlyExpensesKobo: bigint }
) {
  const product = await db.loanProduct.findUnique({ where: { id: input.productId } });
  if (!product || !product.active) throw new HttpError(404, "Loan product not available");
  if (input.principalKobo < product.minAmountKobo || input.principalKobo > product.maxAmountKobo)
    throw new HttpError(422, `Amount must be between ${formatNaira(product.minAmountKobo)} and ${formatNaira(product.maxAmountKobo)}`);
  if (input.tenorMonths < product.minTenorMonths || input.tenorMonths > product.maxTenorMonths)
    throw new HttpError(422, `Tenor must be ${product.minTenorMonths}–${product.maxTenorMonths} months`);
  const open = await db.loan.count({ where: { memberId, status: { in: OPEN } } });
  if (open > 0) throw new HttpError(409, "You already have an open loan or application");

  const schedule = scheduleFor({ principalKobo: input.principalKobo, annualRateBps: product.annualRateBps, tenorMonths: input.tenorMonths, method: product.method });
  const instalment = schedule[0].totalKobo;
  const totalInterest = schedule.reduce((a, r) => a + r.interestKobo, 0n);
  const disposable = input.monthlyIncomeKobo - input.monthlyExpensesKobo;
  const affordabilityBps = disposable > 0n ? Number(divRoundHalfEven(instalment * 10_000n, disposable)) : 99_999;
  const fee = divRoundHalfEven(input.principalKobo * BigInt(product.processingFeeBps), 10_000n);

  return db.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        reference: `PF-LN-${randomBytes(4).toString("hex").toUpperCase()}`,
        memberId,
        productId: product.id,
        principalKobo: input.principalKobo,
        tenorMonths: input.tenorMonths,
        annualRateBps: product.annualRateBps,
        method: product.method,
        purpose: input.purpose,
        monthlyIncomeKobo: input.monthlyIncomeKobo,
        monthlyExpensesKobo: input.monthlyExpensesKobo,
        processingFeeKobo: fee,
        totalInterestKobo: totalInterest,
        instalmentKobo: instalment,
        affordabilityBps,
        status: "SUBMITTED",
      },
    });
    await audit({ actorId: userId, action: "LOAN_APPLIED", entityType: "Loan", entityId: loan.id, after: { principalKobo: input.principalKobo, tenor: input.tenorMonths } }, tx);
    await notify(memberId, "Loan application received", `We received your application ${loan.reference}. We'll update you after assessment.`, tx);
    return loan;
  });
}

/** Step 1 (maker): credit officer records assessment and recommendation. */
export async function assessLoan(loanId: string, officerId: string, role: string, notes: string) {
  if (!CREDIT.includes(role)) throw new HttpError(403, "Credit role required");
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (loan.status !== "SUBMITTED") throw new HttpError(409, "Loan is not awaiting assessment");
  return db.$transaction(async (tx) => {
    const l = await tx.loan.update({ where: { id: loanId }, data: { status: "UNDER_ASSESSMENT", assessedBy: officerId, assessmentNotes: notes } });
    await audit({ actorId: officerId, action: "LOAN_ASSESSED", entityType: "Loan", entityId: loanId, after: { notes } }, tx);
    return l;
  });
}

/** Step 2 (checker): a different officer / committee approves. Creates an offer for the member. */
export async function approveLoan(loanId: string, approverId: string, role: string) {
  if (!["COMMITTEE", "ADMIN"].includes(role)) throw new HttpError(403, "Loan committee approval required");
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (loan.status !== "UNDER_ASSESSMENT") throw new HttpError(409, "Loan must be assessed first");
  if (loan.assessedBy === approverId) throw new HttpError(403, "The assessing officer cannot also approve");
  return db.$transaction(async (tx) => {
    const l = await tx.loan.update({ where: { id: loanId }, data: { status: "APPROVED", approvedBy: approverId, approvedAt: new Date() } });
    await audit({ actorId: approverId, action: "LOAN_APPROVED", entityType: "Loan", entityId: loanId }, tx);
    await notify(loan.memberId, "Loan approved — review your offer", `Your loan ${loan.reference} is approved. Open it to review and accept the offer.`, tx);
    return l;
  });
}

export async function declineLoan(loanId: string, actorId: string, role: string, reason: string) {
  if (!CREDIT.includes(role)) throw new HttpError(403, "Credit role required");
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (!["SUBMITTED", "UNDER_ASSESSMENT", "APPROVED"].includes(loan.status)) throw new HttpError(409, "Loan cannot be declined now");
  return db.$transaction(async (tx) => {
    const l = await tx.loan.update({ where: { id: loanId }, data: { status: "DECLINED", declineReason: reason } });
    await audit({ actorId, action: "LOAN_DECLINED", entityType: "Loan", entityId: loanId, after: { reason } }, tx);
    await notify(loan.memberId, "Loan application outcome", `We could not approve ${loan.reference}: ${reason}`, tx);
    return l;
  });
}

/** Member accepts the offer (key facts: amount, fee, rate, total repayable, schedule). */
export async function acceptOffer(userId: string, memberId: string, loanId: string) {
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (loan.memberId !== memberId) throw new HttpError(404, "Loan not found");
  if (loan.status !== "APPROVED") throw new HttpError(409, "No offer to accept");
  return db.$transaction(async (tx) => {
    const l = await tx.loan.update({ where: { id: loanId }, data: { status: "OFFER_ACCEPTED", acceptedAt: new Date() } });
    await audit({ actorId: userId, action: "LOAN_OFFER_ACCEPTED", entityType: "Loan", entityId: loanId }, tx);
    return l;
  });
}

/** Finance disburses to the member's own verified bank account, then books the loan and its schedule. */
export async function disburseLoan(loanId: string, actorId: string, role: string) {
  if (!FINANCE.includes(role)) throw new HttpError(403, "Finance role required");
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId }, include: { member: { include: { bankAccount: true } } } });
  if (loan.status !== "OFFER_ACCEPTED") throw new HttpError(409, "Member has not accepted the offer");
  if (loan.approvedBy === actorId) throw new HttpError(403, "Approver cannot also disburse");
  const bank = loan.member.bankAccount;
  if (!bank || !bank.nameMatched) throw new HttpError(422, "Member has no verified payout account");

  const net = loan.principalKobo - loan.processingFeeKobo;
  const result = await getPaymentProvider().payout({
    reference: `ln_${loan.id}`,
    amountKobo: net,
    bankCode: bank.bankCode,
    accountNumber: bank.accountNumber,
    accountName: bank.accountName,
    recipientCode: bank.recipientCode,
    narration: `Prompt Funds loan ${loan.reference}`,
  });
  if (result.status === "FAILED") throw new HttpError(502, `Disbursement failed: ${result.reason ?? "provider error"}`);

  const now = new Date();
  const rows = scheduleFor({ principalKobo: loan.principalKobo, annualRateBps: loan.annualRateBps, tenorMonths: loan.tenorMonths, method: loan.method });
  return db.$transaction(async (tx) => {
    const lines = [
      { accountCode: ACCOUNTS.LOANS_RECEIVABLE, debit: loan.principalKobo },
      { accountCode: ACCOUNTS.BANK_PAYOUTS, credit: net },
      ...(loan.processingFeeKobo > 0n ? [{ accountCode: ACCOUNTS.FEE_INCOME, credit: loan.processingFeeKobo }] : []),
    ];
    const entry = await postEntry(tx, {
      idempotencyKey: `loan-disburse:${loan.id}`,
      reference: `LN-DISB-${loan.reference}`,
      txType: "LOAN_DISBURSEMENT",
      description: `Loan ${loan.reference} disbursed`,
      lines,
      createdBy: actorId,
    });
    await tx.loanInstalment.createMany({
      data: rows.map((r) => ({ loanId: loan.id, number: r.number, dueDate: addMonths(now, r.number), principalKobo: r.principalKobo, interestKobo: r.interestKobo })),
      skipDuplicates: true,
    });
    await tx.transaction.create({
      data: { memberId: loan.memberId, type: "LOAN_DISBURSEMENT", status: "POSTED", amountKobo: net, reference: entry.reference, narration: `Loan ${loan.reference} paid to ${bank.bankName} ••${bank.accountNumber.slice(-4)}`, entryId: entry.id, settledAt: now },
    });
    const l = await tx.loan.update({
      where: { id: loan.id },
      data: { status: result.status === "PAID" ? "ACTIVE" : "DISBURSED", disbursedAt: now, disbursedBy: actorId, disbursementEntryId: entry.id, outstandingPrincipalKobo: loan.principalKobo, payoutRef: result.providerRef },
    });
    await audit({ actorId, action: "LOAN_DISBURSED", entityType: "Loan", entityId: loan.id, after: { net, fee: loan.processingFeeKobo } }, tx);
    await notify(loan.memberId, "Loan disbursed", `${formatNaira(net)} has been sent to your bank account. First repayment is due ${addMonths(now, 1).toDateString()}.`, tx);
    return l;
  });
}

/** Provider confirmed the disbursement transfer. */
export async function confirmDisbursement(loanId: string) {
  await db.loan.updateMany({ where: { id: loanId, status: "DISBURSED" }, data: { status: "ACTIVE" } });
}

/** Provider reported the disbursement transfer failed: reverse the booking, return to OFFER_ACCEPTED. */
export async function reverseDisbursement(loanId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId } });
    if (loan.status !== "DISBURSED") return loan;
    const net = loan.principalKobo - loan.processingFeeKobo;
    await postEntry(tx, {
      idempotencyKey: `loan-disburse-reversal:${loan.id}:${loan.disbursementEntryId}`,
      reference: `LN-REV-${loan.reference}-${Date.now()}`,
      txType: "REVERSAL",
      description: `Reversal: disbursement of ${loan.reference} failed (${reason})`,
      lines: [
        { accountCode: ACCOUNTS.BANK_PAYOUTS, debit: net },
        ...(loan.processingFeeKobo > 0n ? [{ accountCode: ACCOUNTS.FEE_INCOME, debit: loan.processingFeeKobo }] : []),
        { accountCode: ACCOUNTS.LOANS_RECEIVABLE, credit: loan.principalKobo },
      ],
    });
    await tx.loanInstalment.deleteMany({ where: { loanId } });
    await audit({ action: "LOAN_DISBURSEMENT_REVERSED", entityType: "Loan", entityId: loanId, after: { reason } }, tx);
    return tx.loan.update({ where: { id: loanId }, data: { status: "OFFER_ACCEPTED", outstandingPrincipalKobo: 0n, disbursedAt: null, disbursementEntryId: null, payoutRef: null } });
  });
}

/**
 * Repay from the member's savings wallet. Allocation: oldest instalment first, interest before principal.
 * Idempotent per key; locks the wallet row so it can't race a withdrawal.
 */
export async function repayFromWallet(memberId: string, loanId: string, requestedKobo: bigint, key: string, source: "WALLET" | "AUTO_DEBIT" = "WALLET", actorId?: string) {
  if (requestedKobo <= 0n) throw new HttpError(422, "Amount must be positive");
  return db.$transaction(async (tx) => {
    const idem = `loan-repay:${loanId}:${key}`;
    if (await tx.ledgerEntry.findUnique({ where: { idempotencyKey: idem } })) return null;

    const rows = await tx.$queryRaw<{ balanceKobo: bigint; heldKobo: bigint }[]>`
      SELECT "balanceKobo", "heldKobo" FROM "Wallet" WHERE "memberId" = ${memberId} FOR UPDATE`;
    if (!rows[0]) throw new HttpError(404, "Wallet not found");
    const available = rows[0].balanceKobo - rows[0].heldKobo;

    const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId }, include: { instalments: { orderBy: { number: "asc" } } } });
    if (loan.memberId !== memberId) throw new HttpError(404, "Loan not found");
    if (!["ACTIVE", "IN_ARREARS", "DISBURSED"].includes(loan.status)) throw new HttpError(409, "Loan is not repayable");

    const open = loan.instalments.filter((i) => i.status !== "PAID");
    const outstanding = open.reduce((a, i) => a + i.principalKobo + i.interestKobo - i.paidKobo, 0n);
    let amount = requestedKobo > outstanding ? outstanding : requestedKobo;
    if (amount > available) {
      if (source === "AUTO_DEBIT") amount = available;
      else throw new HttpError(422, `Insufficient available savings (${formatNaira(available)})`);
    }
    if (amount <= 0n) return null;

    let left = amount, pTotal = 0n, iTotal = 0n;
    for (const inst of open) {
      if (left <= 0n) break;
      const due = inst.principalKobo + inst.interestKobo - inst.paidKobo;
      const take = left < due ? left : due;
      const interestPaid = inst.paidKobo < inst.interestKobo ? inst.paidKobo : inst.interestKobo;
      const interestDue = inst.interestKobo - interestPaid;
      const iPart = take < interestDue ? take : interestDue;
      pTotal += take - iPart;
      iTotal += iPart;
      left -= take;
      const fullyPaid = take === due;
      await tx.loanInstalment.update({
        where: { id: inst.id },
        data: { paidKobo: { increment: take }, status: fullyPaid ? "PAID" : "PARTIAL", ...(fullyPaid ? { daysOverdue: 0 } : {}) },
      });
    }

    const entry = await postEntry(tx, {
      idempotencyKey: idem,
      reference: `LN-RPY-${loan.reference}-${Date.now()}`,
      txType: "LOAN_REPAYMENT",
      description: `Repayment of ${loan.reference} from savings`,
      lines: [
        { accountCode: memberAccountCode(memberId), debit: amount },
        ...(pTotal > 0n ? [{ accountCode: ACCOUNTS.LOANS_RECEIVABLE, credit: pTotal }] : []),
        ...(iTotal > 0n ? [{ accountCode: ACCOUNTS.LOAN_INTEREST_INCOME, credit: iTotal }] : []),
      ],
      createdBy: actorId,
    });
    await tx.wallet.update({ where: { memberId }, data: { balanceKobo: { decrement: amount }, version: { increment: 1 } } });
    await tx.loanRepayment.create({ data: { loanId, amountKobo: amount, principalKobo: pTotal, interestKobo: iTotal, source, entryId: entry.id } });
    await tx.transaction.create({
      data: { memberId, type: "LOAN_REPAYMENT", status: "POSTED", amountKobo: amount, reference: entry.reference, narration: `${source === "AUTO_DEBIT" ? "Auto-debit" : "Repayment"} · ${loan.reference}`, entryId: entry.id, settledAt: new Date() },
    });

    const remaining = await tx.loanInstalment.findMany({ where: { loanId, status: { not: "PAID" } } });
    const closed = remaining.length === 0;
    const stillOverdue = remaining.some((i) => i.status === "OVERDUE" || (i.daysOverdue > POLICY.arrearsGraceDays && i.paidKobo < i.principalKobo + i.interestKobo));
    await tx.loan.update({
      where: { id: loanId },
      data: { outstandingPrincipalKobo: { decrement: pTotal }, status: closed ? "CLOSED" : stillOverdue ? "IN_ARREARS" : "ACTIVE" },
    });
    await audit({ actorId, action: "LOAN_REPAID", entityType: "Loan", entityId: loanId, after: { amount, principal: pTotal, interest: iTotal, source } }, tx);
    await notify(memberId, closed ? "Loan fully repaid 🎉" : "Repayment received", closed ? `${loan.reference} is now closed. Thank you!` : `${formatNaira(amount)} applied to ${loan.reference}.`, tx);
    return { amount, principal: pTotal, interest: iTotal, closed };
  });
}

/** Daily: auto-debit due instalments from available savings, then flag arrears. Chunked by loan. */
export async function runArrears(asOf = new Date()) {
  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const dayKey = today.toISOString().slice(0, 10);
  const due = await db.loanInstalment.findMany({
    where: { dueDate: { lte: today }, status: { in: ["DUE", "PARTIAL", "OVERDUE"] }, loan: { status: { in: ["ACTIVE", "IN_ARREARS"] } } },
    select: { id: true, loanId: true, dueDate: true, principalKobo: true, interestKobo: true, paidKobo: true, loan: { select: { memberId: true } } },
    orderBy: { dueDate: "asc" },
  });
  const byLoan = new Map<string, typeof due>();
  for (const i of due) byLoan.set(i.loanId, [...(byLoan.get(i.loanId) ?? []), i]);

  let debited = 0, flagged = 0;
  for (const [loanId, insts] of byLoan) {
    const owed = insts.reduce((a, i) => a + i.principalKobo + i.interestKobo - i.paidKobo, 0n);
    // Key on day + amount owed: a crash-retry is idempotent, but a re-run after the member tops up collects again.
    const r = await repayFromWallet(insts[0].loan.memberId, loanId, owed, `auto-${dayKey}-${owed}`, "AUTO_DEBIT").catch(() => null);
    if (r) debited++;
    const still = await db.loanInstalment.findMany({ where: { loanId, dueDate: { lte: today }, status: { not: "PAID" } } });
    for (const i of still) {
      const days = Math.floor((today.getTime() - i.dueDate.getTime()) / 86_400_000);
      await db.loanInstalment.update({ where: { id: i.id }, data: { daysOverdue: days, status: days > POLICY.arrearsGraceDays ? "OVERDUE" : i.status } });
    }
    if (still.some((i) => Math.floor((today.getTime() - i.dueDate.getTime()) / 86_400_000) > POLICY.arrearsGraceDays)) {
      const l = await db.loan.update({ where: { id: loanId }, data: { status: "IN_ARREARS" } });
      await notify(l.memberId, "Repayment overdue", `A repayment on ${l.reference} is overdue. Please add savings so we can collect it.`);
      flagged++;
    }
  }
  return { loansChecked: byLoan.size, debited, flagged };
}

export async function loanBalances(loanId: string, tx: Tx | typeof db = db) {
  const insts = await tx.loanInstalment.findMany({ where: { loanId }, orderBy: { number: "asc" } });
  const outstanding = insts.reduce((a, i) => a + i.principalKobo + i.interestKobo - i.paidKobo, 0n);
  const next = insts.find((i) => i.status !== "PAID");
  return { insts, outstanding, next };
}
