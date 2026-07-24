import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    // Kiro is an independently locked/packageable extension and its hostile
    // stdio suite runs with Node's built-in test runner via apps/kiro/verify.
    exclude: ["apps/kiro/**"],
    // The repository suites are intentionally I/O-heavy. Bound file workers so
    // aggregate runs do not turn five-second assertions into host-load races.
    maxWorkers: 4,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
  },
})
