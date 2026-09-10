# TI4 Lab

TI4 lab is a Twilight Imperium 4 drafting and map building tool. It supports multiple draft formats, has browser notifications, discord integration, and many other fun things.

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

## Draft formats

The draft setup includes Milty (3–8 players), Milty-EQ, Nucleus (3–8 players), Texas, and Twilight's Fall reference packs. Twilight's Fall supports king bans/priorities and custom or faction-filtered reference packs.

Use **Bag / Franken / Twilight’s Fall** on the setup page for standard bag drafts, Franken, Powered, One-pick, Overdraft, their combinations, FrankenDraz, Twilight's Fall bags, or Inaugural Splice. The host receives private player links; bags pass when everyone confirms. Players assemble their final factions using the selected variant's keep limits, then export the results.

Use **Mantis draft** to draft individual tiles, factions, and speaker positions, discard extra tiles, and build the map with random draws and limited mulligans. Completed bag drafts with suitable tile hands can continue into this map-building flow.

**Mini-Milty** fills a base-game map before a two-round faction and speaker draft for 3–6 players.

Drafts persist in SQLite. New tables are created by the existing startup migration process. Run locally with integrations disabled if you do not have Discord/R2 configured:

```shell
TI4_LAB_DATABASE_PATH=file:///absolute/path/ti4.sqlite \
  DISCORD_DISABLED=true R2_INTEGRATION_DISABLED=true yarn dev
```

Node 22 is supported by the pinned native dependencies. See [the feature comparison](docs/draft-parity.md) for the bot reference, supported controls, and remaining differences. The downloaded bot repository is only needed to refresh the bundled catalogs and templates, not to run the app.
