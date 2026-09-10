import { useSearchParams } from "react-router";
import { LobbyPlayerCount } from "~/draft/LobbyPlayerCount";
import { makeLobbyPlayers, parseLobbyPlayerCount } from "~/draft/lobbySetup";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  Group,
  SimpleGrid,
  Text,
  TextInput,
} from "@mantine/core";
import { SectionTitle } from "~/components/Section";
import { BaseSlice } from "~/components/Slice";
import { systemIdsToSlice } from "~/utils/slice";
import { DraftConfig, draftConfig } from "~/draft";
import { useCreateDraft } from "../draft.new/useCreateDraft";
import { generateEmptyMap } from "~/utils/map";
import { randomizeFactions } from "~/draftStore";
import { getFactionPool } from "~/utils/factions";
import { shuffle } from "~/draft/helpers/randomization";

const configByPlayerCount: Record<number, DraftConfig> = {
  4: draftConfig.milty4p,
  5: draftConfig.milty5p,
  6: draftConfig.milty,
  7: draftConfig.milty7p,
  8: draftConfig.milty8p,
};

export default function DraftTournament() {
  const [searchParams] = useSearchParams();
  const [tableName, setTableName] = useState("");
  const slicesParam = searchParams.get("slices") ?? "";
  const sliceStrings = slicesParam.split(";").filter(Boolean);
  const maxPlayers = Math.min(8, sliceStrings.length);
  const [players, setPlayers] = useState(() =>
    makeLobbyPlayers(
      parseLobbyPlayerCount(
        searchParams.get("playerCount"),
        4,
        Math.max(4, maxPlayers),
      ),
    ),
  );
  const createDraft = useCreateDraft();

  const config = configByPlayerCount[players.length] as DraftConfig;
  const draftDisabled = !tableName.trim();

  const slices = sliceStrings
    .map((subStr) => {
      const parts = subStr.split(",");
      const [name, ...systemIds] = parts;
      return { name, systemIds };
    })
    .map((slice) => systemIdsToSlice(config, slice.name, slice.systemIds));
  const factionBan = searchParams.get("factionBan") === "1";
  const numFactions = searchParams.get("numFactions") ?? 8;
  const urlPrefix = searchParams.get("urlPrefix");

  const adminPassword = searchParams.get("adminPassword") ?? undefined;
  const adjustedFactions = Math.max(
    players.length,
    Number(numFactions) - Math.max(0, 6 - players.length),
  );
  const adjustedSliceCount = Math.max(
    players.length,
    slices.length - Math.max(0, 6 - players.length),
  );

  const handleCreateDraft = () => {
    const adjustedSlices = shuffle(slices, adjustedSliceCount).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    createDraft({
      settings: {
        type: config.type,
        factionGameSets: ["base", "pok"],
        tileGameSets: ["base", "pok"],
        draftSpeaker: false,
        allowEmptyTiles: false,
        allowHomePlanetSearch: false,
        numFactions: adjustedFactions,
        numSlices: adjustedSliceCount,
        randomizeMap: true,
        randomizeSlices: true,
        adminPassword,
        modifiers: factionBan ? { banFactions: { numFactions: 1 } } : {},
      },
      integrations: {},
      players,
      slices: adjustedSlices,
      presetMap: generateEmptyMap(config),
      availableFactions: randomizeFactions(
        adjustedFactions,
        getFactionPool(["base", "pok"]),
        undefined,
      ),
      selections: [],
      presetUrl: [urlPrefix, tableName.trim()].filter(Boolean).join("-"),
    });
  };

  const errorMessages = [!tableName.trim() && "Please enter a table name"]
    .filter(Boolean)
    .join(", ");

  if (maxPlayers < 4) {
    return (
      <Alert color="orange" title="Tournament setup link incomplete">
        This link needs at least four prepared slices. Open the complete setup
        link from your tournament organizer.
      </Alert>
    );
  }

  return (
    <Box mt="lg">
      <SectionTitle title="Tournament Table Setup" />
      <Grid gutter="xl" mt="xl">
        <Grid.Col span={12} pl="xl" pr="xl">
          <LobbyPlayerCount
            count={players.length}
            min={4}
            max={maxPlayers}
            onChange={(count) => setPlayers(makeLobbyPlayers(count))}
          />
          {adjustedSliceCount < slices.length && (
            <Alert color="orange.9" mt="xs" variant="filled" fw="bold">
              This table will use {adjustedSliceCount} randomly selected slices
              from the {slices.length} below, with {adjustedFactions} factions.
            </Alert>
          )}

          <Text size="xl" fw={700} mb="sm" mt="lg">
            Table name
          </Text>
          <Group>
            {urlPrefix && <Text>{urlPrefix} –</Text>}
            <TextInput
              size="xl"
              aria-label="Table name"
              placeholder="Enter table name..."
              flex={1}
              value={tableName}
              miw={200}
              onChange={(e) => setTableName(e.target.value)}
            />
          </Group>
          <Button
            mt="xl"
            size="xl"
            disabled={draftDisabled}
            fullWidth
            onClick={handleCreateDraft}
          >
            Create shared lobby
          </Button>

          {errorMessages && (
            <Text c="red" size="sm" mt="xs">
              {errorMessages}
            </Text>
          )}
        </Grid.Col>

        <Grid.Col span={12}>
          <SectionTitle title="Slices" />
          <SimpleGrid
            mt="lg"
            flex={1}
            cols={{ base: 1, xs: 2, sm: 2, md: 3, lg: 3, xl: 4, xxl: 6 }}
            spacing="lg"
            style={{ alignItems: "flex-start" }}
          >
            {slices.map((slice, idx) => (
              <BaseSlice
                key={idx}
                id={`slice-${idx}`}
                config={config}
                slice={slice}
              />
            ))}
          </SimpleGrid>
        </Grid.Col>
      </Grid>
    </Box>
  );
}
