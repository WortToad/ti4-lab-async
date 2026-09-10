import { Anchor, Button, Paper, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import type { BagDraftView } from "./types";

export function BagMapSetup({
  view,
  mapPath,
}: {
  view: Pick<BagDraftView, "mapRoomId" | "mapBuildError" | "phase">;
  mapPath: string;
}) {
  return (
    <Paper withBorder p="lg" radius="md">
      <Stack align="flex-start">
        <Title order={2} size="h3">
          {view.mapRoomId ? "Continue to your map" : "Next step: build the map"}
        </Title>
        {!view.mapBuildError && (
          <Text>
            Use your drafted tiles, home systems, and speaker order. Each turn,
            draw a tile and place it in your part of the map, working from the
            center outward. Each player has one mulligan to draw a different
            tile.
          </Text>
        )}
        {view.mapRoomId ? (
          <>
            <Text size="sm">
              Your map room is ready. Your private player link carries your seat
              into the map automatically.
            </Text>
            <Button component={Link} to={mapPath}>
              Open map room
            </Button>
          </>
        ) : (
          <>
            {view.phase === "complete" && view.mapBuildError ? (
              <Text size="sm">{view.mapBuildError}</Text>
            ) : (
              <Text size="sm">
                Map building starts automatically once everyone finishes their
                final faction choices. You will go straight into the shared map
                room.
              </Text>
            )}
            {view.phase === "complete" && view.mapBuildError && (
              <Anchor component={Link} to="/map-generator">
                Open map generator
              </Anchor>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}
