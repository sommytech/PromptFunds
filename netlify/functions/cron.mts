// Netlify Scheduled Functions call the app's protected cron endpoints.
// Times are UTC (Lagos is UTC+1).
import type { Config } from "@netlify/functions";

async function call(job: string) {
  const base = process.env.URL ?? process.env.APP_URL;
  const res = await fetch(`${base}/api/cron/${job}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  console.log(job, res.status, await res.text());
}

export default async () => {
  const now = new Date();
  await call("accrue"); // daily interest accrual
  await call("arrears"); // auto-debit due instalments, flag arrears
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (tomorrow.getUTCDate() === 1) await call("credit"); // last day of month: credit interest
};

export const config: Config = { schedule: "30 23 * * *" };
