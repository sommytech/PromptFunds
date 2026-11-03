import { describe, expect, it } from "vitest";
import { addMonths, scheduleFor } from "../loans";

describe("loan schedule", () => {
  it("principal always sums exactly to the amount borrowed", () => {
    for (const method of ["REDUCING_BALANCE", "FLAT"] as const)
      for (const tenor of [1, 3, 7, 12]) {
        const rows = scheduleFor({ principalKobo: 123_456_789n, annualRateBps: 2400, tenorMonths: tenor, method });
        expect(rows.reduce((a, r) => a + r.principalKobo, 0n)).toBe(123_456_789n);
        expect(rows.at(-1)!.balanceKobo).toBe(0n);
      }
  });
  it("reducing balance costs less interest than flat at the same headline rate", () => {
    const sum = (m: "REDUCING_BALANCE" | "FLAT") => scheduleFor({ principalKobo: 50_000_000n, annualRateBps: 2400, tenorMonths: 12, method: m }).reduce((a, r) => a + r.interestKobo, 0n);
    expect(sum("REDUCING_BALANCE")).toBeLessThan(sum("FLAT"));
  });
});

describe("due dates", () => {
  it("clamps to month end (31 Jan + 1 month = 28/29 Feb)", () => {
    expect(addMonths(new Date(Date.UTC(2027, 0, 31)), 1).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(addMonths(new Date(Date.UTC(2028, 0, 31)), 1).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(addMonths(new Date(Date.UTC(2027, 10, 15)), 2).toISOString().slice(0, 10)).toBe("2028-01-15");
  });
});
