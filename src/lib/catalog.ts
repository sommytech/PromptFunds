import { db } from "./db";

/** Public product data (rates/limits) for marketing pages. Cached by the page's revalidate setting. */
export async function getCatalog() {
  try {
    const [policy, products] = await Promise.all([
      db.interestPolicy.findFirst({ where: { effectiveFrom: { lte: new Date() } }, orderBy: { effectiveFrom: "desc" } }),
      db.loanProduct.findMany({ where: { active: true }, orderBy: { minAmountKobo: "asc" } }),
    ]);
    return { savingsRateBps: policy?.annualRateBps ?? null, products };
  } catch {
    return { savingsRateBps: null, products: [] };
  }
}
