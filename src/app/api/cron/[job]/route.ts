import { timingSafeEqual } from "crypto";
import { handle, json, problem } from "@/lib/http";
import { accrue, credit } from "@/services/interest";
import { runArrears } from "@/services/loans";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const jobs: Record<string, () => Promise<unknown>> = { accrue: () => accrue(), credit: () => credit(), arrears: () => runArrears() };

export const POST = handle(async (req: Request, ctx: { params: { job: string } }) => {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`);
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  if (!process.env.CRON_SECRET || got.length !== expected.length || !timingSafeEqual(got, expected)) return problem(401, "Unauthorized");
  const job = jobs[ctx.params.job];
  if (!job) return problem(404, "Unknown job");
  return json({ job: ctx.params.job, result: await job() });
});
