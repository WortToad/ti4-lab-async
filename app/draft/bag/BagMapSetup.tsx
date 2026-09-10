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
              : phase === "setup" || phase === "drafting"
                ? "How your drafted tiles become the map"
                : "Next step: build the map"}
        </Title>
        {includesTiles && (
          <Text size="sm">
            Each player can collect up to {draftBlues} blue and {draftReds} red
            tiles across all bags, then keep {keepBlues} blue and {keepReds} red
            tiles for the map.
          </Text>
        )}
        {includesTiles && (
          <List type="ordered" spacing="xs" size="sm">
            <List.Item>
              <strong>Draft tiles alongside components.</strong> Each tile uses
              one of your normal bag picks. Blue and red tiles are separate
              categories, so you can take at most one of each per pass. Picking
              a tile adds it to your collection; placement happens later.
            </List.Item>
            <List.Item>
              <strong>Finish your faction and tile choices.</strong> Once bag
              picking ends, confirm the components and tiles you will keep.
              {keepBlues === draftBlues && keepReds === draftReds
                ? " All your drafted map tiles are kept."
                : " Choose your kept tiles from your collection using the keep limits above."}
            </List.Item>
            {!unavailableReason && (
              <List.Item>
                <strong>Build your section of the shared map.</strong> Map
                building starts automatically once everyone confirms their final
                faction choices. Your kept tiles carry into the map room. On
                your turn, the builder randomly draws one of your remaining
                tiles. Place it in a highlighted space in your section of the
                galaxy, working from the center outward.
              </List.Item>
            )}
          </List>
        )}
        {!unavailableReason && (
          <Accordion variant="contained" w="100%">
            <Accordion.Item value="placement">
              <Accordion.Control>
                Placement order, home systems and mulligans
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  <Text size="sm">
                    Everyone fills their inner position near Mecatol Rex, then
                    the two middle positions, then the two outer positions.
                    Within each group, the player with the most empty spaces
                    places next.{" "}
                    {rules.keepLimits.DRAFTORDER
                      ? "Your kept speaker position sets your seat on the map and breaks ties for placement turns."
                      : "Without a drafted speaker order, the listed player order sets seating and breaks ties for placement turns."}
                  </Text>
                  <Text size="sm">
                    Your home system is separate from the five blue/red tiles.
                    The builder places your chosen home when supported, or shows
                    a home placeholder.
                  </Text>
                  <Text size="sm">
                    Each player has one mulligan for the entire map build: draw
                    a different tile from your remaining hand. The original
                    stays in your hand to be placed later. Once all tiles are
                    placed, export the completed map for your game.
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
