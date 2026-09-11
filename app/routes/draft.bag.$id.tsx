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
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useState, type Dispatch, type SetStateAction } from "react";
import {
  data,
  isRouteErrorResponse,
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useLocation,
  useRouteError,
  type ActionFunctionArgs,
  type ClientLoaderFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { BagItemCard, bagCategoryLabel } from "~/draft/bag/BagComponents";
import { BagMapSetup } from "~/draft/bag/BagMapSetup";
import { BagDraftGuide } from "~/draft/bag/BagDraftGuide";
import { BagDraftProgress } from "~/draft/bag/BagDraftProgress";
import { BagSelectionConfirmation } from "~/draft/bag/BagSelectionConfirmation";
import { BagSelectionActions } from "~/draft/bag/BagSelectionActions";
import { usePendingBagSelections } from "~/draft/bag/usePendingBagSelections";
import {
  availableAssemblyItemIds,
  includeAssemblyCompanions,
} from "~/draft/bag/assembly";
import { LobbyPanel, type LobbyOperation } from "~/draft/LobbyPanel";
import { DraftTurnStatus } from "~/draft/DraftTurnStatus";
import { getBagPendingAction } from "~/draft/turn";
import { useLobbyRefresh } from "~/hooks/useLobbyRefresh";
import { createOrderedLoader } from "~/hooks/orderedLoader";
import { OriginalArtToggle } from "~/components/OriginalArtToggle";
import {
  bagCookie,
  readBagToken,
  joinBagDraft,
  recoverBagDraft,
  exportBagDraft,
  getBagDraftView,
  getBagMapAccess,
  mutateBagDraft,
} from "~/draft/bag/bagDraft.server";
import { mantisCookie, mantisAdminCookie } from "~/drizzle/mantisDraft.server";
import type { BagDraftItem, BagItemCategory } from "~/draft/bag/catalog";
import { BAG_VARIANTS } from "~/draft/bag/rules";
import type { BagDraftAction, BagDraftView } from "~/draft/bag/types";

const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

export function headers() {
  return privateHeaders;
}

export function meta() {
  return [
    { title: "Bag draft · TI4 Draft Command" },
    { name: "robots", content: "noindex, nofollow" },
    { name: "referrer", content: "no-referrer" },
  ];
}

const loadClientDraft =
  createOrderedLoader<
    Exclude<Awaited<ReturnType<typeof loader>>, Response>["data"]
  >();

export function clientLoader({
  request,
  serverLoader,
}: ClientLoaderFunctionArgs) {
  return loadClientDraft(new URL(request.url).pathname, () =>
    serverLoader<typeof loader>(),
  );
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id!;
  const url = new URL(request.url);
  const legacyKey = url.searchParams.get("key");
  const headers = new Headers(privateHeaders);
  if (legacyKey) {
    const { role } = await recoverBagDraft(id, legacyKey);
    headers.append(
      "Set-Cookie",
      await bagCookie(id, role).serialize(legacyKey),
    );
    url.searchParams.delete("key");
    return redirect(`/draft/bag/${id}${url.search}`, { headers });
  }
  const [key, adminKey] = await Promise.all([
    readBagToken(id, request),
    readBagToken(id, request, "admin"),
  ]);
  let view: BagDraftView;
  let accessError: string | null = null;
  try {
    view = await getBagDraftView(id, key, adminKey);
  } catch (error) {
    if (!(error instanceof Response) || error.status !== 403 || !key)
      throw error;
    headers.append(
      "Set-Cookie",
      await bagCookie(id).serialize("", { maxAge: 0 }),
    );
    view = await getBagDraftView(id, undefined, adminKey);
    accessError =
      "Your player recovery code has changed. Ask the admin for your current code and rejoin below.";
  }
  if (view.mapRoomId && url.searchParams.get("map") === "1")
    return redirectToMap(id, accessError ? undefined : key, adminKey);
  return data({ ...view, accessError }, { headers });
}

async function redirectToMap(id: string, key?: string, adminKey?: string) {
  const room = await getBagMapAccess(id, key, adminKey);
  if (!room)
    throw new Response("The map room is not ready yet.", { status: 409 });
  const headers = new Headers(privateHeaders);
  if (room.token)
    headers.append(
      "Set-Cookie",
      await mantisCookie(room.id).serialize(room.token),
    );
  if (room.adminToken)
    headers.append(
      "Set-Cookie",
      await mantisAdminCookie(room.id).serialize(room.adminToken),
    );
  return redirect(`/draft/mantis/${room.id}`, { headers });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const id = params.id!;
  const [cookieKey, adminKey] = await Promise.all([
    readBagToken(id, request),
    readBagToken(id, request, "admin"),
  ]);
  const key = new URL(request.url).searchParams.get("key") ?? cookieKey;
  const headers = new Headers(privateHeaders);
  try {
    const form = await request.formData();
    const input = JSON.parse(String(form.get("operation") ?? "")) as
      | BagDraftAction
      | { action: "join"; name: string }
      | { action: "recover"; uuid: string }
      | { action: "exportState"; checkpointId?: string };
    if (input.action === "join") {
      const { uuid } = await joinBagDraft(id, input.name, key);
      headers.append("Set-Cookie", await bagCookie(id).serialize(uuid));
    } else if (input.action === "recover") {
      const uuid = input.uuid.trim().toLowerCase();
      const { role } = await recoverBagDraft(id, uuid);
      headers.append("Set-Cookie", await bagCookie(id, role).serialize(uuid));
    } else if (input.action === "exportState") {
      const backup = await exportBagDraft(
        id,
        key,
        adminKey,
        input.checkpointId,
      );
      return data({ error: null, backup }, { headers });
    } else {
      await mutateBagDraft(id, key, input, adminKey);
    }
    return data({ error: null, backup: null }, { headers });
  } catch (error) {
    if (error instanceof Response)
      return data(
        { error: await error.text(), backup: null },
        { status: error.status, headers },
      );
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update this draft. Refresh and try again.",
        backup: null,
      },
      { status: 400, headers },
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
                <BagItemCard
                  key={item.id}
                  item={item}
                  variant={view.settings.variant}
                />
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
  selectedIds,
  setSelectedIds,
}: {
  view: BagDraftView;
  seat: PrivateSeat;
  busy: boolean;
  submit: SubmitOperation;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
}) {
  const [confirmSelection, setConfirmSelection] = useState(false);
  const seatIndex = view.players.findIndex((player) => player.id === seat.id);
  // Each seat receives the next seat's bag and passes to the previous seat.
  const receivingFrom = view.players[(seatIndex + 1) % view.players.length];
  const passingTo =
    view.players[(seatIndex - 1 + view.players.length) % view.players.length];
  const selectedCategories = new Set(
    seat.bag
      .filter((item) => selectedIds.includes(item.id))
      .map((item) => item.category),
  );
  const legalIds = new Set(seat.draftableItemIds);
  const selectedItems = seat.bag.filter((item) =>
    selectedIds.includes(item.id),
  );
  return (
    <Stack gap="lg">
      <BagDraftProgress view={view}>
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={3} size="h4">
              {seat.ready ? "Your bag is ready" : "Choose from your bag"}
            </Title>
            <Badge variant="light">
              {seat.bag.length} components in your bag
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>
            Receiving from {receivingFrom.name} · Passing to {passingTo.name}
          </Text>
          {seat.ready ? (
            <>
              <Text>
                {seat.roundPicks.length > 0
                  ? "Your picks have been added to your collection. The bags will pass when everyone is ready."
                  : "You have no available picks from this bag. It will pass automatically when everyone is ready."}
              </Text>
              <Text size="sm" c="dimmed" role="status">
                Waiting for:{" "}
                {view.players
                  .filter((player) => !player.ready)
                  .map((player) => player.name)
                  .join(", ") || "the next bag"}
                .
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
                  variant="outline"
                  color="orange.3"
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
                {seat.picksRequired === 1 ? "component" : "components"} in total
                from this bag. Take at most one per category on this pass
                {view.settings.variant === "frankendraz"
                  ? ", with multiple faction packages allowed"
                  : ""}
                .
              </Text>
              <Text size="sm" c="dimmed">
                Submit your picks to review and confirm your selection. The
                remaining components pass to the next player when everyone is
                ready.
              </Text>
            </>
          )}
          <Text size="sm" c="dimmed">
            The collection maximum applies across all bags. Once you reach it,
            you cannot collect more of that category. After drafting ends, you
            choose which collected components to keep for your final faction and
            any tiles for the map.
          </Text>
        </Stack>
      </BagDraftProgress>
      {!seat.ready && (
        <BagSelectionActions
          status={`Selected ${selectedIds.length} of ${seat.picksRequired} picks for this bag`}
          detail={selectedItems.map((item) => item.name).join(" · ")}
        >
          {selectedIds.length > 0 && (
            <Button
              variant="outline"
              color="sky.4"
              size="sm"
              disabled={busy}
              onClick={() => setSelectedIds([])}
            >
              Clear selection
            </Button>
          )}
          <Button
            onClick={() => setConfirmSelection(true)}
            disabled={busy || selectedIds.length !== seat.picksRequired}
            loading={busy}
          >
            {seat.picksRequired === 0
              ? "Pass this bag"
              : `Submit ${seat.picksRequired} ${seat.picksRequired === 1 ? "pick" : "picks"}`}
          </Button>
        </BagSelectionActions>
      )}
      <BagSelectionConfirmation
        opened={confirmSelection}
        onClose={() => setConfirmSelection(false)}
        onConfirm={() => {
          setConfirmSelection(false);
          submit({ action: "pick", round: view.round, itemIds: selectedIds });
        }}
        items={selectedItems}
        variant={view.settings.variant}
        passingTo={passingTo.name}
        busy={busy || selectedIds.length !== seat.picksRequired}
      />
      {!seat.ready &&
        groupedItems(seat.bag).map(([category, items]) => {
          const collected = seat.hand.filter(
            (item) => item.category === category,
          ).length;
          const draftLimit = view.rules.draftLimits[category] ?? 0;
          const keepLimit = view.rules.keepLimits[category] ?? 0;
          const selectedCount = items.filter((item) =>
            selectedIds.includes(item.id),
          ).length;
          const categoryTaken =
            category !== "FACTION" && selectedCategories.has(category);
          const categoryFull = collected + selectedCount >= draftLimit;
          return (
            <Stack key={category} gap="sm">
              <Group justify="space-between">
                <Title order={3} size="h4">
                  {bagCategoryLabel(category, view.settings.variant)}
                </Title>
                <Group gap="xs">
                  <Badge
                    variant="light"
                    color={collected >= draftLimit ? "gray" : "blue"}
                  >
                    Collected {collected} of {draftLimit} max
                  </Badge>
                  {category !== "FACTION" && (
                    <Badge variant="light" color="sky">
                      Keep {keepLimit} afterward
                    </Badge>
                  )}
                  {selectedCount > 0 && (
                    <Badge variant="filled" color="sky.4">
                      {selectedCount} selected this pass
                    </Badge>
                  )}
                </Group>
              </Group>
              <Text size="sm" c="dimmed">
                {collected >= draftLimit
                  ? "Collection limit reached for this category."
                  : `You can collect ${draftLimit - collected} more in this category across all bags.`}{" "}
                {category === "FACTION"
                  ? "Choose from these factions’ components when you build your final faction."
                  : keepLimit >= draftLimit
                    ? "Keep everything you collect in this category."
                    : `When drafting ends, keep exactly ${keepLimit} from your collection, or all available choices if you have fewer.`}
                {(view.settings.variant === "twilights_fall" ||
                  view.settings.variant === "inaugural_splice") &&
                  ["TECH", "AGENT", "UNIT"].includes(category) &&
                  " You may fill a slot with a generic technology instead."}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                {items.map((item) => {
                  const selected = selectedIds.includes(item.id);
                  const unavailableReason = selected
                    ? undefined
                    : collected >= draftLimit
                      ? "Collection limit reached. You cannot collect more of this category."
                      : categoryFull
                        ? "Your selected picks will fill this category’s collection limit."
                        : categoryTaken
                          ? "Only one per category on each pass. Deselect your other choice in this category to choose this one."
                          : selectedIds.length >= seat.picksRequired
                            ? "All picks for this bag are selected. Deselect a component to choose this one."
                            : !legalIds.has(item.id)
                              ? "This component is unavailable on this pass."
                              : undefined;
                  return (
                    <BagItemCard
                      key={item.id}
                      item={item}
                      variant={view.settings.variant}
                      selected={selected}
                      note={unavailableReason}
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
  selectedIds,
  setSelectedIds,
}: {
  view: BagDraftView;
  seat: PrivateSeat;
  busy: boolean;
  submit: SubmitOperation;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
}) {
  const [confirmSelection, setConfirmSelection] = useState(false);
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
  const availableIds = twilightsFall
    ? new Set(seat.assemblyOptions.map((item) => item.id))
    : availableAssemblyItemIds(
        seat.assemblyOptions,
        seat.assemblyBaseItemIds,
        selectedIds,
      );
  const unavailableSelections = seat.assemblyOptions.filter(
    (item) => selectedIds.includes(item.id) && !availableIds.has(item.id),
  );
  const selectedItems = seat.assemblyOptions.filter((item) =>
    selectedIds.includes(item.id),
  );
  const finalItems = twilightsFall
    ? selectedItems
    : includeAssemblyCompanions(selectedItems);
  const companionIds = finalItems
    .filter((item) => !selectedIds.includes(item.id))
    .map((item) => item.id);
  const complete =
    unavailableSelections.length === 0 &&
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
        <CollectedItems items={finalItems} view={view} />
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
            Collection is complete. Choose which components to keep for your
            final faction and the tiles to use for the map. Keep the required
            count in each category, or all available choices if you have fewer.
            Categories with nothing to discard are already selected.
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
          {!complete && (
            <Text size="sm" c="dimmed">
              {twilightsFall
                ? "Fill each category’s keep limit, or replace open ability, genome, or unit upgrade slots with generic technologies."
                : "Fill each category’s keep limit to finalize."}
            </Text>
          )}
          {unavailableSelections.length > 0 && (
            <Alert
              color="orange"
              title="A replacement needs its granting component"
            >
              Keep the component that grants{" "}
              {unavailableSelections.map((item) => item.name).join(", ")}, or
              deselect the replacement before finalizing.
            </Alert>
          )}
        </Stack>
      </Paper>
      <BagSelectionActions
        status={`${selectedIds.length} components selected${complete ? " · Ready to finalize" : ""}`}
        detail={
          complete
            ? "Review your final faction before submitting."
            : requirements
                .map(([category, items]) => {
                  const count = items.filter((item) =>
                    selectedIds.includes(item.id),
                  ).length;
                  const limit = Math.min(
                    items.length,
                    view.rules.keepLimits[category] ?? 0,
                  );
                  return count < limit
                    ? `${bagCategoryLabel(category, view.settings.variant)} ${count}/${limit}`
                    : null;
                })
                .filter(Boolean)
                .join(" · ") ||
              "Check your replacements to finish this faction."
        }
      >
        <Button
          onClick={() => setConfirmSelection(true)}
          disabled={busy || !complete}
          loading={busy}
        >
          Finalize faction
        </Button>
      </BagSelectionActions>
      <BagSelectionConfirmation
        opened={confirmSelection}
        onClose={() => setConfirmSelection(false)}
        onConfirm={() => {
          setConfirmSelection(false);
          submit({ action: "assemble", itemIds: selectedIds });
        }}
        items={finalItems}
        automaticItemIds={companionIds}
        variant={view.settings.variant}
        assembling
        busy={busy || !complete}
      />
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
                variant={view.settings.variant}
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
                Selected {count} of {limit} to keep
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {items.map((item) => (
                <BagItemCard
                  key={item.id}
                  item={item}
                  variant={view.settings.variant}
                  note={
                    !seat.assemblyBaseItemIds.includes(item.id) &&
                    seat.assemblyOptions.some((parent) =>
                      parent.optionalSwaps?.includes(item.id),
                    )
                      ? `${availableIds.has(item.id) ? "Optional replacement offered by" : "Keep a granting component to unlock:"} ${seat.assemblyOptions
                          .filter((parent) =>
                            parent.optionalSwaps?.includes(item.id),
                          )
                          .map((parent) => parent.name)
                          .join(", ")}.`
                      : undefined
                  }
                  selected={selectedIds.includes(item.id)}
                  disabled={
                    busy ||
                    (!selectedIds.includes(item.id) &&
                      (count >= limit || !availableIds.has(item.id)))
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
  const [selectedIds, setSelectedIds] = usePendingBagSelections(view);
  const fetcher = useFetcher<typeof action>();
  useLobbyRefresh();
  const location = useLocation();
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

  function submit(
    operation:
      | BagDraftAction
      | { action: "join"; name: string }
      | { action: "recover"; uuid: string }
      | { action: "exportState"; checkpointId?: string },
  ) {
    void fetcher.submit(
      { operation: JSON.stringify(operation) },
      { method: "post", action: `${location.pathname}${location.search}` },
    );
  }

  function lobbyOperation(operation: LobbyOperation) {
    const revision = view.revision;
    switch (operation.type) {
      case "join":
        submit({
          action: "join",
          name: operation.name,
        });
        break;
      case "recover":
        submit({ action: "recover", uuid: operation.uuid });
        break;
      case "start":
      case "pause":
      case "resume":
      case "checkpoint":
        submit({ action: operation.type, revision });
        break;
      case "undo":
        submit({ action: "undoAction", revision });
        break;
      case "release":
      case "rotate":
        submit({
          action: operation.type,
          playerId: operation.playerId,
          revision,
        });
        break;
      case "rename":
        submit({
          action: "rename",
          playerId: operation.playerId,
          name: operation.name,
          revision,
        });
        break;
      case "restore":
        submit({
          action: "restoreCheckpoint",
          checkpointId: operation.checkpointId,
          revision,
        });
        break;
      case "import":
        submit({ action: "importState", state: operation.state, revision });
        break;
      case "export":
        submit({ action: "exportState", checkpointId: operation.checkpointId });
        break;
    }
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
        <Text size="xs" c="dimmed">
          {view.viewer.isAdmin
            ? playerName
              ? `Admin · Playing as ${playerName}`
              : "Admin"
            : playerName
              ? `Playing as ${playerName}`
              : "Spectator"}
        </Text>
      </Group>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1}>{variant?.name ?? "Bag draft"}</Title>
          <Text c="dimmed" mt="xs">
            {variant?.description}
          </Text>
        </div>
        <OriginalArtToggle />
      </Group>
      <LobbyPanel
        mode="bag"
        lobbyId={view.id}
        lobby={view.lobby}
        ownPlayerId={view.viewer.playerId}
        isAdmin={view.viewer.isAdmin}
        busy={busy}
        error={fetcher.data?.error ?? view.accessError}
        exportState={fetcher.data?.backup}
        onOperation={lobbyOperation}
      />
      {view.phase !== "lobby" && view.viewer.playerId !== undefined && (
        <DraftTurnStatus
          roomKey={`bag:${view.id}`}
          playerId={view.viewer.playerId}
          pending={getBagPendingAction(view)}
          paused={view.lobby.paused}
          complete={view.phase === "complete"}
        />
      )}
      <BagDraftGuide
        rules={view.rules}
        variant={view.settings.variant}
        phase={view.phase}
      />
      {view.phase !== "lobby" && (
        <>
          {seat && view.phase === "drafting" ? (
            <DraftPicking
              key={`${view.id}:${seat.id}:${view.round}:${seat.ready}:${seat.hand.map((item) => item.id).join(",")}:${seat.bag.map((item) => item.id).join(",")}`}
              view={view}
              seat={seat}
              busy={busy || view.lobby.paused}
              submit={submit}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
            />
          ) : (
            <BagDraftProgress view={view} />
          )}
          <BagMapSetup
            rules={view.rules}
            playerCount={view.players.length}
            phase={view.phase}
            mapRoomId={view.mapRoomId}
            mapBuildError={view.mapBuildError}
            mapPath={`${publicPath}?map=1`}
          />
          {view.viewer.isAdmin && view.canUndoRound && (
            <Button
              color="orange"
              variant="light"
              onClick={() => setConfirmUndo(true)}
              disabled={busy}
              style={{ alignSelf: "flex-start" }}
            >
              Rewind draft round
            </Button>
          )}
          {seat && view.phase === "assembling" && (
            <FactionAssembly
              key={`${view.id}:${seat.id}:${seat.finished}:${seat.keptItemIds.join(",")}:${seat.assemblyOptions.map((item) => item.id).join(",")}`}
              view={view}
              seat={seat}
              busy={busy || view.lobby.paused}
              submit={submit}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
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
                ? "Join the lobby or rejoin with your recovery code above if you are also playing. You can manage the draft here while other players’ hands stay private."
                : "This page updates automatically. Rejoin with your saved recovery code above to see your own bag and make picks."}
            </Alert>
          )}
          {view.phase === "complete" && (
            <Stack gap="lg">
              <Group justify="space-between">
                <Title order={2}>Completed factions</Title>
                <Group>
                  {seat && !view.mapRoomId && (
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
                    <CollectedItems
                      items={player.keptItems ?? []}
                      view={view}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </>
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
          Open the shared lobby
        </Anchor>
      )}
      <Anchor component={Link} to="/draft/bag/new">
        Create a bag draft
      </Anchor>
    </Stack>
  );
}
