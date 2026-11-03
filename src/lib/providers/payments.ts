import { createHmac, timingSafeEqual } from "crypto";

/**
 * Payment partner adapter. Swap providers without touching ledger logic.
 * Licence boundary: Prompt Funds must NOT move money between members or to third parties.
 * The only outbound payments are (a) withdrawals and (b) loan disbursements, and both go
 * ONLY to the member's own verified BankAccount. There is deliberately no "send to account" API.
 */
export interface PayoutRequest {
  reference: string; // wd_<id> or ln_<id>
  amountKobo: bigint;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  recipientCode?: string | null;
  narration: string;
}
export interface PayoutResult {
  status: "PROCESSING" | "PAID" | "FAILED";
  providerRef: string;
  reason?: string;
}
export interface VirtualAccountResult {
  bankName: string;
  accountNumber: string;
  accountName: string;
  providerCustomerRef?: string;
}
export interface PaymentProvider {
  name: string;
  createVirtualAccount(input: { memberId: string; firstName: string; lastName: string; email: string; phone: string }): Promise<VirtualAccountResult>;
  resolveAccount(bankCode: string, accountNumber: string): Promise<{ accountName: string }>;
  createRecipient(input: { bankCode: string; accountNumber: string; accountName: string }): Promise<string | null>;
  payout(req: PayoutRequest): Promise<PayoutResult>;
}

/* ----------------------------- Mock (dev/demo) ----------------------------- */
class MockProvider implements PaymentProvider {
  name = "mock";
  async createVirtualAccount({ memberId, firstName, lastName }: { memberId: string; firstName: string; lastName: string }) {
    const n = (Math.abs(hash(memberId)) % 9_000_000_000) + 1_000_000_000;
    return { bankName: "Sandbox Bank", accountNumber: String(n), accountName: `Prompt Funds / ${firstName} ${lastName}` };
  }
  async resolveAccount(_bankCode: string, accountNumber: string) {
    if (!/^\d{10}$/.test(accountNumber)) throw new Error("Account number must be 10 digits");
    return { accountName: "" }; // mock: caller falls back to member's own name
  }
  async createRecipient() {
    return null;
  }
  async payout(req: PayoutRequest): Promise<PayoutResult> {
    return { status: "PAID", providerRef: `MOCK-${req.reference}` };
  }
}

/* ----------------------------- Paystack ----------------------------- */
class PaystackProvider implements PaymentProvider {
  name = "paystack";
  private base = "https://api.paystack.co";
  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.base + path, {
      ...init,
      headers: { authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "content-type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    const body = (await res.json()) as { status: boolean; message: string; data: T };
    if (!res.ok || !body.status) throw new Error(`Paystack ${path}: ${body.message}`);
    return body.data;
  }
  async createVirtualAccount(i: { memberId: string; firstName: string; lastName: string; email: string; phone: string }) {
    const customer = await this.call<{ customer_code: string }>("/customer", {
      method: "POST",
      body: JSON.stringify({ email: i.email, first_name: i.firstName, last_name: i.lastName, phone: i.phone, metadata: { memberId: i.memberId } }),
    });
    const dva = await this.call<{ bank: { name: string }; account_number: string; account_name: string }>("/dedicated_account", {
      method: "POST",
      body: JSON.stringify({ customer: customer.customer_code, preferred_bank: process.env.PAYSTACK_DVA_BANK ?? "wema-bank" }),
    });
    return { bankName: dva.bank.name, accountNumber: dva.account_number, accountName: dva.account_name, providerCustomerRef: customer.customer_code };
  }
  async resolveAccount(bankCode: string, accountNumber: string) {
    const d = await this.call<{ account_name: string }>(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
    return { accountName: d.account_name };
  }
  async createRecipient(i: { bankCode: string; accountNumber: string; accountName: string }) {
    const d = await this.call<{ recipient_code: string }>("/transferrecipient", {
      method: "POST",
      body: JSON.stringify({ type: "nuban", name: i.accountName, account_number: i.accountNumber, bank_code: i.bankCode, currency: "NGN" }),
    });
    return d.recipient_code;
  }
  async payout(req: PayoutRequest): Promise<PayoutResult> {
    const recipient = req.recipientCode ?? (await this.createRecipient(req));
    try {
      const d = await this.call<{ transfer_code: string; status: string }>("/transfer", {
        method: "POST",
        body: JSON.stringify({ source: "balance", amount: Number(req.amountKobo), recipient, reference: req.reference, reason: req.narration }),
      });
      return { status: d.status === "success" ? "PAID" : "PROCESSING", providerRef: d.transfer_code };
    } catch (e) {
      return { status: "FAILED", providerRef: req.reference, reason: (e as Error).message };
    }
  }
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function getPaymentProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER === "paystack" ? new PaystackProvider() : new MockProvider();
}

/** HMAC check for the generic/mock webhook (sha256 hex in x-signature). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  return hmacEquals("sha256", process.env.PAYMENT_WEBHOOK_SECRET, rawBody, signature);
}
/** Paystack signs with HMAC-SHA512 of the raw body using the secret key (x-paystack-signature). */
export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  return hmacEquals("sha512", process.env.PAYSTACK_SECRET_KEY, rawBody, signature);
}
function hmacEquals(alg: string, secret: string | undefined, body: string, sig: string | null) {
  if (!secret || !sig) return false;
  const a = Buffer.from(createHmac(alg, secret).update(body).digest("hex"));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
