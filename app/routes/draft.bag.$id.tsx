import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Button,
  CopyButton,
  Group,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import {
  data,
  isRouteErrorResponse,
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useLocation,
  useRevalidator,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { BagItemCard, bagCategoryLabel } from "~/draft/bag/BagComponents";
import {
  getBagDraftView,
  getCompletedBagDraft,
  mutateBagDraft,
} from "~/draft/bag/bagDraft.server";
import { bagToMantisState } from "~/draft/bag/bagToMantis";
import {
  createMantisRoomFromState,
  mantisCookie,
} from "~/drizzle/mantisDraft.server";
import type { BagDraftItem, BagItemCategory } from "~/draft/bag/catalog";
import { BAG_VARIANTS } from "~/draft/bag/rules";
import type { BagDraftAction, BagDraftView } from "~/draft/bag/types";

const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

type BagPageAction = BagDraftAction | { action: "buildMap" };

export function headers() {
  return privateHeaders;
}

export function meta() {
  return [
    { title: "Bag draft · TI4 Lab" },
    { name: "robots", content: "noindex, nofollow" },
    { name: "referrer", content: "no-referrer" },
  ];
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const key = new URL(request.url).searchParams.get("key") ?? undefined;
  const view = await getBagDraftView(params.id!, key);
  return data(view, { headers: privateHeaders });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const key = new URL(request.url).searchParams.get("key") ?? undefined;
  const form = await request.formData();
  try {
    const input = JSON.parse(
      String(form.get("operation") ?? ""),
    ) as BagPageAction;
    if (input.action === "buildMap") {
      const completed = await getCompletedBagDraft(params.id!, key);
      const room = createMantisRoomFromState(bagToMantisState(completed));
      return redirect(`/draft/mantis/${room.id}`, {
        headers: {
          ...privateHeaders,
          "Set-Cookie": await mantisCookie(room.id).serialize(room.token),
        },
      });
    }
    await mutateBagDraft(params.id!, key, input);
    return data({ error: null }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof Response)
      return data(
        { error: await error.text() },
        { status: error.status, headers: privateHeaders },
      );
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update this draft. Refresh and try again.",
      },
      { status: 400, headers: privateHeaders },
    );
  }
}

type PrivateSeat = NonNullable<BagDraftView["privateSeat"]>;
type SubmitOperation = (operation: BagDraftAction) => void;

function groupedItems(items: BagDraftItem[]) {
  const groups = new Map<BagItemCategory, BagDraftItem[]>();
  for (const item of items)
    groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  return Array.from(groups);
}

function CopyLink({
  path,
  label,
  origin,
}: {
  path: string;
  label: string;
  origin: string;
}) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Anchor
        component={Link}
        to={path}
        size="sm"
        style={{ overflowWrap: "anywhere" }}
      >
        {label}
      </Anchor>
      <CopyButton value={`${origin}${path}`}>
        {({ copied, copy }) => (
          <Button size="xs" variant="light" onClick={copy} disabled={!origin}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        )}
      </CopyButton>
    </Group>
  );
}

function CollectedItems({
  items,
  view,
}: {
  items: BagDraftItem[];
  view: BagDraftView;
}) {
  return (
    <Accordion variant="separated" multiple>
      {groupedItems(items).map(([category, cards]) => (
        <Accordion.Item key={category} value={category}>
          <Accordion.Control>
            {bagCategoryLabel(category, view.settings.variant)} · {cards.length}
          </Accordion.Control>
          <Accordion.Panel>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {cards.map((item) => (
                <BagItemCard key={item.id} item={item} />
              ))}
            </SimpleGrid>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

function DraftPicking({
  view,
  seat,
  busy,
  submit,
}: {
  view: BagDraftView;
  seat: PrivateSeat;
  busy: boolean;
  submit: SubmitOperation;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedCategories = new Set(
    seat.bag
      .filter((item) => selectedIds.includes(item.id))
      .map((item) => item.category),
  );
  const legalIds = new Set(seat.draftableItemIds);
  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={2} size="h3">
              Your current bag
            </Title>
            <Badge variant="light">{seat.bag.length} components</Badge>
          </Group>
          {seat.ready ? (
            <>
              <Text>
                Your picks are submitted. The bags will pass when everyone is
                ready.
              </Text>
              {seat.roundPicks.length > 0 && (
                <Text size="sm" c="dimmed">
                  This round:{" "}
                  {seat.hand
                    .filter((item) => seat.roundPicks.includes(item.id))
                    .map((item) => item.name)
                    .join(", ")}
                </Text>
              )}
              {seat.canUndo && (
                <Button
                  variant="light"
                  onClick={() => submit({ action: "undo", round: view.round })}
                  disabled={busy}
                  style={{ alignSelf: "flex-start" }}
                >
                  Undo this round’s picks
                </Button>
              )}
            </>
          ) : (
            <>
              <Text>
                Choose {seat.picksRequired}{" "}
                {seat.picksRequired === 1 ? "component" : "components"}. You can
                take one of each category from this bag
                {view.settings.variant === "frankendraz"
                  ? ", with multiple faction packages allowed"
                  : ""}
                .
              </Text>
              <Text size="sm" c="dimmed">
                Unavailable components have reached your draft limit. You will
                choose your final faction after the bags finish passing.
              </Text>
              <Button
                onClick={() =>
                  submit({
                    action: "pick",
                    round: view.round,
                    itemIds: selectedIds,
                  })
                }
                disabled={busy || selectedIds.length !== seat.picksRequired}
                loading={busy}
                style={{ alignSelf: "flex-start" }}
              >
                {seat.picksRequired === 0
                  ? "Pass this bag"
                  : `Submit ${selectedIds.length} / ${seat.picksRequired} picks`}
              </Button>
            </>
          )}
        </Stack>
      </Paper>
      {!seat.ready &&
        groupedItems(seat.bag).map(([category, items]) => {
          const collected = seat.hand.filter(
            (item) => item.category === category,
          ).length;
          return (
            <Stack key={category} gap="sm">
              <Group justify="space-between">
                <Title order={3} size="h4">
                  {bagCategoryLabel(category, view.settings.variant)}
                </Title>
                <Text size="sm" c="dimmed">
                  Collected {collected} /{" "}
                  {view.rules.draftLimits[category] ?? 0}
                </Text>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                {items.map((item) => {
                  const selected = selectedIds.includes(item.id);
                  const categoryTaken =
                    category !== "FACTION" && selectedCategories.has(category);
                  const categoryFull =
                    collected +
                      seat.bag.filter(
                        (candidate) =>
                          candidate.category === category &&
                          selectedIds.includes(candidate.id),
                      ).length >=
                    (view.rules.draftLimits[category] ?? 0);
                  return (
                    <BagItemCard
                      key={item.id}
                      item={item}
                      selected={selected}
                      disabled={
                        busy ||
                        (!selected &&
                          (!legalIds.has(item.id) ||
                            categoryTaken ||
                            categoryFull ||
                            selectedIds.length >= seat.picksRequired))
                      }
                      onSelect={(checked) =>
                        setSelectedIds((current) =>
                          checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                  );
                })}
              </SimpleGrid>
            </Stack>
          );
        })}
      {seat.hand.length > 0 && (
        <Stack>
          <Title order={2} size="h3">
            Your drafted components ({seat.hand.length})
          </Title>
          <CollectedItems items={seat.hand} view={view} />
        </Stack>
      )}
    </Stack>
  );
}

function FactionAssembly({
  view,
  seat,
  busy,
  submit,
}: {
  view: BagDraftView;
  seat: PrivateSeat;
  busy: boolean;
  submit: SubmitOperation;
}) {
  const twilightsFall =
    view.settings.variant === "twilights_fall" ||
    view.settings.variant === "inaugural_splice";
  const genericTechIds = new Set(
    twilightsFall ? ["TECH:wavelength", "TECH:antimatter"] : [],
  );
  const genericOptions = seat.assemblyOptions.filter((item) =>
    genericTechIds.has(item.id),
  );
  const groups = groupedItems(
    seat.assemblyOptions.filter((item) => !genericTechIds.has(item.id)),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    seat.keptItemIds.length > 0
      ? seat.keptItemIds
      : groups.flatMap(([category, items]) =>
          items.length <= (view.rules.keepLimits[category] ?? 0)
            ? items.map((item) => item.id)
            : [],
        ),
  );
  const requirements = groups.filter(
    ([category]) => (view.rules.keepLimits[category] ?? 0) > 0,
  );
  const replaceable = (category: BagItemCategory) =>
    twilightsFall && ["TECH", "AGENT", "UNIT"].includes(category);
  const replacementSlots = requirements.reduce(
    (slots, [category, items]) =>
      replaceable(category)
        ? slots +
          Math.min(items.length, view.rules.keepLimits[category] ?? 0) -
          items.filter((item) => selectedIds.includes(item.id)).length
        : slots,
    0,
  );
  const genericCount = selectedIds.filter((id) =>
    genericTechIds.has(id),
  ).length;
  const complete =
    genericCount === replacementSlots &&
    requirements.every(([category, items]) => {
      const selected = items.filter((item) =>
        selectedIds.includes(item.id),
      ).length;
      const required = Math.min(
        items.length,
        view.rules.keepLimits[category] ?? 0,
      );
      return replaceable(category)
        ? selected <= required
        : selected === required;
    });
  if (seat.finished) {
    return (
      <Stack>
        <Alert color="green" title="Your faction is ready">
          Your final components have been submitted. Waiting for the other
          players to finish.
        </Alert>
        <Button
          variant="light"
          onClick={() => submit({ action: "reopen" })}
          disabled={busy}
          style={{ alignSelf: "flex-start" }}
        >
          Revise your faction
        </Button>
        <CollectedItems
          items={seat.assemblyOptions.filter((item) =>
            seat.keptItemIds.includes(item.id),
          )}
          view={view}
        />
      </Stack>
    );
  }
  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Title order={2} size="h3">
            Build your final faction
          </Title>
          <Text>
            Choose the components to keep in each category. Categories with no
            choices are already selected.
          </Text>
          <Text size="sm" c="dimmed">
            Your completed faction becomes public when everyone has finished.
          </Text>
          {!twilightsFall && (
            <Text size="sm" c="dimmed">
              Some components grant optional replacements. Keep the granting
              component to use its replacement; required companion components
              are included automatically in the final faction.
            </Text>
          )}
          <Button
            onClick={() => submit({ action: "assemble", itemIds: selectedIds })}
            disabled={busy || !complete}
            loading={busy}
            style={{ alignSelf: "flex-start" }}
          >
            Finalize faction
          </Button>
          {!complete && (
            <Text size="sm" c="dimmed">
              {twilightsFall
                ? "Fill each category’s keep limit, or replace open ability, genome, or unit upgrade slots with generic technologies."
                : "Fill each category’s keep limit to finalize."}
            </Text>
          )}
        </Stack>
      </Paper>
      {genericOptions.length > 0 && (
        <Stack gap="sm">
          <Title order={3} size="h4">
            Generic technology replacements
          </Title>
          <Text size="sm">
            You may replace any ability, genome, or unit upgrade with Wavelength
            or Antimatter. Deselect one drafted component for each generic
            technology you keep.
          </Text>
          <Text
            size="sm"
            c={genericCount === replacementSlots ? "dimmed" : "orange"}
          >
            {genericCount} generic{" "}
            {genericCount === 1 ? "technology" : "technologies"} selected ·{" "}
            {replacementSlots} open replacement{" "}
            {replacementSlots === 1 ? "slot" : "slots"}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {genericOptions.map((item) => (
              <BagItemCard
                key={item.id}
                item={item}
                selected={selectedIds.includes(item.id)}
                disabled={busy}
                onSelect={(checked) =>
                  setSelectedIds((current) =>
                    checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id),
                  )
                }
              />
            ))}
          </SimpleGrid>
        </Stack>
      )}
      {requirements.map(([category, items]) => {
        const limit = Math.min(
          items.length,
          view.rules.keepLimits[category] ?? 0,
        );
        const count = items.filter((item) =>
          selectedIds.includes(item.id),
        ).length;
        return (
          <Stack key={category} gap="sm">
            <Group justify="space-between">
              <Title order={3} size="h4">
                {bagCategoryLabel(category, view.settings.variant)}
              </Title>
              <Badge color={count === limit ? "green" : "blue"} variant="light">
                Keep {count} / {limit}
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {items.map((item) => (
                <BagItemCard
                  key={item.id}
                  item={item}
                  note={
                    seat.assemblyOptions.some((parent) =>
                      parent.optionalSwaps?.includes(item.id),
                    )
                      ? `Optional replacement offered by ${seat.assemblyOptions
                          .filter((parent) =>
                            parent.optionalSwaps?.includes(item.id),
                          )
                          .map((parent) => parent.name)
                          .join(", ")}.`
                      : undefined
                  }
                  selected={selectedIds.includes(item.id)}
                  disabled={
                    busy || (!selectedIds.includes(item.id) && count >= limit)
                  }
                  onSelect={(checked) =>
                    setSelectedIds((current) =>
                      checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id),
                    )
                  }
                />
              ))}
            </SimpleGrid>
          </Stack>
        );
      })}
    </Stack>
  );
}

export default function BagDraftPage() {
  const view = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const location = useLocation();
  const [origin, setOrigin] = useState("");
  const [confirmUndo, setConfirmUndo] = useState(false);
  const busy = fetcher.state !== "idle";
  const variant = BAG_VARIANTS.find(
    (entry) => entry.id === view.settings.variant,
  );
  const seat = view.privateSeat;
  const playerName = view.players.find(
    (player) => player.id === view.viewer.playerId,
  )?.name;
  const publicPath = `/draft/bag/${view.id}`;
  const donePlayers = view.players.filter((player) =>
    view.phase === "drafting" ? player.ready : player.finished,
  ).length;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        revalidator.state === "idle" &&
        fetcher.state === "idle"
      )
        void revalidator.revalidate();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [revalidator, fetcher.state]);

  function submit(operation: BagPageAction) {
    void fetcher.submit(
      { operation: JSON.stringify(operation) },
      { method: "post", action: `${location.pathname}${location.search}` },
    );
  }

  const exportText = [
    variant?.name ?? "Bag draft",
    ...view.players.map(
      (player) =>
        `\n${player.name}\n${groupedItems(player.keptItems ?? [])
          .map(
            ([category, items]) =>
              `${bagCategoryLabel(category, view.settings.variant)}: ${items.map((item) => item.name).join(", ")}`,
          )
          .join("\n")}`,
    ),
  ].join("\n");
  const exportJson = JSON.stringify(
    {
      id: view.id,
      variant: view.settings.variant,
      settings: view.settings,
      players: view.players.map((player) => ({
        name: player.name,
        items: player.keptItems ?? [],
      })),
    },
    null,
    2,
  );

  return (
    <Stack className="ph-no-capture" maw={1200} mx="auto" py="xl" gap="lg">
      <Group justify="space-between">
        <Anchor component={Link} to="/draft/bag/new" size="sm">
          ← Create another bag draft
        </Anchor>
        <Badge variant="light">
          {view.viewer.isAdmin
            ? "Host"
            : playerName
              ? `Playing as ${playerName}`
              : "Spectator"}
        </Badge>
      </Group>
      <div>
        <Title order={1}>{variant?.name ?? "Bag draft"}</Title>
        <Text c="dimmed" mt="xs">
          {variant?.description}
        </Text>
      </div>
      {fetcher.data?.error && (
        <Alert color="red" title="Could not save your change">
          {fetcher.data.error}
        </Alert>
      )}
      <Paper withBorder p="lg" radius="md">
        <Stack>
          <Group justify="space-between">
            <Title order={2} size="h3">
              {view.phase === "drafting"
                ? `Round ${view.round + 1}`
                : view.phase === "assembling"
                  ? "Final faction choices"
                  : "Draft complete"}
            </Title>
            <Text size="sm" c="dimmed">
              {donePlayers} / {view.players.length}{" "}
              {view.phase === "drafting" ? "ready to pass" : "finished"}
            </Text>
          </Group>
          <Progress
            value={(donePlayers / view.players.length) * 100}
            aria-label="Players ready"
          />
          <Table.ScrollContainer minWidth={340}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Player</Table.Th>
                  <Table.Th>Components</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {view.players.map((player) => (
                  <Table.Tr key={player.id}>
                    <Table.Td>
                      {player.name}
                      {player.id === view.viewer.playerId ? " (you)" : ""}
                    </Table.Td>
                    <Table.Td>{player.draftedCount}</Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        color={
                          (
                            view.phase === "drafting"
                              ? player.ready
                              : player.finished
                          )
                            ? "green"
                            : "gray"
                        }
                        variant="light"
                      >
                        {view.phase === "drafting"
                          ? player.ready
                            ? "Ready"
                            : "Choosing"
                          : player.finished
                            ? "Finished"
                            : "Building faction"}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Paper>
      {view.viewer.isAdmin && (
        <Paper withBorder p="lg" radius="md">
          <Stack>
            <Title order={2} size="h3">
              Invite your players
            </Title>
            <Text size="sm">
              Save your host link. Send each private seat link to its player;
              anyone with that link can make their picks.
            </Text>
            <CopyLink
              path={`${location.pathname}${location.search}`}
              label="Your private host link"
              origin={origin}
            />
            <CopyLink
              path={publicPath}
              label="Public spectator link"
              origin={origin}
            />
            {view.seatLinks?.map((link) => (
              <CopyLink
                key={link.id}
                path={link.path}
                label={`${link.name} · private seat`}
                origin={origin}
              />
            ))}
            <Group>
              {view.canUndoRound && (
                <Button
                  color="orange"
                  variant="light"
                  onClick={() => setConfirmUndo(true)}
                  disabled={busy}
                >
                  Rewind draft round
                </Button>
              )}
              {view.canBuildMap && (
                <Button
                  onClick={() => submit({ action: "buildMap" })}
                  loading={busy}
                >
                  Build map from drafted tiles
                </Button>
              )}
            </Group>
            {view.canBuildMap && (
              <Text size="sm" c="dimmed">
                Continue with your drafted tiles, home systems, and speaker
                order. Players take turns drawing and placing tiles to build the
                map from the center outward.
              </Text>
            )}
          </Stack>
        </Paper>
      )}
      {seat && view.phase === "drafting" && (
        <DraftPicking
          key={`${view.id}:${seat.id}:${view.round}:${seat.ready}`}
          view={view}
          seat={seat}
          busy={busy}
          submit={submit}
        />
      )}
      {seat && view.phase === "assembling" && (
        <FactionAssembly
          key={`${view.id}:${seat.id}:${seat.finished}`}
          view={view}
          seat={seat}
          busy={busy}
          submit={submit}
        />
      )}
      {!seat && view.phase !== "complete" && (
        <Alert
          color="blue"
          title={
            view.viewer.isAdmin ? "Draft progress" : "Spectating this draft"
          }
        >
          {view.viewer.isAdmin
            ? "Open a player’s private seat link to draft for that seat. This page updates automatically as players make their picks."
            : "This page updates automatically. Use your private player link to see your bag and make picks."}
        </Alert>
      )}
      {view.phase === "complete" && (
        <Stack gap="lg">
          <Group justify="space-between">
            <Title order={2}>Completed factions</Title>
            <Group>
              {seat && (
                <Button
                  variant="light"
                  onClick={() => submit({ action: "reopen" })}
                  disabled={busy}
                >
                  Revise your faction
                </Button>
              )}
              <CopyButton value={exportText}>
                {({ copied, copy }) => (
                  <Button variant="light" onClick={copy}>
                    {copied ? "Copied" : "Copy summary"}
                  </Button>
                )}
              </CopyButton>
              <Button
                component="a"
                href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson)}`}
                download={`ti4-bag-draft-${view.id}.json`}
                variant="light"
              >
                Download JSON
              </Button>
            </Group>
          </Group>
          {view.players.map((player) => (
            <Paper key={player.id} withBorder p="lg" radius="md">
              <Stack>
                <Title order={3}>{player.name}</Title>
                <CollectedItems items={player.keptItems ?? []} view={view} />
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
      <Modal
        opened={confirmUndo}
        onClose={() => setConfirmUndo(false)}
        title="Rewind the draft round?"
        centered
      >
        <Stack>
          <Text>
            This restores the current round’s starting bags for every player. If
            nobody has picked this round, it returns to the previous round
            instead. Later picks and faction choices will be discarded.
          </Text>
          <Button
            color="orange"
            onClick={() => {
              setConfirmUndo(false);
              submit({ action: "undoRound", revision: view.revision });
            }}
          >
            Restore round
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  const message =
    isRouteErrorResponse(error) && typeof error.data === "string"
      ? error.data
      : "This draft could not be loaded. Please refresh and try again.";
  return (
    <Stack maw={800} mx="auto" py="xl">
      <Alert color="red" title="Unable to open this draft">
        {message}
      </Alert>
      {isRouteErrorResponse(error) && error.status === 403 && (
        <Anchor component={Link} to={location.pathname}>
          Open the public spectator view
        </Anchor>
      )}
      <Anchor component={Link} to="/draft/bag/new">
        Create a bag draft
      </Anchor>
    </Stack>
  );
}
