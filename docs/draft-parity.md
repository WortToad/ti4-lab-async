# Draft feature comparison

Reference: the downloaded AsyncTI4 bot at commit `690bb6935d497e81667b6f59e00b0aa51902d858`. The comparison concerns draft preparation, drafting, and faction assembly; Discord game execution is a separate system.

## Mini-Milty

`/draft/minimilty/new` prepares the bot's base-game Mini-Milty format for three to six players. Before drafting, each map region receives three blue and two red base-game systems without duplicates. Faction selection uses only base-game factions, defaults to one more faction than players, and supports bans and priorities. Players then draft a faction and a speaker position over two snake rounds. Speaker position determines seating on the prepared board.

This reuses the application's existing preset-map draft and live synchronization. Existing preset-map drafts that separate seating from speaker order retain their three-round behavior. Mini-Milty generation follows `BaseGameMiniMiltyService` and `BaseGameMiniMiltyFactionSettings`; it uses the application's standard Milty hyperlane layouts for the selected player count.

## Map layouts

Three-player Milty and three-, four-, five-, and seven-player Nucleus have been added to the map picker. Their static hyperlanes, rotations, home positions, slice placements, and shared map positions come directly from the bot's `3pHyperlanes` and corresponding `NpHyperlanesNucleus` templates. This extends the existing Milty four-to-eight-player and Nucleus six/eight-player choices. The prechoice player controls now allow three players, and every Nucleus layout enables separate speaker drafting by default.

The new layouts use the application's slice generators and shared-map validation. Nucleus slices honor configured value/resource/influence limits. The bot's separate per-nucleus value targets, cross-nucleus spread limits, and nucleus-specific placement settings are not reproduced by the new layouts; six-player Nucleus retains its existing specialized generator and core-stat overlays. Other Nucleus layouts show the regular map/slice statistics, avoiding the six-player overlay's incompatible coordinates. Map and slice generation are tested for completeness, unique systems, correct rotations, and non-overlapping player regions. The setup slice-pool cap reserves enough tiles to fill the shared map.

Refresh the bundled templates with `python3 scripts/import-draft-layouts.py TI4_map_generator_bot`. Runtime does not depend on the bot checkout.

## Bag drafts

The application now has a dedicated bag draft flow for these bot variants:

| Variant | Bag selection | Final faction |
| --- | --- | --- |
| Franken | Three first picks, then two per bag | Standard component limits |
| Powered Franken | Four abilities and three faction technologies per bag | Keep four abilities and three faction technologies |
| One-pick Franken | One selection per bag | Standard component limits |
| Powered one-pick Franken | One selection per bag with powered counts | Powered component limits |
| Overdraft Franken | Standard Franken selection | Keep the drafted component counts |
| Powered overdraft Franken | Powered Franken selection | Keep the drafted component counts |
| FrankenDraz | Whole faction packages; two first picks, then one | Assemble from the drafted factions' legal components |
| Twilight's Fall | Abilities, genomes, unit upgrades, kings, fleets, homes, tiles, and order | Two abilities, one genome, one unit upgrade, and one king |
| Inaugural Splice | Three abilities, two genomes, and two unit upgrades per bag; one pick per pass | Two abilities, one genome, and one unit upgrade |
| Standard bag draft | Three blue tiles, two red tiles, one home system, and speaker order | Keep all seven items |

Shared controls include player shuffling, category draft/keep counts, first and later pick counts, individual component and faction bans, priority factions for FrankenDraz, optional tiles/order, and expansion pools. The Weak Components and OP Components ban presets use the bot's lists. Bags pass once all players finish their selections; private player links protect choices, and the host can undo a round. Component assembly applies errata additions and offers legal optional swaps. Twilight's Fall supports Wavelength and Antimatter substitutions.

The catalog includes ordinary official factions, Thunder's Edge, Discordant Stars, Blue Reverie, Lost Legacies, and monuments. The complete imported catalog and refresh instructions are documented in [the bag catalog README](../app/draft/bag/README.md). Bags use unique cards and report insufficient pools; they do not silently duplicate components to fill large drafts. In particular, six FrankenDraz factions per player requires additional factions for a six-player game.

Bag components reuse the application's faction and Mahact king icons, tile rendering, typography, and card surfaces. Abilities and genomes carry their originating faction's emblem; fleets show unit icons and counts, and unit cards show combat statistics. Lab Art and Original Art apply to tiles and available card artwork, with enlarged original-card and king references available during picking and assembly. Missing assets are bundled from the bot checkout by the catalog importer; drafts do not require a running bot or remote image requests. Mantis uses the same faction, speaker, reference, and tile components.

## Boundaries and remaining bot features

- Bag drafts provide component and tile selections plus an export. Compatible completed drafts can continue into the application's Mantis map builder. They do not execute Discord game setup, place drafted fleets into an active game, or apply technologies to Discord game objects.
- The tile/order toggle gives the draft behavior needed for a game without public map drafting. It does not implement the bot's wider Fog of War game mode or GM tools.
- The imported catalog includes Blue Reverie and Lost Legacies components, but other bot homebrew systems such as Absol, Twilight Kart Nova Cup kings, and Twilight's Fall Blue Reverie kings are not bundled as selectable bag pools.
- Twilight's Fall currently uses its standard splice decks, with the imported Twilight Discordant Stars ability extension when selected. Arbitrary deck replacement and the bot's other custom splice decks are outside this implementation.
- FrankenDraz supports faction priority and component-count controls. The bot's per-homebrew-pack faction quotas, live faction-package replacement commands, and unlimited kept-component mode are not separate controls here.
- The standard bag flow follows the application's explicit expansion toggles and shares the Franken home-system pool. The bot's separate `StandardBagDraft` class has slightly different excluded-faction/source filtering.
- Named ban presets expand into editable component IDs at creation. Refreshing the catalog later does not rewrite existing saved drafts.

## Mantis drafts and map building

`/draft/mantis/new` supports four through eight players on the existing standard Milty map layouts. Players snake draft a public pool of individual blue/red tiles, factions, and speaker positions in any order. The initial player order can be shuffled or entered explicitly. Faction bans and priorities apply when the pool is generated.

As in `MantisTileDraftableSettings` and `MantisMapBuildService`, players may draft zero to two extra tiles of each color and then discard to exactly three blue and two red tiles. During map building, the server randomly draws from the current player's remaining tiles. Zero to three mulligans per player allow drawing a different tile without discarding the original. Placement is restricted to that player's current position group: the inner tile, the two middle positions, then the two outer positions. Within a group, the next player has the most unfilled positions, with ties resolved in speaker order. The builder follows the bot's placement behavior and does not add Texas draft anomaly/wormhole adjacency restrictions.

The host can act for players, release a claimed player slot, and undo the latest action. Undo restores the prior random draw, hands, map, phase, and counters. Players claim their names using a browser cookie; only the slot owner or host can make picks. Public spectators can watch. Polling refreshes the shared draft, and a revision check rejects concurrent stale writes. Host credentials, slot credentials, and undo snapshots are excluded from public loader data.

Compatible completed bag drafts can start directly in map-building mode using their existing hands, home systems, speaker order, and custom faction labels. The handoff requires exactly three known blue and two known red tiles per player. Completed maps export Async Discord and Tabletop Playground strings, plus JSON results.

Tests play entire four-to-eight-player drafts through every map placement and cover quotas, extras, snake order, invalid placements, mulligan limits, undo, faction/supply validation, bag-to-map handoff, persistence conflicts, player ownership, and host authorization.

## Twilight's Fall Andcat pool controls

The existing reference-pack draft now supports banned and prioritized Mahact kings, banned faction reference cards, and preset packs. Preset input accepts three application faction IDs per pack, separated by commas, with packs separated by newlines or semicolons. Preset composition and order survive creation and cannot be rerolled. King priorities survive rerolls, and the preview protects required kings from removal.

Setup, preview, and server creation reject insufficient pools, missing prioritized kings, duplicate reference cards, banned cards in preset packs, and malformed pack sizes. The usable reference-card pool currently has 29 cards: Keleres has no reference priority/fleet data in this application. The effective maximum is nine complete packs before bans; the previous ten-pack setting could silently produce only nine. This change uses the available physical card count and reports impossible requests.

The bot can edit live reference-pack contents, replace per-player reference selections, and include additional homebrew kings. Those live administration commands and king sources are not added by these pool controls. `FactionTierDraftable` and `ExtraRingDraftable` in the downloaded bot are empty design stubs, so they are not advertised as working draft types.
