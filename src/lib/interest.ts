import { divRoundHalfEven } from "./money";

const MICRO = 1_000_000n;

/**
 * Daily accrual in micro-kobo (kobo * 1e6) so tiny daily amounts are not lost to rounding.
 * accrual = balance * rateBps / 10_000 / dayCount
 */
export function dailyAccrualMicroKobo(balanceKobo: bigint, annualRateBps: number, dayCount = 365): bigint {
  if (balanceKobo <= 0n || annualRateBps <= 0) return 0n;
  return (balanceKobo * BigInt(annualRateBps) * MICRO) / (10_000n * BigInt(dayCount));
}

/** Convert accumulated micro-kobo to whole kobo using banker's rounding. */
export function microToKobo(micro: bigint): bigint {
  return divRoundHalfEven(micro, MICRO);
}
