import { Group, Progress, Text, Title } from "@mantine/core";
import { useId } from "react";
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconShield,
} from "@tabler/icons-react";
import type { BagDraftView } from "./types";
import classes from "./BagDraftProgress.module.css";
import { StatusPill } from "~/ui/StatusPill";

export function BagDraftProgress({ view }: { view: BagDraftView }) {
  const headingId = useId();
  const waiting = view.phase === "lobby";
  const drafting = view.phase === "drafting";
  const slots = new Map(view.lobby.slots.map((slot) => [slot.id, slot]));
  const joined = view.lobby.slots.filter((slot) => slot.claimed).length;
  const donePlayers = view.players.filter(
    (player) =>
      slots.get(player.id)?.claimed &&
      (drafting ? player.ready : player.finished),
  ).length;
  const progress = waiting ? joined : donePlayers;
  const total = view.players.length;
  const playerName = (player: BagDraftView["players"][number]) =>
    slots.get(player.id)?.claimed ? player.name : `Open seat ${player.id + 1}`;

  return (
    <section className={classes.overview} aria-labelledby={headingId}>
      <Group justify="space-between" align="flex-start" gap="sm">
        <div>
          <Title id={headingId} order={3} size="h3" className={classes.heading}>
            {drafting ? "Players & passing" : "Players"}
          </Title>
          {!waiting && (
            <Text size="sm" className={classes.phase} mt={4}>
              {drafting
                ? `Collect components · Round ${view.round + 1}`
                : view.phase === "assembling"
                  ? "Final faction choices"
                  : "Draft complete"}
            </Text>
          )}
        </div>
        <div className={classes.summary} aria-live="polite" aria-atomic="true">
          <span>
            <strong>{joined}</strong> / {total} joined
          </span>
          {!waiting && (
            <span>
              <strong>{donePlayers}</strong> / {total}{" "}
              {drafting ? "ready to pass" : "finished"}
            </span>
          )}
        </div>
      </Group>
      <Progress
        color={progress === total ? "success.4" : "sky.4"}
        size={4}
        value={total ? (progress / total) * 100 : 0}
        aria-label={
          waiting
            ? "Players joined"
            : drafting
              ? "Players ready to pass"
              : "Players finished"
        }
      />
      {(waiting || drafting) && (
        <Text size="sm" c="dimmed">
          {waiting
            ? "Everyone’s join status appears here. Passing order is set when the draft starts."
            : "Read each row left to right: incoming bag → player → next recipient. Bags pass together when everyone is ready."}
        </Text>
      )}
      <ul className={classes.players}>
        {view.players.map((player, index) => {
          const claimed = !!slots.get(player.id)?.claimed;
          const ownSeat = player.id === view.viewer.playerId;
          const done = drafting ? player.ready : player.finished;
          // The engine gives each seat the next seat's bag on every pass.
          const receivingFrom = view.players[(index + 1) % total];
          const passingTo = view.players[(index - 1 + total) % total];
          const status = !claimed
            ? "Waiting for player"
            : waiting
              ? "Waiting to start"
              : done
                ? drafting
                  ? "Ready to pass"
                  : "Finished"
                : view.lobby.paused
                  ? "Paused"
                  : drafting
                    ? "Choosing picks"
                    : "Building faction";

          return (
            <li
              key={player.id}
              className={classes.player}
              data-own={ownSeat || undefined}
              data-open={!claimed || undefined}
              aria-label={`${playerName(player)}${ownSeat ? " (you)" : ""} draft progress`}
            >
              <div
                className={classes.flow}
                data-passing={drafting || undefined}
              >
                {drafting && (
                  <>
                    <div className={classes.neighbor}>
                      <span className={classes.label}>
                        <span className={classes.fullLabel}>Receives from</span>
                        <span className={classes.shortLabel}>From</span>
                      </span>
                      <span className={classes.neighborName}>
                        {playerName(receivingFrom)}
                      </span>
                    </div>
                    <IconArrowRight
                      className={classes.arrow}
                      size={20}
                      aria-hidden="true"
                    />
                  </>
                )}
                <div className={classes.identity}>
                  <div className={classes.playerName}>
                    {playerName(player)}
                    {ownSeat && <span className={classes.you}>You</span>}
                  </div>
                  <span
                    className={classes.joined}
                    data-joined={claimed || undefined}
                  >
                    {claimed && <IconCheck size={14} aria-hidden="true" />}
                    {claimed ? "Joined" : "Not joined"}
                    {ownSeat && view.viewer.isAdmin && (
                      <span
                        role="img"
                        aria-label="Admin"
                        title="Admin"
                        className={classes.admin}
                      >
                        <IconShield size={16} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                </div>
                {drafting && (
                  <>
                    <IconArrowRight
                      className={classes.arrow}
                      size={20}
                      aria-hidden="true"
                    />
                    <div className={classes.neighbor}>
                      <span className={classes.label}>
                        <span className={classes.fullLabel}>Passes to</span>
                        <span className={classes.shortLabel}>To</span>
                      </span>
                      <span className={classes.neighborName}>
                        {playerName(passingTo)}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className={classes.status}>
                <StatusPill
                  tone={
                    !claimed || waiting
                      ? "neutral"
                      : done
                        ? "success"
                        : "warning"
                  }
                  icon={
                    claimed && !waiting && done ? (
                      <IconCheck size={18} />
                    ) : (
                      <IconClock size={18} />
                    )
                  }
                >
                  {status}
                </StatusPill>
                {!waiting && (
                  <span className={classes.collected}>
                    <strong>{player.draftedCount}</strong> collected
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
