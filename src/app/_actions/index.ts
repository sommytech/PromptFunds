"use server";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect";
import { z, ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { currentUser, destroySession, HttpError, requireApprovedMember, requireUser } from "@/lib/auth";
import { nairaToKobo } from "@/lib/money";
import { isDemo } from "@/lib/policy";
import { db } from "@/lib/db";
import { approveKyc, rejectKyc, submitKyc } from "@/services/members";
import { approveWithdrawal, rejectWithdrawal, requestWithdrawal } from "@/services/withdrawals";
import { acceptOffer, applyForLoan, approveLoan, assessLoan, declineLoan, disburseLoan, repayFromWallet, runArrears } from "@/services/loans";
import { creditDeposit } from "@/services/deposits";
import { accrue, credit } from "@/services/interest";

/** Run a mutation, then redirect back with a flash message (?ok= / ?err=). */
async function run(path: string, fn: () => Promise<string | { msg: string; to: string } | void>) {
  let msg: string;
  try {
    const r = await fn();
    if (r && typeof r === "object") {
      path = r.to;
      msg = r.msg;
    } else msg = r || "Done";
  } catch (e) {
    if (isRedirectError(e)) throw e;
    let m = "Something went wrong. Please try again.";
    if (e instanceof HttpError) m = e.message;
    else if (e instanceof ZodError) m = e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") m = "That record already exists.";
    else console.error(e);
    redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(m)}`);
  }
  revalidatePath(path.split("?")[0]);
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
}

const money = z.string().trim().transform((s) => s.replace(/,/g, "")).pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount"));
const f = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/* ------------------------------- Member ------------------------------- */
export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function submitKycAction(fd: FormData) {
  const user = await requireUser(["MEMBER"]);
  await run("/kyc", async () => {
    const input = z
      .object({
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth"),
        address: z.string().min(5, "Enter your address").max(200),
        bvn: z.string().regex(/^\d{11}$/, "BVN must be 11 digits"),
        nin: z.string().regex(/^(\d{11})?$/, "NIN must be 11 digits").optional(),
        bankCode: z.string().min(3, "Choose your bank"),
        accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
      })
      .parse({ dateOfBirth: f(fd, "dateOfBirth"), address: f(fd, "address"), bvn: f(fd, "bvn"), nin: f(fd, "nin") || undefined, bankCode: f(fd, "bankCode"), accountNumber: f(fd, "accountNumber") });
    const r = await submitKyc(user.id, input);
    if (!r.matched) return `Submitted. We couldn't confirm your BVN automatically (${r.reason}). An officer will review it.`;
    if (!r.nameMatched) return "Submitted. Your bank account name doesn't match your name — an officer will contact you.";
    return process.env.KYC_AUTO_APPROVE === "true" ? "You're verified! Welcome to Prompt Funds." : "Thanks — your details matched. An officer will approve you shortly.";
  });
}

export async function withdrawAction(fd: FormData) {
  const { user, member } = await requireApprovedMember();
  await run("/wallet", async () => {
    const amount = money.parse(f(fd, "amount"));
    const key = z.string().uuid().parse(f(fd, "idem"));
    await requestWithdrawal(member.id, user.id, nairaToKobo(amount), `${member.id}:${key}`);
    return "Withdrawal requested. It will be paid to your bank account within 1 business day.";
  });
}

export async function simulateDepositAction(fd: FormData) {
  const { member } = await requireApprovedMember();
  await run("/wallet", async () => {
    if (!isDemo()) throw new HttpError(403, "Sandbox deposits are disabled");
    const amount = nairaToKobo(money.parse(f(fd, "amount")));
    if (amount > 1_000_000_000n) throw new HttpError(422, "Sandbox limit is ₦10,000,000");
    const va = await db.virtualAccount.findUniqueOrThrow({ where: { memberId: member.id } });
    await creditDeposit({ virtualAccountNumber: va.accountNumber, providerReference: `SANDBOX-${randomUUID()}`, amountKobo: amount, channel: "sandbox" });
    return "Sandbox deposit received and reconciled.";
  });
}

export async function applyLoanAction(fd: FormData) {
  const { user, member } = await requireApprovedMember();
  await run("/loans/apply", async () => {
    const i = z
      .object({ productId: z.string().min(1), amount: money, tenor: z.coerce.number().int().min(1).max(60), purpose: z.string().min(3).max(200), income: money, expenses: money })
      .parse({ productId: f(fd, "productId"), amount: f(fd, "amount"), tenor: f(fd, "tenor"), purpose: f(fd, "purpose"), income: f(fd, "income"), expenses: f(fd, "expenses") });
    const loan = await applyForLoan(user.id, member.id, {
      productId: i.productId,
      principalKobo: nairaToKobo(i.amount),
      tenorMonths: i.tenor,
      purpose: i.purpose,
      monthlyIncomeKobo: nairaToKobo(i.income),
      monthlyExpensesKobo: nairaToKobo(i.expenses),
    });
    return { msg: `Application ${loan.reference} submitted.`, to: `/loans/${loan.id}` };
  });
}

export async function acceptOfferAction(fd: FormData) {
  const { user, member } = await requireApprovedMember();
  const id = f(fd, "loanId");
  await run(`/loans/${id}`, async () => {
    await acceptOffer(user.id, member.id, id);
    return "Offer accepted. We'll disburse to your bank account shortly.";
  });
}

export async function repayAction(fd: FormData) {
  const { user, member } = await requireApprovedMember();
  const id = f(fd, "loanId");
  await run(`/loans/${id}`, async () => {
    const amount = nairaToKobo(money.parse(f(fd, "amount")));
    const r = await repayFromWallet(member.id, id, amount, z.string().uuid().parse(f(fd, "idem")), "WALLET", user.id);
    return r?.closed ? "Loan fully repaid — well done!" : "Repayment applied.";
  });
}

/* ------------------------------- Staff ------------------------------- */
async function staff(roles?: Parameters<typeof requireUser>[0]) {
  const u = await currentUser();
  if (!u || u.role === "MEMBER") redirect("/login");
  if (roles && !roles.includes(u.role)) throw new HttpError(403, "Your role cannot do this");
  return u;
}

export async function approveKycAction(fd: FormData) {
  await run(`/admin/members?q=${encodeURIComponent(f(fd, "q"))}`, async () => {
    const u = await staff(["KYC_OFFICER", "ADMIN"]);
    const m = await approveKyc(f(fd, "memberId"), u.id);
    return `Approved — ${m.membershipNumber}`;
  });
}
export async function rejectKycAction(fd: FormData) {
  await run(`/admin/members?q=${encodeURIComponent(f(fd, "q"))}`, async () => {
    const u = await staff(["KYC_OFFICER", "ADMIN"]);
    await rejectKyc(f(fd, "memberId"), u.id, f(fd, "reason") || "Details could not be verified");
    return "Verification rejected; member notified.";
  });
}
export async function approveWithdrawalAction(fd: FormData) {
  await run("/admin/withdrawals", async () => {
    const u = await staff();
    const wd = await approveWithdrawal(f(fd, "id"), u.id, u.role);
    return wd.status === "PAID" ? "Approved and paid." : "Approved — payout processing.";
  });
}
export async function rejectWithdrawalAction(fd: FormData) {
  await run("/admin/withdrawals", async () => {
    const u = await staff(["FINANCE_OFFICER", "FINANCE_APPROVER", "ADMIN"]);
    await rejectWithdrawal(f(fd, "id"), u.id, f(fd, "reason") || "Declined by finance");
    return "Withdrawal rejected; funds released.";
  });
}
export async function assessLoanAction(fd: FormData) {
  await run(`/admin/loans/${f(fd, "id")}`, async () => {
    const u = await staff();
    await assessLoan(f(fd, "id"), u.id, u.role, f(fd, "notes") || "Assessed");
    return "Assessment recorded — awaiting committee approval.";
  });
}
export async function approveLoanAction(fd: FormData) {
  await run(`/admin/loans/${f(fd, "id")}`, async () => {
    const u = await staff();
    await approveLoan(f(fd, "id"), u.id, u.role);
    return "Approved — offer sent to member.";
  });
}
export async function declineLoanAction(fd: FormData) {
  await run(`/admin/loans/${f(fd, "id")}`, async () => {
    const u = await staff();
    await declineLoan(f(fd, "id"), u.id, u.role, f(fd, "reason") || "Does not meet lending policy");
    return "Declined; member notified.";
  });
}
export async function disburseLoanAction(fd: FormData) {
  await run(`/admin/loans/${f(fd, "id")}`, async () => {
    const u = await staff();
    const l = await disburseLoan(f(fd, "id"), u.id, u.role);
    return l.status === "ACTIVE" ? "Disbursed and active." : "Disbursement processing.";
  });
}
export async function runJobAction(fd: FormData) {
  await run("/admin/operations", async () => {
    await staff(["ADMIN", "FINANCE_APPROVER"]);
    const job = f(fd, "job");
    const r = job === "accrue" ? await accrue() : job === "credit" ? await credit() : job === "arrears" ? await runArrears() : null;
    if (!r) throw new HttpError(400, "Unknown job");
    return `${job}: ${JSON.stringify(r)}`;
  });
}
