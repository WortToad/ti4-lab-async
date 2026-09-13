# Dependency upgrade — 13 September 2026

The application uses Node.js 26.8.2 (the current release), npm 12.0.2 and Yarn Classic 1.22.22. `.nvmrc`, the package engine requirement, Docker and CI agree on the runtime. Reinstall native dependencies after changing Node majors:

```sh
nvm install
nvm use
npm install --global npm@12.0.2 yarn@1.22.22
yarn install --frozen-lockfile
```

Direct dependencies were checked against the npm registry's latest stable releases. The upgrades include React 19.3, React Router 8.3, Mantine 9.6, Zustand 5, Jotai 3, Vite 8.3, Vitest 5, Babel 8, better-sqlite3 13 and Drizzle ORM 0.45. Yarn remains on its latest Classic release to preserve the existing lockfile workflow.

Two tool families use their newest compatible versions:

- ESLint and `@eslint/js` stay on 9.39.5 because the current React, import and accessibility plugins do not support ESLint 10 in their peer dependency ranges.
- TypeScript stays on 6.0.3 because the current `@typescript-eslint` parser/plugin requires TypeScript below 6.1; the registry's latest TypeScript is 7.0.2.

Revisit these limits when the plugins publish support. `yarn outdated` deliberately reports these three package entries.

Unused packages were removed. `prom-client` was replaced by its maintained successor, `@prometheus-io/client`. Vite's native TypeScript path resolution replaces `vite-tsconfig-paths`, and `@rolldown/plugin-babel` replaces the old Vite Babel adapter. A narrowly scoped Yarn resolution updates the legacy esbuild dependency beneath Drizzle Kit's `@esbuild-kit/core-utils`; migration generation and metadata checking were verified with that resolution. The final dependency audit reported no vulnerabilities.

## Compatibility fixes

React Router's route metadata and test request contexts use the new APIs, and the custom development server uses Vite's Environment API. Zustand's supported `traditional` hooks preserve memoized array/object selectors and prevent render loops. Pure map statistics and slice defaults live outside React components so native server imports do not attempt to load CSS.

Mantine's collapse, grid and resize-observer APIs were updated. The theme preserves the previous light colors, field sizes, font weights and rounded corners. Select controls now expose the correct combobox accessibility role.

Existing draft JSON stays readable after Drizzle's blob conversion change. The schema adapter decodes both historical text and binary JSON rows and preserves content comparisons used to reject stale writes. The SQL column definition and existing migrations are unchanged.

## Verification

See [testing instructions](testing.md) for commands and flow coverage. Verification uses isolated databases and disables external integrations.

- The original runtime passed 846 unit/integration tests and 129 browser tests, with one browser test skipped.
- The upgraded runtime passes 847 unit/integration tests, including a new legacy database regression test.
- All 131 applicable browser checks pass across the full run and focused reruns; the desktop-only skip of a touch test is unchanged. The full run passed 129 checks, and the two Mantis tests passed on desktop and mobile after fixing their resize-observer timing assumption.
- Appearance baselines were captured from the original dependencies with the same Chromium version. They cover eleven pages at desktop and mobile sizes, including a saved draft preview. Comparisons permit only five isolated antialiasing pixels per screenshot.
- A fixed native PNG map export was byte-for-byte identical before and after the upgrade.
- Production build, type checking, lint, migration generation/checking and development preview startup were checked. Lint retains existing warnings.

Docker itself could not be built in this WSL environment because Docker integration was unavailable. A separate production-only dependency installation passed lobby creation, native PNG export, health and metrics checks with no browser console errors. Live Discord delivery, R2 uploads, analytics, OS notifications and non-Chromium browsers are outside this verification.
