import { appUrl } from "~/utils/appUrl";
import { Button, Grid, Stack, Text } from "@mantine/core";
import { ActionFunctionArgs, data, redirect, MetaFunction } from "react-router";
import {
  useFetcher,
  useLoaderData,
  type ClientLoaderFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { eq } from "drizzle-orm";
import { useEffect, useRef } from "react";
import { useDraft } from "~/draftStore";
import { db } from "~/drizzle/config.server";
import { drafts } from "~/drizzle/schema.server";
import { Draft } from "~/types";
import { CurrentPickBanner } from "../draft.$id/components/CurrentPickBanner";
import { PlayerSelectionScreen } from "../draft.$id/components/PlayerSelectionScreen";
import { LoadingOverlay } from "~/components/LoadingOverlay";
import { validate as validateUUID } from "uuid";
import {
  draftById,
  draftByPrettyUrl,
  generateUniquePrettyUrl,
  updateDraft,
  getDraftStagedSelections,
} from "~/drizzle/draft.server";
import { notifyPick } from "~/discord/bot.server";
import { validateDraftSync } from "~/utils/draftSync.server";
import { useHydratedDraft } from "~/hooks/useHydratedDraft";
import {
  SlicesSection,
  SpeakerOrderSection,
  DraftOrderSection,
  DraftableFactionsSection,
  MapSection,
  DraftSummarySection,
} from "../draft.$id/sections";
import { PlanetFinder } from "../draft.$id/components/PlanetFinder";
import { useLobbyRefresh } from "~/hooks/useLobbyRefresh";
import { DraftTurnStatus } from "~/draft/DraftTurnStatus";
import { getBasePendingAction } from "~/draft/turn";
import { FinalizedDraft } from "../draft.$id/components/FinalizedDraft";
import { SyncDraftContext, useSyncDraftFetcher } from "~/hooks/useSyncDraft";
import { PlayerInputSection } from "../draft.new/components/PlayerInputSection";
import { DraftableMinorFactionsSection } from "../draft.$id/sections/DraftableMinorFactionsSection";
import { DraftablePlayerColorsSection } from "../draft.$id/sections/DraftablePlayerColorsSection";
import { useSafeOutletContext } from "~/useSafeOutletContext";
import { BanPhase } from "../draft.$id/sections/BanPhase";
import { IconRefresh } from "@tabler/icons-react";
import { useSocketConnection } from "~/useSocketConnection";
import { DraftableReferenceCardPacksSection } from "../draft.$id/sections/DraftableReferenceCardPacksSection";
import { PriorityValueSelectionPhase } from "../draft.$id/sections/PriorityValueSelectionPhase";
import { HomeSystemSelectionPhase } from "../draft.$id/sections/HomeSystemSelectionPhase";
import { TexasFactionSelectionPhase } from "../draft.$id/sections/TexasFactionSelectionPhase";
import { TexasTileDraftPhase } from "../draft.$id/sections/TexasTileDraftPhase";
import { TexasMapBuildPhase } from "../draft.$id/sections/TexasMapBuildPhase";

import { LobbyPanel, type LobbyOperation } from "~/draft/LobbyPanel";
import { LobbyIdentityContext } from "~/draft/LobbyIdentity";
import {
  baseCookie,
  baseLobbyView,
  getBaseLobby,
  mutateBaseLobby,
  projectBaseDraft,
  readBaseViewer,
  requireBasePlayer,
} from "~/drizzle/baseDraftLobby.server";
import { applyBaseSelection } from "~/drizzle/baseDraftSync.server";
import { broadcastDraftUpdate } from "~/websocket/broadcast.server";
import { withBaseDraftLock } from "~/draft/baseDraftLock.server";
import { createOrderedLoader } from "~/hooks/orderedLoader";
import { getTexasFactionConflict } from "~/draft/texas/factionConflict";
import { TexasFactionConflict } from "~/draft/texas/TexasFactionConflict";

export function headers() {
  return { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
}

export default function RunningDraft() {
  const result = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  useLobbyRefresh();
  const selectedPlayer = useDraft((state) =>
    state.draftId === result.id ? state.selectedPlayer : undefined,
  );
  const playerId = result.lobby ? result.ownPlayerId : selectedPlayer;
  const currentDraft = useDraft((state) =>
    state.draftId === result.id &&
    state.hydrated &&
    !state.replayMode &&
    (!result.lobby || state.selectedPlayer === (result.ownPlayerId ?? -1))
      ? state.draft
      : result.data,
  );
  const pendingAction = currentDraft
    ? getBasePendingAction(currentDraft, playerId)
    : undefined;
  const operation = (operation: LobbyOperation) =>
    fetcher.submit(
      {
        operation: JSON.stringify(operation),
        revision: String(result.lobbyRevision),
      },
      { method: "post" },
    );
  const error =
    fetcher.data && typeof fetcher.data === "object" && "error" in fetcher.data
      ? fetcher.data.error
      : undefined;
  const backup =
    fetcher.data && typeof fetcher.data === "object" && "backup" in fetcher.data
      ? fetcher.data.backup
      : undefined;
  return (
    <LobbyIdentityContext.Provider
      value={
        result.lobby
          ? {
              managed: true,
              isAdmin: result.isAdmin,
              paused: result.lobby.paused,
            }
          : null
      }
    >
      <Stack>
        {result.lobby && (
          <LobbyPanel
            lobby={result.lobby}
            mode="base"
            lobbyId={result.id}
            ownPlayerId={result.ownPlayerId}
            isAdmin={result.isAdmin}
            busy={fetcher.state !== "idle"}
            error={typeof error === "string" ? error : undefined}
            exportState={typeof backup === "string" ? backup : undefined}
            onOperation={operation}
          />
        )}
        {result.data && (
          <>
            {playerId !== undefined && playerId >= 0 && currentDraft && (
              <DraftTurnStatus
                roomKey={`base:${result.id}`}
                playerId={playerId}
                pending={pendingAction}
                paused={result.lobby?.paused}
                complete={
                  !pendingAction &&
                  !getTexasFactionConflict(currentDraft) &&
                  currentDraft.selections.length >=
                    currentDraft.pickOrder.length
                }
              />
            )}
            <div inert={result.lobby?.paused || undefined}>
              <DraftBoard
                key={`${result.id}:${result.lobby ? (result.lobby.ownUuid ?? "spectator") : "legacy"}`}
                result={{
                  id: result.id,
                  urlName: result.urlName,
                  data: result.data,
                }}
                managed={!!result.lobby}
                ownPlayerId={result.ownPlayerId}
              />
            </div>
          </>
        )}
      </Stack>
    </LobbyIdentityContext.Provider>
  );
}

function DraftBoard({
  result,
  managed,
  ownPlayerId,
}: {
  result: { id: string; urlName: string | null; data: Draft };
  managed: boolean;
  ownPlayerId?: number;
}) {
  const { adminMode } = useSafeOutletContext();
  const {
    syncDraft,
    syncing,
    stagePriorityValue,
    stageHomeSystem,
    stageSimultaneousPick,
    undoStagedPick,
    undoSimultaneousPhase,
    undoLastPick,
  } = useSyncDraftFetcher();
  const draftStore = useDraft();
  const draft = draftStore.draft;
  const settings = draft.settings;
  const draftActions = draftStore.draftActions;
  const selectedPlayer = draftStore.selectedPlayer;
  const { draftFinished } = useHydratedDraft();
  const isPresetMapDraft = settings.draftGameMode === "presetMap";
  const initialized = useRef(false);

  // Real-time socket connection to push and receive state updates.
  const { socket, isDisconnected, isReconnecting, reconnect } =
    useSocketConnection({
      draftId: result.id,
    });

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      draftActions.hydrate(result.id, result.urlName!, result.data);
      if (managed) draftActions.setSelectedPlayer(ownPlayerId ?? -1);
      else {
        try {
          const selected = localStorage.getItem(`draft:player:${result.id}`);
          if (selected) draftActions.setSelectedPlayer(parseInt(selected));
        } catch {
          /* Browsers may disable local storage. */
        }
      }
    } else if (!syncing) {
      // Polling replaces server state without closing local controls. Router
      // mutations finish their authenticated revalidation before this applies.
      draftActions.update(result.id, result.data);
    }
  }, [
    result.data,
    result.id,
    result.urlName,
    managed,
    ownPlayerId,
    draftActions,
    syncing,
  ]);

  useEffect(() => {
    if (managed && selectedPlayer !== (ownPlayerId ?? -1))
      draftActions.setSelectedPlayer(ownPlayerId ?? -1);
  }, [managed, ownPlayerId, selectedPlayer, draftActions]);

  if (
    !initialized.current ||
    !draftStore.hydrated ||
    draftStore.draftId !== result.id
  )
    return <LoadingOverlay />;

  const syncDraftContextValue = {
    syncDraft,
    syncing,
    stagePriorityValue,
    stageHomeSystem,
    stageSimultaneousPick,
    undoStagedPick,
    undoSimultaneousPhase,
    undoLastPick,
  };

  const factionConflict = getTexasFactionConflict(draft);
  if (factionConflict && selectedPlayer !== undefined) {
    return (
      <SyncDraftContext.Provider value={syncDraftContextValue}>
        <TexasFactionConflict />
      </SyncDraftContext.Provider>
    );
  }

  if (draftFinished && !factionConflict) {
    return (
      <SyncDraftContext.Provider value={syncDraftContextValue}>
        <FinalizedDraft />
      </SyncDraftContext.Provider>
    );
  }

  if (selectedPlayer === undefined) {
    return (
      <PlayerSelectionScreen
        onDraftJoined={(playerId) => {
          localStorage.setItem(
            `draft:player:${result.id}`,
            playerId.toString(),
          );
          draftActions.setSelectedPlayer(playerId);
        }}
      />
    );
  }

  const isInBanPhase = () => {
    if (!settings.modifiers) return false;
    const banModifier = settings.modifiers.banFactions;
    if (!banModifier) return false;

    const totalBansNeeded = banModifier.numFactions * draft.players.length;
    const currentPickNumber = draft.selections.length;

    return currentPickNumber < totalBansNeeded;
  };

  if (isInBanPhase()) {
    return (
      <SyncDraftContext.Provider value={syncDraftContextValue}>
        <BanPhase />
      </SyncDraftContext.Provider>
    );
  }

  const currentPick = draft.pickOrder[draft.selections.length];
  if (typeof currentPick === "object" && currentPick?.kind === "simultaneous") {
    if (currentPick.phase === "priorityValue") {
      return (
        <SyncDraftContext.Provider value={syncDraftContextValue}>
          <PriorityValueSelectionPhase />
        </SyncDraftContext.Provider>
      );
    }

    if (currentPick.phase === "homeSystem") {
      return (
        <SyncDraftContext.Provider value={syncDraftContextValue}>
          <HomeSystemSelectionPhase />
        </SyncDraftContext.Provider>
      );
    }

    if (currentPick.phase === "texasFaction") {
      return (
        <SyncDraftContext.Provider value={syncDraftContextValue}>
          <TexasFactionSelectionPhase />
        </SyncDraftContext.Provider>
      );
    }

    if (currentPick.phase === "texasBlueKeep1") {
      return (
        <SyncDraftContext.Provider value={syncDraftContextValue}>
          <TexasTileDraftPhase
            phase="texasBlueKeep1"
            title="Blue Tile Draft — Round 1"
            description="Keep one blue tile and pass the rest left."
            color="blue"
          />
        </SyncDraftContext.Provider>
      );
    }

    if (currentPick.phase === "texasBlueKeep2") {
      return (
        <SyncDraftContext.Provider value={syncDraftContextValue}>
          <TexasTileDraftPhase
            phase="texasBlueKeep2"
            title="Blue Tile Draft — Round 2"
            description="Keep one blue tile from the pass."
            color="blue"
          />
        </SyncDraftContext.Provider>
      );
    }

    if (currentPick.phase === "texasRedKeep") {
      return (
        <SyncDraftContext.Provider value={syncDraftContextValue}>
          <TexasTileDraftPhase
            phase="texasRedKeep"
            title="Red Tile Draft"
            description="Keep one red tile and pass the other left."
            color="red"
          />
        </SyncDraftContext.Provider>
      );
    }
  }

  if (settings.draftGameMode === "texasStyle") {
    return (
      <SyncDraftContext.Provider value={syncDraftContextValue}>
        <TexasMapBuildPhase />
      </SyncDraftContext.Provider>
    );
  }

  return (
    <SyncDraftContext.Provider value={syncDraftContextValue}>
      {socket && isDisconnected && (
        <Button
          variant="filled"
          size="md"
          radius="xl"
          leftSection={<IconRefresh size={20} />}
          style={{
            position: "fixed",
            top: "160px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
          }}
          onClick={reconnect}
          loading={isReconnecting}
        >
          Refresh
        </Button>
      )}

      <PlanetFinder onSystemSelected={syncDraft} />
      <Stack gap="sm" mb="xl" mt="lg">
        <CurrentPickBanner />
      </Stack>

      <Grid gutter="xl">
        <Grid.Col span={12} order={{ base: 0 }}>
          <Text size="md" ta="right" c="dimmed">
            {appUrl(`/draft/${result.urlName}`)}
          </Text>
        </Grid.Col>

        {settings.draftSpeaker && (
          <Grid.Col
            span={{ base: 12, sm: 6 }}
            order={{ base: 3, sm: 1, lg: 1 }}
          >
            <SpeakerOrderSection />
          </Grid.Col>
        )}
        <Grid.Col
          span={settings.draftSpeaker ? { base: 12, sm: 6 } : 12}
          order={{ base: 1, sm: 2, lg: 2 }}
        >
          <DraftOrderSection />
        </Grid.Col>
        {settings.draftGameMode === "twilightsFall" && (
          <Grid.Col span={12} order={{ base: 5, sm: 5, lg: 5 }}>
            <DraftableReferenceCardPacksSection />
          </Grid.Col>
        )}
        <Grid.Col span={{ base: 12, lg: 6 }} order={{ base: 4, sm: 4, lg: 3 }}>
          <Stack gap="lg">
            <DraftableFactionsSection />
            <DraftableMinorFactionsSection />
            <DraftablePlayerColorsSection />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }} order={{ base: 2, sm: 3, lg: 4 }}>
          <DraftSummarySection />
        </Grid.Col>
        {!isPresetMapDraft && (
          <Grid.Col
            span={
              settings.draftGameMode === "twilightsFall" &&
              !settings.nucleusStyle
                ? 12
                : { base: 12, lg: 6 }
            }
            order={{ base: 5, sm: 5, lg: 5 }}
          >
            <SlicesSection />
          </Grid.Col>
        )}
        {(settings.draftGameMode !== "twilightsFall" ||
          settings.nucleusStyle) && (
          <Grid.Col
            span={isPresetMapDraft ? 12 : { base: 12, lg: 6 }}
            order={{ base: 6, sm: 6, lg: 6 }}
          >
            <MapSection />
          </Grid.Col>
        )}

        {adminMode && (
          <Grid.Col offset={6} span={6} order={{ base: 7 }}>
            <PlayerInputSection
              players={draft.players}
              onChangeName={(playerIdx, name) => {
                draftStore.actions.updatePlayerName(playerIdx, name);
              }}
            />
            <Button mt="lg" onClick={syncDraft} loading={syncing}>
              Save
            </Button>
          </Grid.Col>
        )}
      </Grid>
    </SyncDraftContext.Provider>
  );
}

export async function action(args: ActionFunctionArgs) {
  const row = validateUUID(args.params.id ?? "")
    ? await draftById(args.params.id!)
    : await draftByPrettyUrl(args.params.id!);
  if (!row)
    return data(
      { success: false, error: "Draft not found" },
      { status: 404, headers: headers() },
    );
  return withBaseDraftLock(row.id, () => runBaseAction(args));
}

async function runBaseAction({ request, params }: ActionFunctionArgs) {
  try {
    const routeDraft = validateUUID(params.id ?? "")
      ? await draftById(params.id!)
      : await draftByPrettyUrl(params.id!);
    if (!routeDraft) throw new Response("Draft not found", { status: 404 });
    if (!request.headers.get("Content-Type")?.includes("application/json")) {
      const form = await request.formData();
      const operation = JSON.parse(
        String(form.get("operation")),
      ) as LobbyOperation;
      const result = await mutateBaseLobby(
        routeDraft.id,
        request,
        operation,
        Number(form.get("revision")),
      );
      if (result.issued)
        result.headers.append(
          "Set-Cookie",
          await baseCookie(routeDraft.id, result.issued.role).serialize(
            result.issued.uuid,
          ),
        );
      await broadcastDraftUpdate(
        routeDraft.id,
        JSON.parse(routeDraft.data as string),
      );
      return data(
        { success: true, error: null, backup: result.backup ?? null },
        { headers: result.headers },
      );
    }
    const { id, draft } = (await request.json()) as {
      id: string;
      draft: Draft;
    };
    if (id !== routeDraft.id)
      throw new Response("This action belongs to another draft.", {
        status: 403,
      });
    if (!draft || !Array.isArray(draft.selections))
      throw new Error("Invalid draft selection.");
    const existing = JSON.parse(routeDraft.data as string) as Draft;
    if (getTexasFactionConflict(existing))
      throw new Response(
        "Resolve the revealed faction conflict before continuing this draft.",
        { status: 409 },
      );
    const lobby = getBaseLobby(id);
    const viewer = await readBaseViewer(id, request);
    const projected = lobby
      ? projectBaseDraft(existing, viewer.playerId)
      : existing;
    const validation = validateDraftSync(
      projected.selections,
      draft.selections,
    );
    if (!validation.valid) return validation.response;
    let updated = draft;
    if (lobby) {
      await requireBasePlayer(id, request, viewer.playerId ?? -1);
      if (draft.selections.length !== existing.selections.length + 1)
        throw new Error(
          "Choose one option on your turn. Use lobby admin controls for corrections.",
        );
      updated = applyBaseSelection(
        existing,
        draft.selections[draft.selections.length - 1],
        viewer.playerId!,
      );
    }
    db.transaction(
      () => {
        const currentLobby = getBaseLobby(id);
        if (
          currentLobby &&
          (!currentLobby.started ||
            currentLobby.paused ||
            !currentLobby.slots.some(
              (slot) =>
                slot.id === viewer.playerId && slot.uuid === viewer.uuid,
            ))
        )
          throw new Response(
            "The lobby changed. Rejoin your slot or wait for the admin to resume.",
            { status: 409 },
          );
        updateDraft(id, updated, routeDraft.data as string);
      },
      { behavior: "immediate" },
    );
    await broadcastDraftUpdate(id, updated);
    if (existing.selections.length !== updated.selections.length) {
      const notified = await notifyPick(id, routeDraft.urlName!, updated);
      if (!notified.success)
        return data({
          success: true,
          discordError: "error" in notified ? notified.error : undefined,
          discordMessage: "message" in notified ? notified.message : undefined,
        });
    }
    return data({ success: true }, { headers: headers() });
  } catch (error) {
    return data(
      {
        success: false,
        error:
          error instanceof Response
            ? await error.text()
            : error instanceof Error
              ? error.message
              : "The draft could not be updated. Try again.",
      },
      {
        status: error instanceof Response ? error.status : 400,
        headers: headers(),
      },
    );
  }
}

// meta is placed after loader so typeof loader resolves correctly

function formatDraftType(type: string, playerCount: number): string {
  const typeMap: Record<string, string> = {
    milty: "Milty Draft",
    miltyeq: "Milty Equidistant Draft",
    prechoice: "Pre-Choice Draft",
    raw: "Raw Draft",
  };

  const baseName = typeMap[type.replace(/\d+p$/, "")] || type;
  return `${baseName} (${playerCount} players)`;
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const draftId = params.id!;

  // If using a legacy "UUID url", generate a pretty URL
  // and then redirect to it.
  if (validateUUID(draftId)) {
    console.log("UUID url detected, generating pretty url");
    const draft = await draftById(draftId);
    if (!draft) throw new Response("Draft not found", { status: 404 });
    if (draft.urlName) {
      console.log(`redirecting to pretty url ${draft.urlName}`);
      return redirect(`/draft/${draft.urlName}`);
    }

    const prettyUrl = await generateUniquePrettyUrl();
    await db
      .update(drafts)
      .set({ urlName: prettyUrl })
      .where(eq(drafts.id, draftId))
      .run();

    console.log(`redirecting to pretty url ${prettyUrl}`);
    return redirect(`/draft/${prettyUrl}`);
  }

  const result = await draftByPrettyUrl(draftId);
  if (!result) {
    throw new Response("Draft not found", { status: 404 });
  }

  const stagedSelections = await getDraftStagedSelections(result.id);
  const parsedDraft = JSON.parse(result.data as string) as Draft;

  const lobby = getBaseLobby(result.id);
  const viewer = await readBaseViewer(result.id, request);
  return data(
    {
      id: result.id,
      urlName: result.urlName,
      imageUrl: lobby && !lobby.started ? null : result.imageUrl,
      incompleteImageUrl:
        lobby && !lobby.started ? null : result.incompleteImageUrl,
      data:
        lobby && !lobby.started
          ? null
          : lobby
            ? projectBaseDraft(
                { ...parsedDraft, stagedSelections },
                viewer.playerId,
              )
            : { ...parsedDraft, stagedSelections },
      lobby: lobby ? baseLobbyView(lobby, viewer) : null,
      lobbyRevision: lobby?.revision,
      isAdmin: viewer.isAdmin,
      ownPlayerId: viewer.playerId,
    },
    { headers: headers() },
  );
};

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

type LoaderData = {
  data: Draft | null;
  id: string;
  urlName: string | null;
  imageUrl: string | null;
  incompleteImageUrl: string | null;
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const typed = data as LoaderData | undefined;
  if (!typed?.data)
    return [
      { title: "Draft lobby · TI4 Draft Command" },
      { name: "robots", content: "noindex, nofollow" },
    ];

  const draft = typed.data;
  const draftId = typed.urlName!;

  const draftType = draft.settings?.type || "Unknown";
  const playerCount = draft.players?.length || 0;
  const draftTypeDisplay = formatDraftType(draftType, playerCount);
  const title = `${draftId} - TI4 Draft Command`;
  const description = `${draftTypeDisplay} on TI4 Draft Command`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: appUrl(`/draft/${draftId}`) },
    { property: "og:type", content: "website" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
};
