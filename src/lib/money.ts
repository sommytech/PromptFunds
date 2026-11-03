// Money helpers. All amounts are BigInt kobo; never use floats for balances.

export const KOBO_PER_NAIRA = 100n;

export function nairaToKobo(naira: string | number): bigint {
  const s = typeof naira === "number" ? naira.toFixed(2) : naira.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("Invalid amount");
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * KOBO_PER_NAIRA + BigInt(frac.padEnd(2, "0"));
}

export function formatNaira(kobo: bigint): string {
  const neg = kobo < 0n;
  const abs = neg ? -kobo : kobo;
  const whole = (abs / KOBO_PER_NAIRA).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % KOBO_PER_NAIRA).toString().padStart(2, "0");
  return `${neg ? "-" : ""}₦${whole}.${frac}`;
}

/** Integer division rounding half to even (banker's rounding). */
export function divRoundHalfEven(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new Error("Divisor must be positive");
  const q = n / d;
  const r = n % d;
  const twice = r * 2n;
  if (twice > d) return q + 1n;
  if (twice < d) return q;
  return q % 2n === 0n ? q : q + 1n;
}
