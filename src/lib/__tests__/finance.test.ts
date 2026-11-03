import { describe, expect, it } from "vitest";
import { divRoundHalfEven, formatNaira, nairaToKobo } from "../money";
import { dailyAccrualMicroKobo, microToKobo } from "../interest";
import { flatSchedule, reducingBalanceSchedule } from "../amortisation";

describe("money", () => {
  it("parses and formats", () => {
    expect(nairaToKobo("1250.5")).toBe(125050n);
    expect(formatNaira(125000000n)).toBe("₦1,250,000.00");
    expect(() => nairaToKobo("1.234")).toThrow();
  });
  it("rounds half to even", () => {
    expect(divRoundHalfEven(5n, 2n)).toBe(2n);
    expect(divRoundHalfEven(7n, 2n)).toBe(4n);
    expect(divRoundHalfEven(1n, 3n)).toBe(0n);
  });
});

describe("interest", () => {
  it("accrues daily and sums to roughly annual rate", () => {
    const bal = 100_000_00n; // ₦100,000
    let micro = 0n;
    for (let i = 0; i < 365; i++) micro += dailyAccrualMicroKobo(bal, 600);
    // 6% of ₦100,000 = ₦6,000 = 600,000 kobo
    expect(microToKobo(micro)).toBe(600_000n);
  });
  it("accrues nothing for zero balance", () => {
    expect(dailyAccrualMicroKobo(0n, 600)).toBe(0n);
  });
});

describe("amortisation", () => {
  it("reducing balance repays principal exactly and ends at zero", () => {
    const p = 100_000_00n;
    const rows = reducingBalanceSchedule(p, 2400, 12);
    expect(rows).toHaveLength(12);
    expect(rows.reduce((a, r) => a + r.principalKobo, 0n)).toBe(p);
    expect(rows[11].balanceKobo).toBe(0n);
    // ₦100,000 @ 24% over 12 months ≈ ₦9,456/month
    const pay = Number(rows[0].totalKobo) / 100;
    expect(pay).toBeGreaterThan(9400);
    expect(pay).toBeLessThan(9500);
  });
  it("flat schedule totals match", () => {
    const rows = flatSchedule(120_000_00n, 1200, 12);
    expect(rows.reduce((a, r) => a + r.principalKobo, 0n)).toBe(120_000_00n);
    expect(rows.reduce((a, r) => a + r.interestKobo, 0n)).toBe(14_400_00n);
  });
});
