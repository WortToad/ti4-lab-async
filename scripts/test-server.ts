import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

// Isolate both the database and compiled assets from any running preview.
// Keep bundles under the project so their external imports resolve node_modules.
const cache = resolve(".cache");
mkdirSync(cache, { recursive: true });
const directory = mkdtempSync(join(cache, "browser-tests-"));
Object.assign(process.env, {
  NODE_ENV: "production",
  PORT: process.env.TI4_E2E_PORT ?? "3187",
  TI4_LAB_DATABASE_PATH: pathToFileURL(join(directory, "drafts.sqlite")).href,
  TI4_BUILD_DIRECTORY: join(directory, "build"),
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
  ["node_modules/@react-router/dev/bin.cjs", "build"],
  { stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);
await import("../server");
