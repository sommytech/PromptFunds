export const metadata = { title: "FAQs" };

const faqs: [string, string][] = [
  ["Does it cost anything to join?", "No. Registration is free, there is no minimum first deposit and no compulsory monthly contribution."],
  ["How do I deposit?", "After verification you get a personal account number. Transfer any amount to it from your bank app or USSD. Your balance updates once the payment is confirmed — usually within a minute."],
  ["How is interest calculated?", "Interest accrues daily on your savings balance at the published annual rate and is credited to your wallet at the end of each month. You can see accrued interest on your dashboard."],
  ["How fast are withdrawals?", "Withdrawal requests are reviewed and paid to your own verified bank account within 1 business day. Large withdrawals need a second approval."],
  ["Can I send money to someone else?", "No. Prompt Funds is a savings and loans service for members, not a payments or transfer service. Money only goes to your own verified bank account."],
  ["Who can get a loan?", "Verified members with savings, no other open loan, and a monthly repayment within 40% of their disposable income. Loans can be up to 3× your savings."],
  ["How do I repay my loan?", "Repay from your savings balance at any time from the loan page. On the due date we automatically collect any amount due from your available savings."],
  ["What happens if I miss a repayment?", "We send reminders and move the loan to arrears after a short grace period. While a loan is overdue you cannot withdraw savings. We never contact your friends or family or shame you publicly."],
  ["Is my money insured?", "Prompt Funds is a cooperative, not a bank, so savings are not covered by NDIC deposit insurance. We keep member funds in segregated bank accounts and reconcile them daily."],
  ["How is my data protected?", "Your BVN and NIN are encrypted, access is logged, and we process data under the Nigeria Data Protection Act 2023. We never sell your data."],
];

export default function Faq() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="eyebrow">Help centre</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Frequently asked questions</h1>
      <div className="mt-8 space-y-3">
        {faqs.map(([q, a]) => (
          <details key={q} className="card group">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{q}<span className="text-brand transition group-open:rotate-45">+</span></summary>
            <p className="mt-3 text-ink-soft">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
