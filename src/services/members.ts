import { db } from "@/lib/db";
import { hashPassword, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { memberAccountCode } from "@/lib/ledger";
import { getPaymentProvider } from "@/lib/providers/payments";
import { getKycProvider } from "@/lib/providers/kyc";
import { encryptField, identityHash } from "@/lib/crypto";
import { bankName } from "@/lib/banks";
import { notify } from "./notify";

export async function registerMember(input: { email: string; phone: string; password: string; firstName: string; lastName: string }) {
  const email = input.email.toLowerCase().trim();
  const phone = normalisePhone(input.phone);
  const exists = await db.user.findFirst({ where: { OR: [{ email }, { phone }] }, select: { id: true } });
  if (exists) throw new HttpError(409, "An account with this email or phone already exists");
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, phone, passwordHash, role: "MEMBER", status: "PENDING" } });
    const member = await tx.member.create({
      data: {
        userId: user.id,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        searchText: `${input.firstName} ${input.lastName} ${phone} ${email}`.toLowerCase(),
      },
    });
    await audit({ actorId: user.id, action: "MEMBER_REGISTERED", entityType: "Member", entityId: member.id }, tx);
    return { user, member };
  });
}

export function normalisePhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("234")) return d;
  if (d.startsWith("0")) return "234" + d.slice(1);
  return d;
}

/** Member submits identity + payout bank details. BVN is checked electronically, encrypted at rest. */
export async function submitKyc(
  userId: string,
  input: { dateOfBirth: string; address: string; bvn: string; nin?: string; bankCode: string; accountNumber: string }
) {
  const member = await db.member.findUniqueOrThrow({ where: { userId }, include: { user: true } });
  if (member.kycStatus === "APPROVED") throw new HttpError(409, "Already verified");

  const bvnHash = identityHash(input.bvn);
  const dupe = await db.member.findFirst({ where: { bvnHash, NOT: { id: member.id } }, select: { id: true } });
  if (dupe) throw new HttpError(409, "This BVN is already linked to another membership");

  const dob = new Date(input.dateOfBirth);
  const age = (Date.now() - dob.getTime()) / (365.25 * 86_400_000);
  if (!(age >= 18)) throw new HttpError(422, "Members must be 18 or older");

  const result = await getKycProvider().verifyBvn({ bvn: input.bvn, firstName: member.firstName, lastName: member.lastName, dateOfBirth: input.dateOfBirth });

  // Own-account rule: payout account name must match the member (name enquiry).
  const provider = getPaymentProvider();
  const resolved = await provider.resolveAccount(input.bankCode, input.accountNumber);
  const memberName = `${member.firstName} ${member.lastName}`;
  const accountName = resolved.accountName || memberName.toUpperCase();
  const nameMatched = namesMatch(accountName, memberName);

  await db.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: member.id },
      data: {
        dateOfBirth: dob,
        address: input.address,
        bvnEncrypted: encryptField(input.bvn),
        bvnHash,
        ninEncrypted: input.nin ? encryptField(input.nin) : null,
        kycStatus: result.matched && nameMatched ? "IN_REVIEW" : "SUBMITTED",
        kycProviderRef: result.providerRef,
        kycMatchScore: result.score,
        kycRejectReason: result.matched ? (nameMatched ? null : "Bank account name does not match your name") : result.reason,
      },
    });
    await tx.bankAccount.upsert({
      where: { memberId: member.id },
      create: { memberId: member.id, bankCode: input.bankCode, bankName: bankName(input.bankCode), accountNumber: input.accountNumber, accountName, nameMatched, verifiedAt: nameMatched ? new Date() : null },
      update: { bankCode: input.bankCode, bankName: bankName(input.bankCode), accountNumber: input.accountNumber, accountName, nameMatched, verifiedAt: nameMatched ? new Date() : null, recipientCode: null },
    });
    await audit({ actorId: userId, action: "KYC_SUBMITTED", entityType: "Member", entityId: member.id, after: { score: result.score, nameMatched } }, tx);
  });

  if (result.matched && nameMatched && process.env.KYC_AUTO_APPROVE === "true") await approveKyc(member.id, userId);
  return { matched: result.matched, nameMatched, reason: result.reason };
}

function namesMatch(accountName: string, memberName: string) {
  const tokens = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  const acct = new Set(tokens(accountName));
  const mine = tokens(memberName);
  return mine.filter((t) => acct.has(t)).length >= Math.min(2, mine.length);
}

/** Approve KYC: issue unique membership number, create ledger account + wallet + deposit account. */
export async function approveKyc(memberId: string, officerId: string) {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, include: { user: true, bankAccount: true } });
  if (member.kycStatus === "APPROVED") return member;
  if (!member.bvnEncrypted) throw new HttpError(422, "Member has not submitted identity details");

  const provider = getPaymentProvider();
  const va = await provider.createVirtualAccount({ memberId, firstName: member.firstName, lastName: member.lastName, email: member.user.email, phone: member.user.phone });
  const recipientCode =
    member.bankAccount && member.bankAccount.nameMatched
      ? await provider.createRecipient({ bankCode: member.bankAccount.bankCode, accountNumber: member.bankAccount.accountNumber, accountName: member.bankAccount.accountName })
      : null;
  const year = new Date().getFullYear();

  return db.$transaction(async (tx) => {
    const counter = await tx.membershipCounter.upsert({ where: { year }, create: { year, value: 1 }, update: { value: { increment: 1 } } });
    const membershipNumber = `PF-${year}-${String(counter.value).padStart(6, "0")}`;
    const acct = await tx.ledgerAccount.create({
      data: { code: memberAccountCode(memberId), name: `Member savings ${membershipNumber}`, type: "LIABILITY", memberId },
    });
    await tx.wallet.create({ data: { memberId, ledgerAccountId: acct.id } });
    await tx.virtualAccount.create({
      data: { memberId, provider: provider.name, providerCustomerRef: va.providerCustomerRef, bankName: va.bankName, accountNumber: va.accountNumber, accountName: va.accountName },
    });
    if (recipientCode) await tx.bankAccount.update({ where: { memberId }, data: { recipientCode } });
    await tx.user.update({ where: { id: member.userId }, data: { status: "ACTIVE" } });
    const updated = await tx.member.update({
      where: { id: memberId },
      data: {
        membershipNumber,
        kycStatus: "APPROVED",
        kycReviewedBy: officerId,
        kycReviewedAt: new Date(),
        kycRejectReason: null,
        searchText: `${member.searchText} ${membershipNumber.toLowerCase()}`,
      },
    });
    await audit({ actorId: officerId, action: "KYC_APPROVED", entityType: "Member", entityId: memberId, after: { membershipNumber } }, tx);
    await notify(memberId, "Welcome to Prompt Funds", `You are verified. Your membership number is ${membershipNumber}.`, tx);
    return updated;
  });
}

export async function rejectKyc(memberId: string, officerId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const m = await tx.member.update({ where: { id: memberId }, data: { kycStatus: "REJECTED", kycRejectReason: reason, kycReviewedBy: officerId, kycReviewedAt: new Date() } });
    await audit({ actorId: officerId, action: "KYC_REJECTED", entityType: "Member", entityId: memberId, after: { reason } }, tx);
    await notify(memberId, "Verification needs attention", reason, tx);
    return m;
  });
}
