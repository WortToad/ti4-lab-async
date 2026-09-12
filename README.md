# TI4 Draft Command

TI4 Draft Command is a Twilight Imperium 4 drafting and map building tool. It supports multiple draft formats, shared lobbies, and browser notifications.

For low-cost hosting at **obsecsolutions.com/ti4**, see the [Railway setup and cost guide](docs/railway.md). It uses one app service and a persistent SQLite volume, with an estimated initial budget of **US$5–10/month** for light use.

## Prerequisites

### Dependencies

- Node.js 22 (matches the Docker image; run `nvm use` if you use nvm)
- Sqlite3

### Environment setup

In your shell configuration, add the following

```
export TI4_LAB_DATABASE_PATH="file:///ABSOLUTE_PATH_HERE.sqlite"
```

_NOTE_: The path must be an absolute path.

## Installing / running

Assuming all the prerequisites are met, you can run the following commands to install and run the app:

```shell
npm install --global yarn
yarn install
yarn run dev
```

Open `http://localhost:3000/` in your browser and you're good to go.

Use the same Node version for dependency installation, development and tests. If you switch Node versions after installing, reinstall dependencies to rebuild the native SQLite and image-rendering modules.

Run `yarn test:run` for unit and database integration tests. For desktop and mobile browser flows, install Chromium with `yarn playwright install --with-deps chromium`, then run `yarn test:e2e`. Browser tests build the app at `/ti4`, start their own server and temporary database, and disable Discord, R2 and analytics. See [the testing guide and flow coverage](docs/testing.md) for details.

The map generator saves edits in the current browser tab, including changes to shared maps. Undo and redo cover tile edits, layout/content changes, resizing, imports, generation and resets; history is kept while the editor is open. Share a link or export a map string to keep a copy beyond that tab. Failed generation preserves the existing map, and publishing failures retain both the map and form for retry.

## Shared lobbies and recovery

Every newly created draft uses one shared lobby link, including Milty, Nucleus, Texas, Mini-Milty, RAW, Mantis, and all bag/Franken variants. Setup asks for the number of players; names are entered once, when people join the shared lobby. Switching formats carries over the player count within the chosen format's limits. Draft details and seating stay hidden until everyone has joined and the admin starts. For lobbies created from a Discord roster, joining players can select their Discord identity so mentions follow the correct person regardless of join order.

The browser remembers each player's private recovery code in an HTTP-only cookie and local storage. On another device, paste it into **Already joined? Restore access** in the lobby or **Rejoin an existing draft** on the main page. After joining, codes and recovery tools are under **Recovery & access**. The lobby shows the people who have joined and the remaining capacity; draft order and seating follow the chosen format's rules.

During play, the turn indicator and tab title show when you have a pending choice, including simultaneous rounds. **Turn alerts** offers optional sound and browser notifications for all draft formats. Keep the tab open to receive them. Drafts refresh when you return to the tab or reconnect; opted-in alerts also keep background tabs up to date.

The creator has a separate admin recovery code and can also join as a player. Admin controls can retrieve or replace player recovery codes, rename players, release players for replacements, pause/resume play, undo actions, and restore checkpoints. Restoring a save pauses play for review. Replacements retain the released player's draft progress and must join before play resumes. The admin view receives only public draft information plus the admin's own hand when playing.

Draft previews save changes in the current browser tab so refreshing preserves map and faction edits. A failed creation request leaves the preview available for retry; successful creation clears its saved preview. **Use a draft template** prepares a new lobby from exported draft JSON with a fresh roster and no previous picks. Encrypted lobby backups instead restore progress in their original lobby through admin controls.

Save files exported from admin controls are encrypted so downloading a backup does not expose hidden picks. They can be imported back into the same lobby; player identities stay current when older game states are restored. Keep regular backups of the SQLite database as well: it holds the lobby records and the keys required to restore these files. For bag drafts, exported states also capture their linked map when present; the map lobby has its own turn recovery controls. The older local-only `/raw-draft` route now opens the persistent RAW setup flow. Existing base drafts created before managed lobbies retain their legacy access model and progress; create a new draft to use the full lobby flow. Existing bag, Mantis, and RAW rooms preserve their progress and recognize their previous credentials.

## Draft formats

Use **Rules as written (RAW)** on the setup page (or **Build a RAW galaxy** in the map generator) for official TI4 or Twilight's Fall setup. Players receive private tile hands and build the galaxy in snake order using the rulebook's layouts, tile counts, ring order, and placement restrictions. Normal TI4 chooses a random speaker and lets players choose factions. Twilight's Fall includes the starting reference-card draft, simultaneous priority reveal, home-system and king choices, and inaugural splice. The host can manage seats and undo actions; completed setups export map strings and JSON results. See [the RAW setup notes](docs/raw-setup.md).

The draft setup includes Milty (3–8 players), Milty-EQ, Nucleus (3–8 players), Texas, and Twilight's Fall reference packs. Twilight's Fall supports king bans/priorities and custom or faction-filtered reference packs.

Use **Bag / Franken / Twilight’s Fall** on the setup page for standard bag drafts, Franken, Powered, One-pick, Overdraft, their combinations, FrankenDraz, Twilight's Fall bags, or Inaugural Splice. Players enter their name to join through one shared lobby link; bags pass when everyone confirms. With map tiles enabled, players spend normal bag picks collecting their own tiles alongside faction components, keeping three blue and two red tiles by default. After everyone confirms their final faction and kept tiles, compatible drafts create a shared map room, opened from the lobby when players are ready.

Each player's five tiles fill their own section of the map: the builder draws from their remaining hand at random for placement from the center outward. Speaker order determines seating and breaks placement-turn ties; home systems are separate from the five tiles. Each player has one mulligan for the entire map build, which draws a different tile without discarding the original. Completed factions and maps can be exported. Inaugural Splice and drafts with tiles disabled use a separately prepared map; automatic map building requires 3–8 players and exactly three blue and two red kept tiles per player.

Use **Mantis draft** to draft individual tiles, factions, and speaker positions, discard extra tiles, and build the map with random draws and limited mulligans. Completed bag drafts with suitable tile hands can continue into this map-building flow.

**Mini-Milty** fills a base-game map before a two-round faction and speaker draft for 3–6 players. Its recommended faction count follows the player count until overridden. Preview controls regenerate a complete map or reset to the original map while preserving faction changes.

Texas and bag setup show insufficient faction or tile pools before creation. Texas reserves enough factions for every enabled redraw; bags retain their custom count controls and explain the supply needed by the current settings.

Unsubmitted bag picks and faction assembly choices survive refresh in the same tab and are rechecked against the current round and player identity. Selection counts and submit controls stay visible while browsing long lists. Mantis resolves Keleres' legal home and hero before map building and records forced placements automatically when no placement or mulligan choice remains. These actions remain undoable.

Standard and Texas drafts also ask the Keleres player to choose an available home and matching hero before exporting the completed map. Standard draft refreshes preserve open controls and replay position, and delayed reads cannot overwrite newer submitted choices.

If simultaneous Texas faction choices leave Keleres without an unused home, the revealed factions open a correction step before tile drafting continues. An affected player can explicitly choose a legal alternative from their original hand, or draw a legal fresh replacement when redraw is enabled. Other factions, seats, tile picks and map placements remain intact, including in older saved drafts. Choices remain private until the original simultaneous reveal. Only a configured pool with no legal replacement requires the admin to revise setup.

Drafts persist in SQLite. New tables are created by the existing startup migration process. Run locally with integrations disabled if you do not have Discord/R2 configured:

```shell
TI4_LAB_DATABASE_PATH=file:///absolute/path/ti4.sqlite \
  DISCORD_DISABLED=true R2_INTEGRATION_DISABLED=true yarn dev
```

Node 22 is supported by the pinned native dependencies. See [the feature comparison](docs/draft-parity.md) for the bot reference, supported controls, and remaining differences. The downloaded bot repository is only needed to refresh the bundled catalogs and templates, not to run the app.
