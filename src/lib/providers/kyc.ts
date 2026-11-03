/**
 * Electronic identity verification adapter (BVN, optional NIN).
 * Production: Dojah (or Prembly / Monnify / Smile ID) behind the same interface.
 */
export interface KycInput { bvn: string; firstName: string; lastName: string; dateOfBirth: string }
export interface KycResult { matched: boolean; score: number; providerRef: string; reason?: string }
export interface KycProvider { verifyBvn(i: KycInput): Promise<KycResult> }

class MockKyc implements KycProvider {
  async verifyBvn(i: KycInput): Promise<KycResult> {
    if (!/^\d{11}$/.test(i.bvn)) return { matched: false, score: 0, providerRef: "mock", reason: "BVN must be 11 digits" };
    // Sandbox convention: BVNs starting with 0 fail, everything else matches.
    if (i.bvn.startsWith("0")) return { matched: false, score: 20, providerRef: `mock-${i.bvn.slice(-4)}`, reason: "Name or date of birth did not match BVN record" };
    return { matched: true, score: 100, providerRef: `mock-${i.bvn.slice(-4)}` };
  }
}

class DojahKyc implements KycProvider {
  async verifyBvn(i: KycInput): Promise<KycResult> {
    const q = new URLSearchParams({ bvn: i.bvn, first_name: i.firstName, last_name: i.lastName, dob: i.dateOfBirth });
    const res = await fetch(`${process.env.DOJAH_BASE_URL ?? "https://api.dojah.io"}/api/v1/kyc/bvn?${q}`, {
      headers: { AppId: process.env.DOJAH_APP_ID ?? "", Authorization: process.env.DOJAH_SECRET_KEY ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return { matched: false, score: 0, providerRef: "dojah", reason: `Verification service error (${res.status})` };
    const body = (await res.json()) as { entity?: { first_name?: { status: boolean }; last_name?: { status: boolean }; dob?: { status: boolean } } };
    const e = body.entity ?? {};
    const checks = [e.first_name?.status, e.last_name?.status, e.dob?.status];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    return { matched: score === 100, score, providerRef: "dojah", reason: score === 100 ? undefined : "Details did not fully match BVN record" };
  }
}

export const getKycProvider = (): KycProvider => (process.env.KYC_PROVIDER === "dojah" ? new DojahKyc() : new MockKyc());
