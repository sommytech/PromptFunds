export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { requireApprovedMember } from "@/lib/auth";
import { handle } from "@/lib/http";
import { formatNaira } from "@/lib/money";

const CREDIT_TYPES = new Set(["DEPOSIT", "INTEREST_CREDIT"]);

/** CSV account statement, streamed in pages so large histories don't load into memory at once. */
export const GET = handle(async (req: Request) => {
  const { member } = await requireApprovedMember();
  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") ?? "2000-01-01");
  const to = new Date(url.searchParams.get("to") ?? Date.now());
  to.setUTCHours(23, 59, 59, 999);
  const enc = new TextEncoder();
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

  const stream = new ReadableStream({
    async start(c) {
      c.enqueue(enc.encode(`Prompt Funds account statement,${member.membershipNumber}\nDate,Reference,Type,Status,Narration,Credit,Debit\n`));
      let cursor: string | undefined;
      for (;;) {
        const rows = await db.transaction.findMany({
          where: { memberId: member.id, createdAt: { gte: from, lte: to } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!rows.length) break;
        cursor = rows[rows.length - 1].id;
        for (const t of rows) {
          const amt = formatNaira(t.amountKobo).replace("₦", "");
          const credit = CREDIT_TYPES.has(t.type);
          c.enqueue(enc.encode([t.createdAt.toISOString(), t.reference, t.type, t.status, esc(t.narration ?? ""), credit ? esc(amt) : "", credit ? "" : esc(amt)].join(",") + "\n"));
        }
      }
      c.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="prompt-funds-statement-${member.membershipNumber}.csv"` },
  });
});
