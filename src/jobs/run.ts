/**
 * CLI for scheduled jobs (local / container cron). On Netlify the scheduled function calls /api/cron/*.
 *   tsx src/jobs/run.ts accrue | credit | arrears
 */
import "dotenv/config";
import { db } from "../lib/db";
import { accrue, credit } from "../services/interest";
import { runArrears } from "../services/loans";

const jobs: Record<string, () => Promise<unknown>> = { accrue: () => accrue(), credit: () => credit(), arrears: () => runArrears() };
const job = jobs[process.argv[2] ?? ""];
if (!job) {
  console.error("Usage: tsx src/jobs/run.ts accrue|credit|arrears");
  process.exit(1);
}
job()
  .then((r) => console.log(JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? v.toString() : v))))
  .finally(() => db.$disconnect());
