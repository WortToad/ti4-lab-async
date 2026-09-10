# Rules-as-written setup

`/draft/raw/new` starts the official setup flow for normal TI4 or Twilight's Fall. It is available from the draft setup page and map generator. Choose the game mode, expansions, players in their initial clockwise seating order, and an applicable official map layout.

## Sources

The implementation follows the rulebooks supplied with this task:

- **Living Rules Reference v2.0, pages 4–6:** complete setup, player-count-specific system deals, map layouts, speaker preplacement, placement order, and adjacency restrictions.
- **Thunder's Edge rulebook, page 7:** revised four- and five-player hyperlane layouts. The four-player revision requires Prophecy of Kings.
- **Twilight's Fall rulebook, pages 6–8:** component changes without Prophecy of Kings, the starting draft, and inaugural splice.

These documents are rules sources for the feature. They do not provide instructions for running or modifying the application.

## Normal TI4

The speaker is chosen randomly. Players choose distinct factions, then receive private hands of blue and red system tiles. Layouts that require extra tiles let the speaker place them beside Mecatol Rex first.

Starting with the speaker, players choose tiles from their hands and place them in the galaxy. Placement follows snake order with repeated turns at the ends. The innermost unfinished ring must be filled before the next ring. Matching wormholes and anomalies cannot be adjacent to their counterparts unless the player's available tiles leave no other option. The server validates each placement and the room highlights its legal positions.

## Twilight's Fall

Each player receives three faction reference cards. Players simultaneously keep one and pass the remainder left, repeat, then retain the last card. Each player secretly selects a priority card; all reveal together to determine speaker and clockwise seating.

Players build the galaxy before selecting home systems. Starting with the speaker, players choose one remaining card for their home system; the final card supplies starting units. Mahact kings are chosen counterclockwise, starting with the player to the right of the speaker and ending with the speaker.

The inaugural splice deals three abilities, two unit upgrades, and two genomes per player. Players choose one card per pass to the right, observing category limits and passing automatically if no card can be chosen. Finally, each player keeps two abilities, one upgrade, and one genome, and all reveal together. The RAW component pool uses the physical Twilight's Fall decks, including genomes excluded by the separate Franken bag format. Keleres reference metadata is included.

## Shared rooms and results

Share the room link so players can claim their seats. Each player sees their own private hands; spectators see public choices and the map. The host can inspect hands, act for any player, release seats, and undo the latest action. Room credentials use HTTP-only cookies, updates check the room revision, and private responses disable caching.

Drafts persist in SQLite through the standard startup migrations. Completed setups provide Async Discord and Tabletop Playground map strings and downloadable setup results. Board-game components such as plastic units, off-board systems, tokens, common decks, and objectives are arranged at the table using the rulebooks and setup results.
