# Testing audit — 14 September 2026

The baseline had 849 passing unit/integration tests, substantial engine and
database coverage, and desktop/mobile Chromium journeys. Passing that suite
still left reproducible defects. Existing uncommitted RAW undo and lobby-admin
work was retained and included in validation.

## Defects reproduced and corrected

| Area | Failure missed by the baseline | Regression coverage |
| --- | --- | --- |
| Map publication | Concurrent submissions with the same name could race on the unique slug. | Eight concurrent publications must each persist under a distinct retrievable URL. Slug selection and insertion now share a synchronous SQLite transaction. |
| Map links | Emoji-only, non-Latin, or punctuation-only titles could generate an empty URL slug. | Each title produces a nonempty, valid share path. |
| Publishing validation | Broken JSON and wrong field types threw exceptions; unknown layouts and invalid maps could be stored. | Invalid requests return 400 and leave saved maps unchanged. Publishing validates the complete native map string without relying on the editor's repair behavior. |
| Draft creation | Malformed preview objects and broken JSON produced server exceptions. | Route tests require validation responses without creating lobbies. The creation boundary validates the roster and catches malformed preview data before persistence. |
| Missing replay | An unknown legacy UUID dereferenced a missing draft. | Both slug and UUID draft/replay requests return 404, in route tests and real HTTP requests. |
| Map likes | Network failures escaped the handler, server errors gave no useful feedback, repeated clicks could submit concurrently, and reload lost liked status. | Browser tests inject three failure modes, retry, hold a pending request, dispatch extra clicks, and verify persisted visitor status. Read/write routes now use the same proxy identity. |
| Keyboard actions | Slice controls used mouse-down handlers; standard drafting could stall with keyboard activation. | A complete keyboard draft exercises faction, slice, seat, export, and replay controls. Native click handlers also cover reference-card selection, player-count changes, and legacy player-selection buttons. |
| Seat selection | Claimed home seats still exposed a selection button to the next player; the server rejected the resulting choice. | The map omits occupied-seat controls, with a component regression for player ID zero and complete browser drafting through all seats. |
| Slow lobby loading | A player could enter a name before hydration attached its handlers; loading then erased the name and left joining disabled. | Lobby controls remain disabled until mounted. A browser test holds JavaScript downloads, verifies the disabled form, releases the scripts, and joins with the entered name visible to the admin. |
| Slow setup loading | Clicking the draft preview button before hydration silently did nothing. | Setup submission waits until mounted; a browser test holds scripts and then creates the Twilight's Fall preview. |
| Map dialog stacking | A duplicate-hyperlane warning covered import/export dialog buttons on small screens. | The warning sits below dialogs. A deterministic map with repeated hyperlanes verifies that the dialog can be closed at 390 × 664. |
| Browser diversity | Both original browser projects used Chromium. | Core setup, administration, map building, recovery, and complete standard drafting now also run in Firefox and mobile WebKit; CI installs all three engines. |
| Browser transport | The HTTP test harness relied on Chromium/Firefox accepting Secure cookies on loopback; WebKit lost creator access. | The harness now uses a temporary HTTPS proxy, including WebSocket upgrades, while retaining production cookie settings. |

The browser servers compile production bundles under the `/ti4` base path and
use separate temporary SQLite databases. Tests do not exercise a live deployment
or send real Discord messages or uploads. Appearance baselines remain unchanged.

The unit/integration suite passes all 876 tests in 72 files, including 27 added
regressions. Type checking passes; lint reports no errors and the same 20 warnings
present before this audit.

## Browser verification results

The final inventory contains 268 browser cases in 10 files. Across matrix
partitions and targeted reruns after fixes, 267 distinct cases passed. The one
intentional skip is the desktop copy of the mobile touch-input test.

| Project | Passed | Intentionally skipped |
| --- | ---: | ---: |
| Desktop Chromium | 86 | 1 |
| Mobile Chromium | 87 | 0 |
| Desktop Firefox | 47 | 0 |
| Mobile WebKit | 47 | 0 |

The final complete-game run passed all 12 standard/RAW/Mantis journeys across
the four projects. Dialog-overlap regressions and the affected Hyperlane 5p
journey passed all eight checks; delayed setup loading and the affected
Twilight's Fall preview passed all six checks. All 15 Chromium/Firefox lobby
admin journeys and all five WebKit lobby admin journeys passed.

Test synchronization now lets background loader reads and the Socket.IO
handshake settle before deliberately reloading complete-game pages. This avoids
WebKit reporting cancelled reads as access-control errors while retaining strict
browser-error assertions. Admin downloads also wait for accordion animations.
The local WebKit runtime required its missing GStreamer plugins; CI installs
browser runtime dependencies with Playwright. These harness issues were resolved
without suppressing application errors or weakening production cookies.

## Remaining verification gaps

These are limits of the current evidence, not claims that each area is broken:

- Complete Texas, Twilight's Fall, and bag assembly games have engine/server
  coverage, but their entire final sequences are not all driven through browser
  controls. Browser tests cover their setup, lobby actions, and relevant initial
  selections/rounds.
- Real Discord delivery, R2 upload failures, OS notification delivery, and live
  reverse-proxy configuration need a dedicated integration environment.
- Mobile emulation does not replace testing physical iOS/Android devices,
  assistive technology, or every supported browser/OS version. Visual snapshots
  remain Chromium-only; the extra engines run selected functional suites.
- There is no sustained load/soak test or process-crash/disk-full drill. Existing
  concurrency tests verify application/database operations, not infrastructure
  capacity or every possible interruption during persistence.
- Tests do not establish retry idempotency for every mutation when the server
  commits successfully but its response is lost. Duplicate-click protection and
  stale-revision rejection cover narrower cases.
- No measured branch-coverage threshold or mutation-testing gate currently
  enforces the flow inventory. A passing suite is not proof of exhaustive paths.

Every newly introduced flow should include a successful journey, an observable
final state after reload, and its meaningful rejection/recovery paths. These
checks strengthen confidence; they cannot certify a site as 100% failure-proof.
