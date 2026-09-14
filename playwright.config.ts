import { defineConfig, devices } from "@playwright/test";

const port = process.env.TI4_E2E_PORT ?? "3187";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `https://127.0.0.1:${port}`,
    ignoreHTTPSErrors: true,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testMatch:
        /(?:flows|map-building|map-recovery|standard-completion)\.spec\.ts$/,
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"] },
      testMatch:
        /(?:flows|map-building|map-recovery|standard-completion)\.spec\.ts$/,
    },
  ],
  webServer: {
    command: "node --import tsx scripts/test-server.ts",
    url: `https://127.0.0.1:${port}/health`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    timeout: 120_000,
    env: { TI4_E2E_PORT: port },
  },
});
