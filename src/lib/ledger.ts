import { Prisma, TxType } from "@/generated/prisma/client";
import { db } from "./db";

export interface PostingLine {
  accountCode: string;
  debit?: bigint;
  credit?: bigint;
}

export interface PostInput {
  idempotencyKey: string;
  reference: string;
  txType: TxType;
  description: string;
  lines: PostingLine[];
  createdBy?: string;
}

type Tx = Prisma.TransactionClient;

export const ACCOUNTS = {
  BANK_COLLECTIONS: "1000-BANK-COLL",
  BANK_PAYOUTS: "1010-BANK-PAYOUT",
  LOANS_RECEIVABLE: "1200-LOANS-REC",
  INTEREST_EXPENSE: "5000-INT-SAVINGS",
  LOAN_INTEREST_INCOME: "4000-LOAN-INT",
  FEE_INCOME: "4100-FEE-INC",
  LOSS_PROVISION: "5100-LOSS-PROV",
} as const;

export const memberAccountCode = (memberId: string) => `2000-MEMBER-${memberId}`;

/** Post a balanced, append-only journal entry. Idempotent on idempotencyKey. */
export async function postEntry(tx: Tx, input: PostInput) {
  const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;

  let debits = 0n;
  let credits = 0n;
  for (const l of input.lines) {
    const d = l.debit ?? 0n;
    const c = l.credit ?? 0n;
    if (d < 0n || c < 0n || (d > 0n && c > 0n) || (d === 0n && c === 0n)) throw new Error("Invalid ledger line");
    debits += d;
    credits += c;
  }
  if (debits !== credits) throw new Error(`Unbalanced entry: debits ${debits} != credits ${credits}`);

  const codes = [...new Set(input.lines.map((l) => l.accountCode))];
  const accounts = await tx.ledgerAccount.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of codes) if (!byCode.has(code)) throw new Error(`Unknown ledger account ${code}`);

  return tx.ledgerEntry.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      reference: input.reference,
      txType: input.txType,
      description: input.description,
      createdBy: input.createdBy,
      lines: {
        create: input.lines.map((l) => ({
          accountId: byCode.get(l.accountCode)!,
          debit: l.debit ?? 0n,
          credit: l.credit ?? 0n,
        })),
      },
    },
  });
}

/** Source of truth balance for a member (credit - debit on liability account). */
export async function ledgerBalance(memberId: string, tx: Tx | typeof db = db): Promise<bigint> {
  const rows = await tx.ledgerLine.aggregate({
    where: { account: { code: memberAccountCode(memberId) } },
    _sum: { debit: true, credit: true },
  });
  return (rows._sum.credit ?? 0n) - (rows._sum.debit ?? 0n);
}

/** Trial balance check — must always be zero. */
export async function trialBalanceVariance(): Promise<bigint> {
  const s = await db.ledgerLine.aggregate({ _sum: { debit: true, credit: true } });
  return (s._sum.debit ?? 0n) - (s._sum.credit ?? 0n);
}
