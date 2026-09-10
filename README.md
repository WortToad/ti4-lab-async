# TI4Toad

TI4Toad is a Twilight Imperium 4 drafting and map building tool. It supports multiple draft formats, shared lobbies, and browser notifications.

For low-cost hosting at **obsecsolutions.com/ti4**, see the [Railway setup and cost guide](docs/railway.md). It uses one app service and a persistent SQLite volume, with an estimated initial budget of **US$5–10/month** for light use.

## Prerequisites

### Dependencies

- Node.js
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

## Shared lobbies and recovery

Every newly created draft uses one shared lobby link, including Milty, Nucleus, Texas, Mini-Milty, RAW, Mantis, and all bag/Franken variants. Each player claims a free slot, enters their name, and saves a private recovery UUID. The browser remembers their UUID in an HTTP-only cookie and local storage. On another device, paste it into the lobby's rejoin form or **Rejoin a lobby** on the main page. Draft details and seating stay hidden until all slots are claimed and the admin starts.

The creator has a separate admin UUID and can also claim a player slot. Admin controls can retrieve or replace player UUIDs, rename players, release slots for replacements, pause/resume play, undo actions, and restore checkpoints. Restoring a save pauses play for review. Released slots keep their draft progress and require a replacement before resuming. The admin view receives only public draft information plus the admin's own hand when playing.

Save files exported from admin controls are encrypted so downloading a backup does not expose hidden picks. They can be imported back into the same lobby; player identities stay current when older game states are restored. Keep regular backups of the SQLite database as well: it holds the lobby records and the keys required to restore these files. For bag drafts, exported states also capture their linked map when present; the map lobby has its own turn recovery controls. The older local-only `/raw-draft` route now opens the persistent RAW setup flow. Existing base drafts created before managed lobbies retain their legacy access model and progress; create a new draft to use the full lobby flow. Existing bag, Mantis, and RAW rooms preserve their progress and recognize their previous credentials.

## Draft formats

Use **Rules as written (RAW)** on the setup page (or **Build a RAW galaxy** in the map generator) for official TI4 or Twilight's Fall setup. Players receive private tile hands and build the galaxy in snake order using the rulebook's layouts, tile counts, ring order, and placement restrictions. Normal TI4 chooses a random speaker and lets players choose factions. Twilight's Fall includes the starting reference-card draft, simultaneous priority reveal, home-system and king choices, and inaugural splice. The host can manage seats and undo actions; completed setups export map strings and JSON results. See [the RAW setup notes](docs/raw-setup.md).

The draft setup includes Milty (3–8 players), Milty-EQ, Nucleus (3–8 players), Texas, and Twilight's Fall reference packs. Twilight's Fall supports king bans/priorities and custom or faction-filtered reference packs.

Use **Bag / Franken / Twilight’s Fall** on the setup page for standard bag drafts, Franken, Powered, One-pick, Overdraft, their combinations, FrankenDraz, Twilight's Fall bags, or Inaugural Splice. Players join one shared lobby link and claim a slot; bags pass when everyone confirms. With map tiles enabled, players spend normal bag picks collecting their own tiles alongside faction components, keeping three blue and two red tiles by default. After everyone confirms their final faction and kept tiles, compatible drafts create a shared map room, opened from the lobby when players are ready.

Each player's five tiles fill their own section of the map: the builder draws from their remaining hand at random for placement from the center outward. Speaker order determines seating and breaks placement-turn ties; home systems are separate from the five tiles. Each player has one mulligan for the entire map build, which draws a different tile without discarding the original. Completed factions and maps can be exported. Inaugural Splice and drafts with tiles disabled use a separately prepared map; automatic map building requires 3–8 players and exactly three blue and two red kept tiles per player.

Use **Mantis draft** to draft individual tiles, factions, and speaker positions, discard extra tiles, and build the map with random draws and limited mulligans. Completed bag drafts with suitable tile hands can continue into this map-building flow.

**Mini-Milty** fills a base-game map before a two-round faction and speaker draft for 3–6 players.

Drafts persist in SQLite. New tables are created by the existing startup migration process. Run locally with integrations disabled if you do not have Discord/R2 configured:

```shell
TI4_LAB_DATABASE_PATH=file:///absolute/path/ti4.sqlite \
  DISCORD_DISABLED=true R2_INTEGRATION_DISABLED=true yarn dev
```

Node 22 is supported by the pinned native dependencies. See [the feature comparison](docs/draft-parity.md) for the bot reference, supported controls, and remaining differences. The downloaded bot repository is only needed to refresh the bundled catalogs and templates, not to run the app.
