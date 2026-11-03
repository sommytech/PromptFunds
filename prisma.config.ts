import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations use the DIRECT (non-pooled) connection; the app uses the pooled DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    // Netlify DB (Neon) sets NETLIFY_DATABASE_URL(_UNPOOLED) automatically.
    url: process.env.DIRECT_URL ?? process.env.NETLIFY_DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL ?? "",
  },
});
