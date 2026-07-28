import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    // Kiro is an independently locked/packageable extension and its hostile
    // stdio suite runs with Node's built-in test runner via apps/kiro/verify.
    exclude: ["apps/kiro/**"],
    // The repository suites are intentionally I/O-heavy. Bound file workers and
    // allow a bounded ten-second case window so host load does not create false
    // failures while assertions and fail-closed behavior remain unchanged.
    maxWorkers: 4,
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
  },
})
