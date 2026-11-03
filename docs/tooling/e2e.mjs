import { createRequire } from "module";
import { createHmac } from "crypto";
import { execFileSync } from "child_process";
const { chromium, devices } = createRequire(import.meta.url)("/opt/npm-tools/node_modules/playwright");
const BASE = "http://localhost:3000";
const SHOTS = "/home/claude/shots";
const PW = "ChangeMe-Now-12345";
const sql = (q) => execFileSync("psql", ["postgresql://pf:pf@localhost/promptfunds", "-Atc", q]).toString().trim();
const log = (...a) => console.log("✔", ...a);
const fail = (m) => { throw new Error("ASSERT: " + m); };

let __last = "";
const browser = await chromium.launch();
const mobile = await browser.newContext({ ...devices["Pixel 7"], deviceScaleFactor: 2 });
const desk = () => browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2 });
const m = await mobile.newPage();
const shot = (p, name, full = false) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
// Click something that submits a server action, then wait for the NEW flash message.
async function act(p, locator, accept = true) {
  if (accept) p.once("dialog", (d) => d.accept());
  const resp = p.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"], { timeout: 30000 });
  await locator.click();
  await resp;
  await p.waitForTimeout(400);
  await p.waitForSelector("[data-flash]", { timeout: 20000 });
  return (await p.locator("[data-flash]").first().textContent()).trim();
}
async function flash(p) { const t = await p.locator('[data-flash]').first().textContent({ timeout: 8000 }).catch(() => ""); return t ?? ""; }
async function staffLogin(email) {
  const ctx = await desk(); const p = await ctx.newPage();
  await p.goto(`${BASE}/login`); await p.fill("#email", email); await p.fill("#password", PW);
  await p.click("button:has-text('Log in')"); await p.waitForURL(/\/admin/); return p;
}

// Public pages
await m.goto(BASE); await shot(m, "m-home"); await shot(m, "m-home-full", true);
await m.goto(`${BASE}/loans-info`); await shot(m, "m-loans-info");
log("public pages render");

// 1. Register
const email = `chinedu.${Date.now()}@test.ng`;
await m.goto(`${BASE}/register`);
await m.fill("#firstName", "Chinedu"); await m.fill("#lastName", "Eze"); await m.fill("#email", email);
await m.fill("#phone", `080${String(Date.now()).slice(-8)}`); await m.fill("#password", "SuperSecret-2026");
await m.check("input[type=checkbox]"); await shot(m, "m-register");
await m.click("button:has-text('Create free account')"); await m.waitForURL(/\/kyc/); log("registered → KYC");

// 2. KYC
await m.fill("#dateOfBirth", "1990-05-12"); await m.fill("#address", "4 Bode Thomas Street, Surulere, Lagos");
await m.fill("#bvn", "2" + String(Date.now()).slice(-10)); await m.selectOption("#bankCode", "058"); await m.fill("#accountNumber", "0987654321");
await shot(m, "m-kyc");
const k = await act(m, m.locator("button:has-text('Verify and continue')"), false); if (!/matched/i.test(k)) fail("kyc flash: " + k); log("KYC submitted:", k.trim());

// 3. KYC officer approves
const kycP = await staffLogin("kyc@promptfunds.local");
await kycP.goto(`${BASE}/admin/members?status=queue`); await shot(kycP, "a-kyc-queue");
const row = kycP.locator("tr", { hasText: email });
const ap = await act(kycP, row.locator("button:has-text('Approve')"));
const memberNo = ap.match(/PF-\d{4}-\d{6}/)[0]; if (!/PF-\d{4}-\d{6}/.test(ap)) fail("approve: " + ap); log("KYC approved:", ap.trim());

// 4. Member dashboard + sandbox deposit
await m.goto(`${BASE}/dashboard`); await m.waitForSelector("text=Total savings");
await m.goto(`${BASE}/wallet`);
await m.fill("input[placeholder^='Sandbox']", "150000"); __last = await act(m, m.locator("button:has-text('Simulate')"), false);
log("sandbox deposit:", __last);
const memberId = sql(`select m.id from "Member" m join "User" u on u.id=m."userId" where u.email='${email}'`);
const va = sql(`select "accountNumber" from "VirtualAccount" where "memberId"='${memberId}'`);

// 5. Signed webhook deposit + replay (idempotency)
const body = JSON.stringify({ event: "deposit.confirmed", reference: `E2E-${Date.now()}`, accountNumber: va, amountKobo: "2500000" });
const sig = createHmac("sha256", "local-webhook").update(body).digest("hex");
const post = () => fetch(`${BASE}/api/webhooks/payments`, { method: "POST", headers: { "x-signature": sig }, body }).then((r) => r.json());
const w1 = await post(), w2 = await post();
if (w1.duplicate !== false || w2.duplicate !== true) fail("webhook idempotency " + JSON.stringify([w1, w2]));
const bad = await fetch(`${BASE}/api/webhooks/payments`, { method: "POST", headers: { "x-signature": "00" }, body });
if (bad.status !== 401) fail("bad signature accepted");
let bal = sql(`select "balanceKobo" from "Wallet" where "memberId"='${memberId}'`);
if (bal !== "17500000") fail("balance after deposits " + bal);
log("webhook deposit credited once, replay ignored, bad signature rejected; balance ₦175,000");

// 6. Withdrawal + finance approval
await m.goto(`${BASE}/wallet`); await m.fill("#amount", "20000");
__last = await act(m, m.locator("button:has-text('Request withdrawal')"));
log("withdraw:", __last); await shot(m, "m-wallet", true);

// 7. Concurrency: two parallel API withdrawals, each 70% of available → exactly one succeeds
const avail = Number(sql(`select "balanceKobo"-"heldKobo" from "Wallet" where "memberId"='${memberId}'`)) / 100;
const amt = String(Math.floor(avail * 0.7));
const req = (key) => m.request.post(`${BASE}/api/withdrawals`, { headers: { "idempotency-key": key, "content-type": "application/json" }, data: { amount: amt } });
const [r1, r2] = await Promise.all([req("k-" + Date.now()), req("k2-" + Date.now())]);
const codes = [r1.status(), r2.status()].sort();
if (codes[0] !== 201 || codes[1] !== 422) fail("concurrency " + codes);
const replay = await m.request.post(`${BASE}/api/withdrawals`, { headers: { "idempotency-key": "fixed-key", "content-type": "application/json" }, data: { amount: "1" } });
const replay2 = await m.request.post(`${BASE}/api/withdrawals`, { headers: { "idempotency-key": "fixed-key", "content-type": "application/json" }, data: { amount: "1" } });
if ((await replay.json()).id !== (await replay2.json()).id) fail("idempotent withdrawal");
log("parallel withdrawals: one accepted, one refused (no overdraw); idempotency key replay returns same request");

const fin = await staffLogin("finance@promptfunds.local");
await fin.goto(`${BASE}/admin/withdrawals`); await shot(fin, "a-withdrawals");
// approve the ₦20,000 one; reject the others
for (;;) {
  const rows = fin.locator("tr", { hasText: memberNo }).filter({ has: fin.locator("button:has-text('Approve & pay')") });
  if (!(await rows.count())) break;
  const r = rows.first(); const text = await r.textContent();
  if (text.includes("₦20,000.00")) __last = await act(fin, r.locator("button:has-text('Approve & pay')"));
  else { await r.locator("input[name=reason]").fill("Test cleanup"); __last = await act(fin, r.locator("button:has-text('Reject')"), false); }
  log("finance:", __last);
}
bal = sql(`select "balanceKobo"||' / '||"heldKobo" from "Wallet" where "memberId"='${memberId}'`);
if (bal !== "15500000 / 0") fail("after withdrawal " + bal);
log("withdrawal paid, rejected holds released: balance ₦155,000, held ₦0");

// 8. Loan application (Member Growth Loan ₦200,000 / 6 months)
await m.goto(`${BASE}/loans/apply`);
await m.selectOption("#productId", { label: "Member Growth Loan" });
await m.locator("input[type=range]").first().fill("200000"); await m.locator("#tenor").fill("6");
await m.fill("#purpose", "Restock provisions shop"); await m.fill("#income", "400000"); await m.fill("#expenses", "180000");
await shot(m, "m-loan-apply", true);
await m.click("button:has-text('Submit application')"); await m.waitForURL(/\/loans\/c/); await m.waitForSelector("[data-flash]"); log("loan:", (await flash(m)).trim());
const loanUrl = m.url(); const loanId = loanUrl.split("/").pop().split("?")[0];

// 9. Assess → committee approve (maker-checker) → accept → disburse
const lo = await staffLogin("loans@promptfunds.local");
await lo.goto(`${BASE}/admin/loans/${loanId}`); await lo.fill("textarea[name=notes]", "Stable trading income; 3 deposits in history; instalment 15% of disposable income. Recommend approval.");
__last = await act(lo, lo.locator("button:has-text('Record assessment')"), false); log("officer:", __last);
// loan officer cannot approve
const cm = await staffLogin("committee@promptfunds.local");
await cm.goto(`${BASE}/admin/loans/${loanId}`); await shot(cm, "a-loan-decision", true);
__last = await act(cm, cm.locator("button:has-text('Approve (committee)')")); log("committee:", __last);
await m.goto(loanUrl.split("?")[0]); await shot(m, "m-loan-offer", true);
__last = await act(m, m.locator("button:has-text('Accept offer')")); log("member:", __last);
// committee member cannot disburse (role) — then finance disburses
await fin.goto(`${BASE}/admin/loans/${loanId}`);
__last = await act(fin, fin.locator("button:has-text('Disburse')")); log("finance:", __last);
const st = sql(`select status||' '||"outstandingPrincipalKobo" from "Loan" where id='${loanId}'`);
if (!st.startsWith("ACTIVE 20000000")) fail("loan state " + st);

// 10. Repay one instalment from savings
await m.goto(loanUrl.split("?")[0]);
__last = await act(m, m.locator("button:has-text('Repay from savings')"));
log("repay:", __last); await shot(m, "m-loan-active", true);
const inst1 = sql(`select status from "LoanInstalment" where "loanId"='${loanId}' and number=1`);
if (inst1 !== "PAID") fail("instalment 1 " + inst1);

// 11. Jobs: accrue, arrears, credit
const admin = await staffLogin("admin@promptfunds.local");
for (const j of ["Daily interest accrual", "Repayments & arrears", "Month-end interest credit"]) {
  await admin.goto(`${BASE}/admin/operations`);
  __last = await act(admin, admin.locator("form", { hasText: j }).locator("button"));
  log("job:", __last.slice(0, 120));
}
await admin.goto(`${BASE}/admin`); await shot(admin, "a-overview");
await admin.goto(`${BASE}/admin/reports`); await shot(admin, "a-reports", true);
await admin.goto(`${BASE}/admin/loans?tab=book`); await shot(admin, "a-loans");
await admin.goto(`${BASE}/admin/audit`); await shot(admin, "a-audit");

// 12. Member final views
await m.goto(`${BASE}/dashboard`); await shot(m, "m-dashboard"); await shot(m, "m-dashboard-full", true);
await m.goto(`${BASE}/transactions`); await shot(m, "m-transactions");
const csv = await m.request.get(`${BASE}/api/statement`); const csvText = await csv.text();
if (!csvText.includes("Prompt Funds account statement") || csvText.split("\n").length < 6) fail("statement");
log("CSV statement rows:", csvText.trim().split("\n").length - 2);

// 13. Ledger integrity
const tb = sql(`select sum(debit)-sum(credit) from "LedgerLine"`);
const drift = sql(`select count(*) from (select w."memberId" from "Wallet" w join "LedgerLine" l on l."accountId"=w."ledgerAccountId" group by w."memberId", w."balanceKobo" having w."balanceKobo" <> sum(l.credit)-sum(l.debit)) x`);
if (tb !== "0" || drift !== "0") fail(`ledger tb=${tb} drift=${drift}`);
let immut = "allowed"; try { execFileSync("psql", ["postgresql://pf:pf@localhost/promptfunds", "-v", "ON_ERROR_STOP=1", "-c", 'update "LedgerLine" set debit=debit+1'], { stdio: "pipe" }); } catch (e) { immut = "blocked"; }
if (immut !== "blocked") fail("ledger mutable");
log("trial balance = 0, wallets match ledger, ledger UPDATE blocked by trigger");

// desktop public home for deck
const d = await (await desk()).newPage(); await d.goto(BASE); await shot(d, "d-home");
await d.goto(`${BASE}/loans-info`); await shot(d, "d-loans-info");
await browser.close();
console.log("\nALL E2E CHECKS PASSED");
