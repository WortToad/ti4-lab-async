import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: { jsx: "automatic" },
  test: {
    include: ["app/**/*.test.{ts,tsx}"],
    allowOnly: !process.env.CI,
    // Keep native database and generation suites from competing for every CPU.
    maxWorkers: 4,
    minWorkers: 1,
  },
});
