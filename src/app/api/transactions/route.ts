export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/http";
import { requireApprovedMember } from "@/lib/auth";

// Keyset pagination: ?cursor=<id>&limit=20 — avoids deep OFFSET scans.
export const GET = handle(async (req: Request) => {
  const { member } = await requireApprovedMember();
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  const cursor = url.searchParams.get("cursor");
  const rows = await db.transaction.findMany({
    where: { memberId: member.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const next = rows.length > limit ? rows.pop()!.id : null;
  return json({ items: rows, nextCursor: next });
});
