import { Badge, Group, Stack, Text, Title } from "@mantine/core";
import { isTwilightsFallBag } from "./rules";
import type { BagDraftView } from "./types";

/** The current phase's instructions live with the lobby's full draft guide. */
export function BagDraftInstructions({ view }: { view: BagDraftView }) {
  const seat = view.privateSeat;
  if (view.phase === "lobby") return null;

  if (view.phase === "complete") {
    return (
      <Stack gap="sm">
        <Title order={4} size="h4">
          Your draft is complete
        </Title>
        <Text>
          Everyone’s final choices are now public. Copy the summary or download
          the results below.
          {view.mapRoomId
            ? " Open the map room to build the shared galaxy from your drafted tiles."
            : " See the map setup guide below for your next step."}
        </Text>
      </Stack>
    );
  }

  if (!seat) {
    return (
      <Text>
        {view.phase === "drafting"
          ? "Players choose from their private bags. Bags pass once everyone is ready."
          : "Players are choosing which collected components to keep. Final factions appear once everyone confirms."}
      </Text>
    );
  }

  if (view.phase === "assembling") {
    return (
      <Stack gap="sm">
        <Title order={4} size="h4">
          {seat.finished ? "Your faction is ready" : "Build your final faction"}
        </Title>
        {seat.finished ? (
          <Text>
            Your final components have been submitted. Waiting for the other
            players to finish. You can revise your faction until everyone
            finishes.
          </Text>
        ) : (
          <>
            <Text>
              Collection is complete. Choose which components to keep for your
              final faction and any tiles for the map. Keep the required count
              in each category, or all available choices if you have fewer.
              Categories with nothing to discard are already selected.
            </Text>
            <Text size="sm" c="dimmed">
              {isTwilightsFallBag(view.settings.variant)
                ? "Fill each category’s keep limit, or replace open ability, genome, or unit upgrade slots with generic technologies."
                : "Some components grant optional replacements. Keep the granting component to use its replacement; required companion components are included automatically in the final faction."}
            </Text>
            <Text size="sm" c="dimmed">
              Review and confirm your selection to finish. Your completed
              faction becomes public when everyone has finished.
            </Text>
          </>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Title order={4} size="h4">
          {seat.ready ? "Your bag is ready" : "Choose from your bag"}
        </Title>
        <Badge variant="light">{seat.bag.length} components in your bag</Badge>
      </Group>
      {seat.ready ? (
        <>
          <Text>
            {seat.roundPicks.length > 0
              ? "Your picks have been added to your collection. The bags will pass when everyone is ready."
              : "You have no available picks from this bag. It will pass automatically when everyone is ready."}
          </Text>
          <Text size="sm" c="dimmed">
            Waiting for:{" "}
            {view.players
              .filter((player) => !player.ready)
              .map((player) => player.name)
              .join(", ") || "the next bag"}
            .
          </Text>
        </>
      ) : (
        <>
          <Text>
            Choose {seat.picksRequired}{" "}
            {seat.picksRequired === 1 ? "component" : "components"} in total
            from this bag. Take at most one per category on this pass
            {view.settings.variant === "frankendraz"
              ? ", with multiple faction packages allowed"
              : ""}
            .
          </Text>
          <Text size="sm" c="dimmed">
            Submit your picks to review and confirm your selection. The
            remaining components pass to the next player when everyone is ready.
          </Text>
        </>
      )}
      <Text size="sm" c="dimmed">
        The collection maximum applies across all bags. Once you reach it, you
        cannot collect more of that category. After drafting ends, you choose
        which collected components to keep for your final faction and any tiles
        for the map.
      </Text>
    </Stack>
  );
}
