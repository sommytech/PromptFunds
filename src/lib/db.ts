import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// One client per server instance. In dev, reuse across hot reloads to avoid exhausting connections.
// On serverless, point DATABASE_URL at a pooler (Neon "-pooler" host / PgBouncer) and keep max small.
const create = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL, max: Number(process.env.DB_POOL_MAX ?? 5) }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

const g = globalThis as unknown as { prisma?: ReturnType<typeof create> };
export const db = g.prisma ?? create();
if (process.env.NODE_ENV !== "production") g.prisma = db;
