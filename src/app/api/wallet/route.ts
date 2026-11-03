export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/http";
import { requireApprovedMember } from "@/lib/auth";

export const GET = handle(async () => {
  const { member } = await requireApprovedMember();
  const [wallet, pending, loans, va] = await Promise.all([
    db.wallet.findUniqueOrThrow({ where: { memberId: member.id } }),
    db.transaction.findMany({ where: { memberId: member.id, status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.loan.findMany({ where: { memberId: member.id, status: { in: ["ACTIVE", "DISBURSED", "IN_ARREARS"] } }, select: { id: true, outstandingPrincipalKobo: true, status: true } }),
    db.virtualAccount.findUnique({ where: { memberId: member.id } }),
  ]);
  return json({
    membershipNumber: member.membershipNumber,
    totalBalanceKobo: wallet.balanceKobo,
    availableKobo: wallet.balanceKobo - wallet.heldKobo,
    totalDepositsKobo: wallet.totalDepositsKobo,
    totalWithdrawalsKobo: wallet.totalWithdrawalsKobo,
    interestEarnedKobo: wallet.interestEarnedKobo,
    pending,
    loans,
    depositAccount: va && { bankName: va.bankName, accountNumber: va.accountNumber, accountName: va.accountName },
  });
});
