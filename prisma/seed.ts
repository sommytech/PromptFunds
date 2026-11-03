/**
 * Idempotent seed — safe to run on every deploy.
 * Creates the chart of accounts, staff users, the savings interest policy and loan products.
 * With DEMO_MODE=true it also creates a verified demo member with sandbox deposits.
 */
import "dotenv/config";
import { hashPassword } from "../src/lib/password";

import { db } from "../src/lib/db";

async function main() {
  const accounts = [
    { code: "1000-BANK-COLL", name: "Bank – Collections (member deposits)", type: "ASSET" },
    { code: "1010-BANK-PAYOUT", name: "Bank – Payouts (withdrawals & disbursements)", type: "ASSET" },
    { code: "1200-LOANS-REC", name: "Loans Receivable", type: "ASSET" },
    { code: "4000-LOAN-INT", name: "Loan Interest Income", type: "INCOME" },
    { code: "4100-FEE-INC", name: "Loan Processing Fee Income", type: "INCOME" },
    { code: "5000-INT-SAVINGS", name: "Interest Expense on Savings", type: "EXPENSE" },
    { code: "5100-LOSS-PROV", name: "Loan Loss Provision", type: "EXPENSE" },
  ] as const;
  for (const a of accounts) await db.ledgerAccount.upsert({ where: { code: a.code }, update: { name: a.name }, create: a });

  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Now-12345";
  const passwordHash = await hashPassword(password);
  const staff = [
    { email: "admin@promptfunds.local", phone: "2348000000001", role: "ADMIN" },
    { email: "kyc@promptfunds.local", phone: "2348000000002", role: "KYC_OFFICER" },
    { email: "finance@promptfunds.local", phone: "2348000000003", role: "FINANCE_OFFICER" },
    { email: "approver@promptfunds.local", phone: "2348000000004", role: "FINANCE_APPROVER" },
    { email: "loans@promptfunds.local", phone: "2348000000005", role: "LOAN_OFFICER" },
    { email: "committee@promptfunds.local", phone: "2348000000006", role: "COMMITTEE" },
    { email: "auditor@promptfunds.local", phone: "2348000000007", role: "AUDITOR" },
  ] as const;
  for (const s of staff) await db.user.upsert({ where: { email: s.email }, update: {}, create: { ...s, passwordHash, status: "ACTIVE" } });

  // Placeholder rates — replace with the board-approved savings and lending policy before launch.
  if (!(await db.interestPolicy.count()))
    await db.interestPolicy.create({ data: { annualRateBps: 1000, dayCount: 365, minBalanceKobo: 100_000n, effectiveFrom: new Date("2026-01-01") } });
  if (!(await db.loanProduct.count())) {
    await db.loanProduct.create({
      data: { name: "Member Growth Loan", minAmountKobo: 5_000_000n, maxAmountKobo: 200_000_000n, minTenorMonths: 3, maxTenorMonths: 12, annualRateBps: 2400, method: "REDUCING_BALANCE", processingFeeBps: 100 },
    });
    await db.loanProduct.create({
      data: { name: "Quick Emergency Loan", minAmountKobo: 1_000_000n, maxAmountKobo: 30_000_000n, minTenorMonths: 1, maxTenorMonths: 3, annualRateBps: 3000, method: "FLAT", processingFeeBps: 50 },
    });
  }

  if (process.env.DEMO_MODE === "true") await seedDemoMember(passwordHash);
  console.log("Seed complete. Change staff passwords after first login.");
}

async function seedDemoMember(passwordHash: string) {
  const email = "ada@promptfunds.demo";
  if (await db.user.findUnique({ where: { email } })) return;
  const { approveKyc } = await import("../src/services/members");
  const { creditDeposit } = await import("../src/services/deposits");
  const { encryptField, identityHash } = await import("../src/lib/crypto");
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@promptfunds.local" } });
  const user = await db.user.create({ data: { email, phone: "2348031234567", passwordHash, role: "MEMBER", status: "PENDING" } });
  const member = await db.member.create({
    data: {
      userId: user.id, firstName: "Ada", lastName: "Okafor", dateOfBirth: new Date("1992-04-18"), address: "12 Allen Avenue, Ikeja, Lagos",
      bvnEncrypted: encryptField("22212345678"), bvnHash: identityHash("22212345678"), kycStatus: "IN_REVIEW", kycMatchScore: 100, kycProviderRef: "mock-5678",
      searchText: "ada okafor 2348031234567 ada@promptfunds.demo",
      bankAccount: { create: { bankCode: "058", bankName: "Guaranty Trust Bank", accountNumber: "0123456789", accountName: "ADA OKAFOR", nameMatched: true, verifiedAt: new Date() } },
    },
  });
  await approveKyc(member.id, admin.id);
  const va = await db.virtualAccount.findUniqueOrThrow({ where: { memberId: member.id } });
  for (const [i, naira] of [50_000, 75_000, 120_000].entries())
    await creditDeposit({ virtualAccountNumber: va.accountNumber, providerReference: `SEED-${member.id}-${i}`, amountKobo: BigInt(naira * 100), channel: "sandbox" });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
