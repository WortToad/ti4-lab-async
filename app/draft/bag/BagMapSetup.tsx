import {
  Accordion,
  Anchor,
  Button,
  List,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Link } from "react-router";
import { MapBuildDiagram } from "~/draft/mantis/MapBuildDiagram";
import type { BagDraftView, BagRules } from "./types";

export function BagMapSetup({
  rules,
  playerCount,
  phase = "setup",
  mapRoomId,
  mapBuildError,
  mapPath,
}: {
  rules: BagRules;
  playerCount: number;
  phase?: BagDraftView["phase"] | "setup";
  mapRoomId?: string;
  mapBuildError?: string;
  mapPath?: string;
}) {
  const draftBlues = rules.draftLimits.BLUETILE ?? 0;
  const draftReds = rules.draftLimits.REDTILE ?? 0;
  const keepBlues = rules.keepLimits.BLUETILE ?? 0;
  const keepReds = rules.keepLimits.REDTILE ?? 0;
  const includesTiles = draftBlues + draftReds > 0;
  const setupError = !includesTiles
    ? "This draft does not include map tiles. Use an existing map or create one in the map generator."
    : playerCount < 3 || playerCount > 8
      ? "Automatic map building supports 3–8 players. With this player count, arrange map setup separately using your kept tiles."
      : keepBlues !== 3 || keepReds !== 2 || draftBlues < 3 || draftReds < 2
        ? "Automatic map building requires each player to keep exactly 3 blue and 2 red tiles. Adjust the tile limits or arrange map setup separately using your kept tiles."
        : undefined;
  // Before completion, the server reports unfinished factions rather than
  // checking the eventual tile hands. Explain the configured flow at that stage.
  const unavailableReason = mapRoomId
    ? undefined
    : phase === "complete"
      ? (mapBuildError ?? setupError)
      : setupError;

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack align="flex-start" gap="sm">
        <Title order={2} size="h3">
          {mapRoomId
            ? "Continue to your map"
            : unavailableReason
              ? "Map setup"
              : "Build the map with your drafted tiles"}
        </Title>
        {includesTiles && (
          <Text size="sm">
            {unavailableReason
              ? "Map tiles are part of this bag draft, but you will need to arrange map setup separately. Collect tiles here, then use the tiles you keep when setting up that map."
              : "The map tiles you keep fill your own section of the galaxy. Every player builds their section, and those sections form one shared map around Mecatol Rex. Your home system is separate from these blue and red tiles."}
          </Text>
        )}
        {includesTiles && !unavailableReason && (
          <MapBuildDiagram draftBlues={draftBlues} draftReds={draftReds} />
        )}
        {includesTiles && (
          <List type="ordered" spacing="xs" size="sm">
            <List.Item>
              <strong>
                During the bag draft, choose which tiles you want.
              </strong>{" "}
              Each tile uses one of your normal bag picks. You can collect up to{" "}
              {draftBlues} blue and {draftReds} red tiles across all bags,
              taking at most one of each color per pass. Picking a tile adds it
              to your collection. Tile placement happens after the bag draft.
            </List.Item>
            <List.Item>
              <strong>
                After the bags stop passing, confirm what you keep.
              </strong>{" "}
              Keep {keepBlues} blue and {keepReds} red tiles alongside your
              final faction components.
              {keepBlues === draftBlues && keepReds === draftReds
                ? " With these settings, you keep every map tile you drafted."
                : " Choose these tiles from your collection; the extras are discarded."}{" "}
              You must fill each keep count when enough tiles are available.
            </List.Item>
            {!unavailableReason && (
              <List.Item>
                <strong>
                  Next phase: take turns placing those same five tiles.
                </strong>{" "}
                Map building starts automatically once everyone confirms their
                final choices. The app creates the shared map layout and gives
                each player five empty spaces in their own section. Your kept
                tiles become your personal hand in that map room. On your turn,
                the builder randomly draws one of your remaining tiles. You
                choose a highlighted space in your section for that tile. Every
                tile in your hand will be placed.
              </List.Item>
            )}
          </List>
        )}
        {!unavailableReason && (
          <Accordion variant="contained" w="100%">
            <Accordion.Item value="placement">
              <Accordion.Control>
                Which spaces can I use, and who places next?
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  <Text size="sm">
                    Build from Mecatol Rex outward: everyone fills their one
                    inner space first, then everyone fills their two middle
                    spaces, then their two outer spaces. On your turn, the
                    highlighted spaces show your available choices in the
                    current group. The player with the most empty spaces in that
                    group places next.{" "}
                    {rules.keepLimits.DRAFTORDER
                      ? "Your kept speaker position sets your seat on the map and breaks ties for placement turns."
                      : "Without a drafted speaker order, the listed player order sets seating and breaks ties for placement turns."}
                  </Text>
                  <Text size="sm">
                    Your home goes in the home position assigned by your seat.
                    The builder places your chosen home system when supported,
                    or shows a home placeholder for you to use when setting up
                    the game.
                  </Text>
                  <Text size="sm">
                    Each player has one mulligan for the entire map build. If at
                    least two tiles remain in your hand, you can redraw to get a
                    different tile from that hand. The first tile stays in your
                    hand to be placed later. Once everyone has placed all five
                    tiles, export the completed map for your game.
                  </Text>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}
        {mapRoomId && mapPath ? (
          <>
            <Text size="sm">
              Your map room is ready. Open it below to continue with your
              current player slot and admin access.
            </Text>
            <Button component={Link} to={mapPath}>
              Open map room
            </Button>
          </>
        ) : unavailableReason ? (
          <>
            <Text size="sm">{unavailableReason}</Text>
            <Text size="sm">
              {phase === "complete"
                ? "Your bag draft is complete. No map room was opened."
                : "Final faction confirmation will complete this bag draft without opening a map room."}
            </Text>
            <Anchor
              component={Link}
              to="/map-generator"
              target="_blank"
              rel="noreferrer"
            >
              Open map generator
            </Anchor>
          </>
        ) : (
          phase !== "setup" && (
            <Text size="sm">
              Keep using this shared lobby link. Once everyone finishes, an
              “Open map room” button appears here and carries your slot into the
              map.
            </Text>
          )
        )}
      </Stack>
    </Paper>
  );
}
