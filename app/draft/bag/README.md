# Bag draft catalog

`catalog.json` bundles the component data needed for browser drafts. Running the app does not require the downloaded bot repository, Java, or network requests for component text.

Refresh it from the workspace root:

```sh
python3 scripts/import-bag-catalog.py TI4_map_generator_bot
```

The importer uses Python's standard library and writes deterministic output. It fails when referenced models or errata dependencies cannot be resolved. The checked-in snapshot was imported from [AsyncTI4/TI4_map_generator_bot](https://github.com/AsyncTI4/TI4_map_generator_bot) commit `690bb6935d497e81667b6f59e00b0aa51902d858`.

Data and eligibility follow `src/main/resources/data/`, `systems/`, `planets/`, and these bot classes:

- `FrankenDraft`, `FrankenDrazDraft`, and `draft/items/*DraftItem` define component membership.
- `DraftErrataModel` supplies excluded standalone components, mandatory additions, optional swaps, and replacement text.
- `FactionDraftItem` supplies FrankenDraz expansion and the Mahact `_y` replacements.
- `MiltyDraftHelper` supplies tile exclusion and anomaly classification.
- `FrankenBanList` supplies the Weak Components and OP Components presets.

`definitions.ts` is safe for browser UI imports. `catalog.ts` imports the full data file and supplies the pool and component lookup APIs. Pool lookups return only draftable entries; direct lookups also resolve components available solely through errata. Speaker-order cards are generated for the actual player count by the draft engine.

The catalog also includes structured fleets, unit statistics, technology types, and local image references. `visualAliases.json` maps bot faction aliases to the existing lab faction identities, including Mahact kings. The importer reuses the lab's faction icons and tile images first, then copies missing icons and tiles from the bot into `public/draft/`. Original Twilight's Fall draft cards and Franken unit upgrades come from the bot's `hover_images/` directory; unit icons come from `emojis/units/` and are bundled in `public/units/`. These images load locally without requiring the bot checkout at runtime. Twilight's Fall lookups select the genome original along with its contextual name and rules text.

The snapshot contains 1,766 components and faction packages from 83 eligible official, Discordant Stars, Blue Reverie, and Lost Legacies factions. Monuments and Uncharted Space tiles are available as separate opt-in catalog pools. Twilight's Fall uses the bot's `techs_tf`, `tf_genome`, and `tf_units` decks: 87 abilities, 31 unit upgrades, eight Mahact kings, and 25 draftable genomes after the bot's Franken errata exclusions. Discordant Stars can add 73 Twilight's Fall abilities.

The bot currently applies Franken genome exclusions even in Twilight's Fall; this catalog follows that behavior. It retains the different Twilight's Fall genome names and text without changing the corresponding ordinary agent. Wavelength and Antimatter are available for assembly substitutions, outside the random draft pool.

The bot's software is [public-domain software under the Unlicense](https://github.com/AsyncTI4/TI4_map_generator_bot/blob/690bb6935d497e81667b6f59e00b0aa51902d858/LICENSE); its notice explicitly excludes art assets. The bundled artwork retains its original ownership. Twilight Imperium and its game content belong to their respective rights holders.
