import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["app/**/*.test.{ts,tsx}"],
    allowOnly: !process.env.CI,
    // Keep native database and generation suites from competing for every CPU.
    maxWorkers: 4,
  },
});
