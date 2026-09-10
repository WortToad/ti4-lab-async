import {
  Badge,
  Divider,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { ReactNode } from "react";
import type { BagDraftView } from "./types";

export function BagDraftProgress({
  view,
  children,
}: {
  view: BagDraftView;
  children?: ReactNode;
}) {
  const drafting = view.phase === "drafting";
  const donePlayers = view.players.filter((player) =>
    drafting ? player.ready : player.finished,
  ).length;

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2} size="h3">
              {drafting
                ? `Collect components · Round ${view.round + 1}`
                : view.phase === "assembling"
                  ? "Final faction choices"
                  : "Draft complete"}
            </Title>
            {drafting && (
              <Text size="sm" c="dimmed" mt={4}>
                Keep your picks. Everyone passes the rest together once all
                players are ready.
              </Text>
            )}
          </div>
          <Badge
            variant="light"
            color={donePlayers === view.players.length ? "green" : "blue"}
          >
            {donePlayers} / {view.players.length}{" "}
            {drafting ? "ready to pass" : "finished"}
          </Badge>
        </Group>
        <Progress
          value={
            view.players.length ? (donePlayers / view.players.length) * 100 : 0
          }
          aria-label={drafting ? "Players ready to pass" : "Players finished"}
        />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
          {view.players.map((player, index) => {
            const done = drafting ? player.ready : player.finished;
            const passingTo =
              view.players[
                (index - 1 + view.players.length) % view.players.length
              ];
            const ownSeat = player.id === view.viewer.playerId;
            return (
              <Paper
                key={player.id}
                withBorder
                radius="sm"
                p="sm"
                bg={ownSeat ? "var(--mantine-color-violet-light)" : undefined}
              >
                <Stack gap={6}>
                  <Group justify="space-between" gap="xs" align="flex-start">
                    <Text
                      size="sm"
                      fw={600}
                      style={{ overflowWrap: "anywhere", flex: 1 }}
                    >
                      {player.name}
                      {ownSeat ? " (you)" : ""}
                    </Text>
                    <Badge
                      size="sm"
                      color={done ? "green" : "gray"}
                      variant="light"
                    >
                      {drafting
                        ? done
                          ? "Ready to pass"
                          : "Choosing"
                        : done
                          ? "Finished"
                          : "Building faction"}
                    </Badge>
                  </Group>
                  {drafting && (
                    <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                      <Text span c="dimmed">
                        Passes to →{" "}
                      </Text>
                      {passingTo.name}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {player.draftedCount} components collected
                  </Text>
                </Stack>
              </Paper>
            );
          })}
        </SimpleGrid>
        {children && (
          <>
            <Divider />
            {children}
          </>
        )}
      </Stack>
    </Paper>
  );
}
