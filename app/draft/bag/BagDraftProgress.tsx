import {
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
import { IconCheck, IconClock, IconUser } from "@tabler/icons-react";
import type { BagDraftView } from "./types";
import classes from "./BagDraftProgress.module.css";
import { StatusPill } from "~/ui/StatusPill";

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
          <Text size="sm" className={classes.summary}>
            <strong>{donePlayers}</strong> / {view.players.length}{" "}
            {drafting ? "ready to pass" : "finished"}
          </Text>
        </Group>
        <Progress
          color={donePlayers === view.players.length ? "success.4" : "blue.3"}
          size="sm"
          value={
            view.players.length ? (donePlayers / view.players.length) * 100 : 0
          }
          aria-label={drafting ? "Players ready to pass" : "Players finished"}
        />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
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
                p="md"
                className={classes.player}
                data-own={ownSeat || undefined}
                aria-label={`${player.name}${ownSeat ? " (you)" : ""} draft progress`}
              >
                <Stack gap="sm">
                  <Group justify="space-between" gap="xs" align="flex-start">
                    <Text
                      size="lg"
                      fw={700}
                      style={{ overflowWrap: "anywhere", flex: 1 }}
                    >
                      {player.name}
                    </Text>
                    {ownSeat && (
                      <span className={classes.you}>
                        <IconUser size={16} aria-hidden="true" /> You
                      </span>
                    )}
                  </Group>
                  <Group>
                    <StatusPill
                      prominent
                      tone={done ? "success" : "warning"}
                      icon={
                        done ? (
                          <IconCheck size={18} aria-hidden="true" />
                        ) : (
                          <IconClock size={18} aria-hidden="true" />
                        )
                      }
                    >
                      {drafting
                        ? done
                          ? "Ready to pass"
                          : "Choosing"
                        : done
                          ? "Finished"
                          : "Building faction"}
                    </StatusPill>
                  </Group>
                  {drafting && (
                    <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                      <Text span inherit>
                        Passes to →{" "}
                      </Text>
                      <strong>{passingTo.name}</strong>
                    </Text>
                  )}
                  <Text size="sm" className={classes.collected}>
                    <strong>{player.draftedCount}</strong> components collected
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
