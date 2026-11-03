import { divRoundHalfEven } from "./money";

export interface ScheduleRow {
  number: number;
  principalKobo: bigint;
  interestKobo: bigint;
  totalKobo: bigint;
  balanceKobo: bigint;
}

/**
 * Reducing-balance schedule with level instalments (monthly).
 * Uses BigInt fixed-point (1e12 scale) for the payment factor; the last row absorbs rounding.
 */
export function reducingBalanceSchedule(principalKobo: bigint, annualRateBps: number, months: number): ScheduleRow[] {
  if (principalKobo <= 0n || months <= 0) throw new Error("Invalid loan terms");
  if (annualRateBps === 0) return flatSchedule(principalKobo, 0, months);

  const SCALE = 10n ** 12n;
  const r = (BigInt(annualRateBps) * SCALE) / (10_000n * 12n); // monthly rate scaled
  // (1+r)^n scaled
  let pow = SCALE;
  for (let i = 0; i < months; i++) pow = (pow * (SCALE + r)) / SCALE;
  // payment = P * r * pow / (pow - SCALE)
  const payment = divRoundHalfEven((principalKobo * r * pow) / SCALE, pow - SCALE);

  const rows: ScheduleRow[] = [];
  let balance = principalKobo;
  for (let n = 1; n <= months; n++) {
    const interest = divRoundHalfEven(balance * r, SCALE);
    let principal = payment - interest;
    if (n === months || principal > balance) principal = balance;
    balance -= principal;
    rows.push({ number: n, principalKobo: principal, interestKobo: interest, totalKobo: principal + interest, balanceKobo: balance });
  }
  return rows;
}

/** Flat-rate schedule: interest = P * rate * years, spread evenly. */
export function flatSchedule(principalKobo: bigint, annualRateBps: number, months: number): ScheduleRow[] {
  const totalInterest = divRoundHalfEven(principalKobo * BigInt(annualRateBps) * BigInt(months), 10_000n * 12n);
  const rows: ScheduleRow[] = [];
  let balance = principalKobo;
  let interestLeft = totalInterest;
  for (let n = 1; n <= months; n++) {
    const last = n === months;
    const principal = last ? balance : principalKobo / BigInt(months);
    const interest = last ? interestLeft : totalInterest / BigInt(months);
    balance -= principal;
    interestLeft -= interest;
    rows.push({ number: n, principalKobo: principal, interestKobo: interest, totalKobo: principal + interest, balanceKobo: balance });
  }
  return rows;
}
