// Shared between server pages and the client-side calculator (must not be a "use client" module).
export type CalcProduct = { id: string; name: string; min: number; max: number; minTenor: number; maxTenor: number; rateBps: number; feeBps: number; method: "REDUCING_BALANCE" | "FLAT" };

export const toCalc = (p: { id: string; name: string; minAmountKobo: bigint; maxAmountKobo: bigint; minTenorMonths: number; maxTenorMonths: number; annualRateBps: number; processingFeeBps: number; method: "REDUCING_BALANCE" | "FLAT" }): CalcProduct => ({
  id: p.id, name: p.name, min: Number(p.minAmountKobo / 100n), max: Number(p.maxAmountKobo / 100n), minTenor: p.minTenorMonths, maxTenor: p.maxTenorMonths, rateBps: p.annualRateBps, feeBps: p.processingFeeBps, method: p.method,
});
