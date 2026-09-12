import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

// Every browser run owns its database, even if the developer has .env configured.
const directory = mkdtempSync(join(tmpdir(), "ti4-browser-tests-"));
Object.assign(process.env, {
  NODE_ENV: "production",
  PORT: process.env.TI4_E2E_PORT ?? "3187",
  TI4_LAB_DATABASE_PATH: pathToFileURL(join(directory, "drafts.sqlite")).href,
  TI4_BASE_PATH: "/ti4",
  DISCORD_DISABLED: "true",
  R2_INTEGRATION_DISABLED: "true",
  VITE_POSTHOG_KEY: "",
  VITE_PUBLIC_ORIGIN: `http://127.0.0.1:${process.env.TI4_E2E_PORT ?? "3187"}`,
});
process.once("exit", () => rmSync(directory, { recursive: true, force: true }));
process.once("SIGTERM", () => process.exit(0));
process.once("SIGINT", () => process.exit(0));
// Exercise the deployed bundle and keep editor changes from reloading test pages.
const build = spawnSync(
  process.execPath,
  ["node_modules/@react-router/dev/bin.js", "build"],
  { stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);
await import("../server");
