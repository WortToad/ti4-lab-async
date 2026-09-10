import { Alert, Box, Button, Flex, Grid, List, Stack } from "@mantine/core";
import type { ActionFunctionArgs } from "react-router";
import { data, redirect } from "react-router";
import { useEffect, useRef } from "react";
import { PlanetFinder } from "~/routes/draft.$id/components/PlanetFinder";
import { useDraft } from "~/draftStore";
import { Draft } from "~/types";
import { DraftInput, useCreateDraftPreview } from "./useCreateDraft";
import { useDraftPreview } from "./useDraftPreview";
import { LoadingOverlay } from "~/components/LoadingOverlay";
import { SectionTitle } from "~/components/Section";
import { SlicesTable } from "../draft/SlicesTable";
import { createDraft } from "~/drizzle/draft.server";
import { LobbyPlayerCount } from "~/draft/LobbyPlayerCount";
import {
  AvailableFactionsSection,
  MapSection,
  SlicesSection,
} from "./sections";
import { useDraftValidationErrors } from "~/hooks/useDraftValidationErrors";
import { useDraftConfig } from "~/hooks/useDraftConfig";
import { baseCookie } from "~/drizzle/baseDraftLobby.server";
import { AvailableMinorFactionsSection } from "./sections/AvailableMinorFactionsSection";
import { AvailableReferenceCardPacksSection } from "./sections/AvailableReferenceCardPacksSection";
import { ConnectedFactionSettingsModal } from "./components/ConnectedFactionSettingsModal";
import { createDraftOrder } from "~/utils/draftOrder.server";
import { OriginalArtToggle } from "~/components/OriginalArtToggle";
import { getDraftValidationErrors } from "~/utils/draftValidation";

export default function DraftNew() {
  const clearPreview = useDraftPreview();
  const { draft, initialized } = useDraft();
  const config = useDraftConfig();

  const { createDraft, creating, error } = useCreateDraftPreview(clearPreview);

  const validationErrors = useDraftValidationErrors();
  const draftIsValid = validationErrors.length === 0;

  const showFullMap =
    config.modifiableMapTiles.length > 0 ||
    Object.keys(config.presetTiles).length > 0;
  const isTexasStyle = draft.settings.draftGameMode === "texasStyle";
  const isPresetMapDraft = draft.settings.draftGameMode === "presetMap";
  const autoCreatedRef = useRef(false);

  useEffect(() => {
    if (!initialized || !isTexasStyle || autoCreatedRef.current) return;
    if (!draftIsValid) return;
    autoCreatedRef.current = true;
    createDraft(draft);
  }, [initialized, isTexasStyle, draftIsValid, createDraft, draft]);

  const handleCreate = () => createDraft(draft);

  const advancedOptions = (
    <Stack gap="lg">
      <LobbyPlayerCount count={draft.players.length} />
      {!draftIsValid && (
        <Alert color="red" title="Finish preparing the draft">
          <List size="sm">
            {validationErrors.map((error) => (
              <List.Item key={error}>{error}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      {error && (
        <Alert color="red" title="Lobby not created">
          {error}
        </Alert>
      )}
      <Button
        size="xl"
        onClick={handleCreate}
        disabled={!draftIsValid}
        loading={creating}
      >
        Create shared lobby
      </Button>
    </Stack>
  );

  if (!initialized) return <LoadingOverlay />;
  if (isTexasStyle)
    return (
      <Stack py="xl">{creating ? <LoadingOverlay /> : advancedOptions}</Stack>
    );
  if (isPresetMapDraft) {
    return (
      <Flex py="lg" direction="column">
        <ConnectedFactionSettingsModal />
        <PlanetFinder />

        <Grid style={{ gap: 30 }} mt="lg">
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Stack gap="lg">
              <AvailableReferenceCardPacksSection />
              <AvailableFactionsSection />
              <AvailableMinorFactionsSection />
              {advancedOptions}
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <MapSection />
          </Grid.Col>
        </Grid>
      </Flex>
    );
  }

  return (
    <Flex py="lg" direction="column">
      <ConnectedFactionSettingsModal />

      <PlanetFinder />
      <Box mb="md">
        <OriginalArtToggle />
      </Box>

      <Stack>
        {draft.settings.draftGameMode !== "texasStyle" && (
          <>
            <AvailableReferenceCardPacksSection />
            <AvailableFactionsSection />
            <AvailableMinorFactionsSection />
          </>
        )}
      </Stack>

      {!isTexasStyle && (
        <Box mt="lg">
          <SlicesSection />
        </Box>
      )}

      <Grid style={{ gap: 30 }} mt="50px">
        <Grid.Col
          span={{ base: 12, lg: 6 }}
          order={showFullMap ? { base: 2, lg: 1 } : undefined}
        >
          <Stack gap="xl" w="100%">
            <Stack gap="xs">
              <SectionTitle title="Slices Summary" />
              <SlicesTable slices={draft.slices} />
            </Stack>
            {showFullMap && advancedOptions}
          </Stack>
        </Grid.Col>
        <Grid.Col
          span={{ base: 12, lg: 6 }}
          order={showFullMap ? { base: 1, lg: 2 } : undefined}
        >
          {showFullMap && !isTexasStyle && <MapSection />}
          {!showFullMap && advancedOptions}
        </Grid.Col>
      </Grid>
    </Flex>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as DraftInput;
  const jsonResponse = request.headers.get("X-Draft-Response") === "json";
  const errors = getDraftValidationErrors(body);
  if (errors.length > 0) {
    if (jsonResponse) return data({ error: errors.join(" ") }, { status: 400 });
    throw new Response(errors.join("\n"), { status: 400 });
  }

  const presetUrl = body.presetUrl;
  delete body.presetUrl;

  const draft: Draft = {
    ...body,
    ...createDraftOrder({
      players: body.players,
      settings: body.settings,
      availableFactions: body.availableFactions,
      presetMap: body.presetMap,
      texasDraft: body.texasDraft,
      slices: body.slices,
      availableMinorFactions: body.availableMinorFactions,
    }),
  };

  // The generated private hands can be more restrictive than the source pool.
  const dealtErrors = getDraftValidationErrors(draft);
  if (dealtErrors.length > 0) {
    if (jsonResponse)
      return data({ error: dealtErrors.join(" ") }, { status: 400 });
    throw new Response(dealtErrors.join("\n"), { status: 400 });
  }

  const { prettyUrl, id, adminUuid } = await createDraft(draft, presetUrl);
  if (jsonResponse)
    return data(
      { url: `/draft/${prettyUrl}` },
      {
        headers: {
          "Set-Cookie": await baseCookie(id, "admin").serialize(adminUuid),
        },
      },
    );
  return redirect(`/draft/${prettyUrl}`, {
    headers: {
      "Set-Cookie": await baseCookie(id, "admin").serialize(adminUuid),
    },
  });
}
