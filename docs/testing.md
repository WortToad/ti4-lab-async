# Automated testing

Use Node 22 (`nvm use`) and `yarn install --frozen-lockfile`. SQLite tests use the native `better-sqlite3` module; dependencies installed under another Node major must be rebuilt or reinstalled.

```sh
yarn test:run                         # All unit and integration tests
yarn test app/routes/baseDraftFlows.test.ts --run  # One flow suite
yarn playwright install --with-deps chromium      # Once per machine
yarn test:e2e                        # Desktop and mobile Chromium
yarn test:e2e --project=desktop      # Desktop only
yarn build && yarn typecheck
```

`yarn test` retains Vitest's watch mode. The separate Vitest configuration limits concurrency to four workers and only discovers application tests; generated React Router types are not test suites. Route discovery excludes test files so they cannot become public endpoints. CI runs the production build, type checking, all unit/integration tests, and browser tests, with focused tests prohibited.

Browser tests build the production application with the `/ti4` base path, then start an isolated server on port 3187. Set `TI4_E2E_PORT` to choose another port. The test runner does not reuse a running application. It creates a temporary SQLite database, disables Discord/R2/analytics, and removes the database when the server exits. The browser build replaces the ignored `build/` directory; run `yarn build` again before starting a deployment with a different base path. No configured development or production database is used.

Failed browser tests retain screenshots and Playwright traces in `test-results/`; CI uploads them as an artifact. Open a trace with `yarn playwright show-trace test-results/<test>/trace.zip`. Tests use locator assertions and controlled promises rather than fixed sleeps or retries.

## Flow coverage

| Flow                            | Automated coverage                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format selection and setup      | Browser checks for Milty, Nucleus, Texas, Twilight's Fall packs, Franken, Twilight bags, RAW, Twilight RAW, Mantis and Mini-Milty; player counts and mobile layout. Store tests cover changing formats/counts and source constraints.                                                                 |
| Standard drafting               | `baseDraftFlows.test.ts` plays all 19 layouts through creation, joining, start, every pick, reload, undo/re-pick and map export. Covers bans, preassigned factions, shared/separate minors, colors and speaker order.                                                                                 |
| Mini-Milty and preset maps      | Complete 3–6-player two-round games, separate seating/speaker drafting, preserved maps, preview regeneration, refresh and retry.                                                                                                                                                                      |
| Twilight's Fall packs           | Complete king/slice/pack drafting, Nucleus seat/speaker variants, simultaneous priority/home reveals and remaining starting-unit cards.                                                                                                                                                               |
| Texas                           | Complete 3–8-player games, faction redraw, all tile passes, innermost-first placements, tile conservation, completion and Keleres homes. Existing conflict suites cover revealed-faction correction and recovery.                                                                                     |
| RAW and Mantis                  | Existing engine suites play complete galaxies and enforce hands, turn order, placements, discards, mulligans, Keleres choices and undo. Database suites cover ownership, revisions and recovery. Browser tests join/start/recover/pause/resume both families.                                         |
| Bag/Franken variants            | All ten variants create through their route and recover player/admin access. Existing suites play bag rounds, final assembly, Twilight/Inaugural Splice and linked Mantis map handoffs. Browser tests cover shared lobby operation.                                                                   |
| Lobby access and administration | Real cookies and isolated SQLite databases cover both roles, full/waiting lobbies, private projections, concurrent joins/writes, revoked credentials, checkpoints, encrypted backups, replacement, pause/resume and undo. Browser tests use separate contexts for each player and a recovered device. |
| Creation failure and templates  | JSON/redirect responses, validation errors, duplicate clicks, transport/server failures, saved previews, success-only cleanup, invalid template feedback and fresh-roster template import.                                                                                                            |
| Tournament and multidraft       | Tournament links, incomplete setup feedback and table creation in the browser; batch preparation/persistence and generation-failure atomicity in existing integration tests.                                                                                                                          |
| Maps                            | Publishing and slug collisions, statistics, listing/detail views, visitor like deduplication, draft preparation, editor undo/redo and sharing. Codec tests cover 2–5 rings, closed cells, homes and TTPG/Async rotations.                                                                             |
| Replay and public export        | Waiting lobbies remain inaccessible; Texas public history excludes private hands/draw piles. Store tests preserve replay position across live updates.                                                                                                                                                |
| Live updates and alerts         | Existing socket, loader-ordering and refresh suites plus queue serialization, duplicate suppression, notification opt-in/permissions and per-player turn deduplication.                                                                                                                               |

Most complete games run through the real engine or server route with actual persistence; browser tests exercise the user-facing setup and lobby journeys on both viewport sizes. External Discord delivery, R2 uploads, operating-system notification delivery and browsers other than Chromium are outside these suites. This is a flow inventory, not a claim of exhaustive branch or visual coverage.

When adding a flow, cover a successful journey and its meaningful rejection/recovery paths, keep random generation seeded, and update this inventory. Keep private state fixtures synthetic and avoid live integrations.
