import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], env: { DATABASE_URL: "postgresql://x@localhost/x" }, environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
