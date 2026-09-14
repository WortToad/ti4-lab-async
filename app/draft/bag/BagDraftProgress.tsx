import { Group, Text, Title, VisuallyHidden } from "@mantine/core";
import { useId } from "react";
import {
  IconArrowRight,
  IconArrowDown,
  IconCornerUpLeft,
  IconShield,
} from "@tabler/icons-react";
import type { BagDraftView } from "./types";
import classes from "./BagDraftProgress.module.css";

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
  // Bags go to the previous seat. Keep the first seat as a shared starting point.
  const players = waiting
    ? view.players
    : [...view.players.slice(0, 1), ...view.players.slice(1).reverse()];
  const playerName = (player: BagDraftView["players"][number]) =>
    slots.get(player.id)?.claimed ? player.name : `Open seat ${player.id + 1}`;

  return (
    <section className={classes.overview} aria-labelledby={headingId}>
      <Group justify="space-between" align="center" gap="xs">
        <Group gap="sm">
          <Title id={headingId} order={3} size="h3" className={classes.heading}>
            {drafting ? "Passing order" : "Players"}
          </Title>
          {!waiting && (
            <Text size="sm" className={classes.phase}>
              {drafting
                ? `Round ${view.round + 1}`
                : view.phase === "assembling"
                  ? "Final faction choices"
                  : "Draft complete"}
            </Text>
          )}
        </Group>
        <div className={classes.summary} aria-live="polite" aria-atomic="true">
          <span>
            <strong>{joined}</strong> / {players.length} joined
          </span>
          {!waiting && (
            <span>
              <strong>{donePlayers}</strong> / {players.length}{" "}
              {drafting ? "ready" : "finished"}
            </span>
          )}
        </div>
      </Group>
      <ol
        className={classes.chain}
        aria-label={drafting ? "Bag passing order" : "Players"}
        data-passing={drafting || undefined}
      >
        {players.map((player, index) => {
          const claimed = !!slots.get(player.id)?.claimed;
          const ownSeat = player.id === view.viewer.playerId;
          const done = drafting ? player.ready : player.finished;
          const status = !claimed
            ? "Not joined"
            : waiting
              ? "Joined"
              : done
                ? drafting
                  ? "Ready to pass"
                  : "Finished"
                : view.lobby.paused
                  ? "Paused"
                  : drafting
                    ? "Choosing picks"
                    : "Building faction";
          const tone = !claimed
            ? "neutral"
            : waiting || done
              ? "success"
              : "warning";
          const recipient = players[(index + 1) % players.length];

          return (
            <li key={player.id} className={classes.link}>
              <div
                className={classes.player}
                data-own={ownSeat || undefined}
                data-open={!claimed || undefined}
              >
                <div className={classes.identity}>
                  <span className={classes.name}>{playerName(player)}</span>
                  {claimed && view.lobby.adminPlayerId === player.id && (
                    <span className={classes.admin}>
                      <IconShield size={14} aria-hidden="true" />
                      <span>Admin</span>
                    </span>
                  )}
                  {ownSeat && <span className={classes.you}>You</span>}
                </div>
                <span className={classes.status} data-tone={tone}>
                  {status}
                </span>
              </div>
              {drafting && (
                <span
                  className={classes.connector}
                  title={`${playerName(player)} passes to ${playerName(recipient)}`}
                >
                  <VisuallyHidden>
                    {playerName(player)} passes to {playerName(recipient)}.
                  </VisuallyHidden>
                  <IconArrowRight
                    className={classes.rightArrow}
                    size={24}
                    aria-hidden="true"
                  />
                  <IconArrowDown
                    className={classes.downArrow}
                    size={24}
                    aria-hidden="true"
                  />
                </span>
              )}
            </li>
          );
        })}
        {drafting && players.length > 0 && (
          <li className={classes.link}>
            <div className={`${classes.player} ${classes.returnCard}`}>
              <span className={classes.returnIcon} aria-hidden="true">
                <IconCornerUpLeft size={26} />
              </span>
              <span className={classes.returnLabel}>
                <span className={classes.returnCaption}>Back to</span>
                <span className={classes.returnName}>
                  {playerName(players[0])}
                </span>
              </span>
            </div>
          </li>
        )}
      </ol>
    </section>
  );
}
