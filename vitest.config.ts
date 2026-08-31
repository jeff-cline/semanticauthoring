import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws by design outside a React Server Component.
      // Unit tests exercise pure logic, so stub it out.
      "server-only": resolve(__dirname, "tests/stubs/empty.ts"),
      "@": resolve(__dirname, "src"),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
