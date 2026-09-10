# Rules-as-written setup

`/draft/raw/new` creates a shared lobby for the official setup flow for normal TI4 or Twilight's Fall. It is available from the draft setup page and map generator. Choose the game mode, expansions, number of player slots, and an applicable official map layout. Players enter their own names when they join.

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

Share the same lobby link with everyone. Each player enters their name to join and receives a recovery UUID to copy or download. An available player slot is assigned automatically; the draft and seating remain hidden until everyone has joined and the admin starts. The browser remembers player and admin access separately through HTTP-only cookies and local storage. A saved UUID restores the same role from the lobby link or the main page on another device.

Each player sees their own private hands. Spectators and the admin see public choices and the map; admin access does not reveal other players' system tiles, reference cards, or unrevealed splice choices. An admin who is also playing enters their name and joins as a player.

The admin can retrieve or replace player UUIDs, rename players, release slots for replacements, pause play, undo actions, and restore earlier checkpoints. Releasing an active slot pauses the draft until a replacement joins. Restored games pause for review and preserve current player names and recovery UUIDs. Save files are encrypted so the admin can export and import state without revealing private hands; a file can be imported into the same lobby that exported it. Updates check the room revision, and private responses disable caching.

Drafts persist in SQLite through the standard startup migrations. Completed setups provide Async Discord and Tabletop Playground map strings and downloadable setup results. Board-game components such as plastic units, off-board systems, tokens, common decks, and objectives are arranged at the table using the rulebooks and setup results.
