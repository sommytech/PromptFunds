export const metadata = { title: "About us" };

export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="eyebrow">About Prompt Funds</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">A cooperative, built for your phone.</h1>
      <div className="mt-6 space-y-4 text-lg text-ink-soft">
        <p>Prompt Funds exists to make saving simple and borrowing fair for everyday Nigerians. Members own the cooperative, and surpluses are applied for members’ benefit under our rules.</p>
        <p>We earn income mainly from interest on member loans and from permitted, low-risk investments. That income pays interest on savings, our technology and staff, and builds reserves against loan losses.</p>
      </div>
      <h2 className="mt-12 text-xl font-bold">What we promise</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["Free membership", "Registration is free and always will be."],
          ["Transparent pricing", "Rates, fees and total cost shown before you commit."],
          ["Real balances", "Every naira you see is backed by reconciled records."],
          ["Respectful recovery", "We never shame members or contact your phone contacts."],
          ["Your data protected", "Processed under the Nigeria Data Protection Act; identity numbers encrypted."],
          ["Own-account payouts", "Money only ever leaves to your own verified bank account."],
        ].map(([t, d]) => (
          <li key={t} className="card"><p className="font-semibold">{t}</p><p className="mt-1 text-sm text-ink-soft">{d}</p></li>
        ))}
      </ul>
    </div>
  );
}
