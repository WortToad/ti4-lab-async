import { DraftSetupHeading } from "~/components/DraftSetupHeading";
import {
  Alert,
  Button,
  Container,
  MultiSelect,
  NumberInput,
  Stack,
} from "@mantine/core";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { factions } from "~/data/factionData";
import { buildMiniMiltySettings } from "~/draft/minimilty/buildMiniMilty";
import { getFactionPool } from "~/utils/factions";
import { LobbyPlayerCount } from "~/draft/LobbyPlayerCount";
import { makeLobbyPlayers, parseLobbyPlayerCount } from "~/draft/lobbySetup";
import type { FactionId } from "~/types";

const baseFactions = getFactionPool(["base"]);
const factionOptions = baseFactions.map((id) => ({
  value: id,
  label: factions[id].name,
}));

export default function MiniMiltySetup() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [playerCount, setPlayerCount] = useState(() =>
    parseLobbyPlayerCount(search.get("playerCount"), 3, 6),
  );
  const [customNumFactions, setCustomNumFactions] = useState<number>();
  const numFactions = customNumFactions ?? playerCount + 1;
  const [banned, setBanned] = useState<string[]>([]);
  const [required, setRequired] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const players = makeLobbyPlayers(playerCount);

  const preview = () => {
    try {
      const draftSettings = buildMiniMiltySettings({
        players,
        numFactions,
        bannedFactions: banned as FactionId[],
        requiredFactions: required as FactionId[],
      });
      navigate(`/draft/new?playerCount=${playerCount}`, {
        state: { draftSettings, players },
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to prepare the draft.",
      );
    }
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <DraftSetupHeading
          title="Mini-Milty"
          description="A complete base-game galaxy, followed by two snake rounds to choose your faction and speaker position. Preview the map before inviting your table."
          players={playerCount}
        />
        {error && <Alert color="red">{error}</Alert>}
        <LobbyPlayerCount
          description="Players enter their name to join the shared lobby. The admin starts once everyone has joined."
          count={playerCount}
          onChange={setPlayerCount}
          min={3}
          max={6}
        />
        <NumberInput
          label="Factions in the draft"
          description="Defaults to one more faction than players. Your custom count stays fixed when the player count changes."
          value={numFactions}
          min={players.length}
          max={baseFactions.length - banned.length}
          onChange={(value) =>
            setCustomNumFactions(typeof value === "number" ? value : undefined)
          }
          allowDecimal={false}
        />
        {customNumFactions !== undefined && (
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setCustomNumFactions(undefined)}
            style={{ alignSelf: "flex-start" }}
          >
            Use recommended count ({playerCount + 1})
          </Button>
        )}
        <MultiSelect
          label="Banned factions"
          searchable
          clearable
          data={factionOptions}
          value={banned}
          onChange={(value) => {
            setBanned(value);
            setRequired(required.filter((id) => !value.includes(id)));
          }}
        />
        <MultiSelect
          label="Prioritized factions"
          description="These factions are always included."
          searchable
          clearable
          data={factionOptions.filter(
            (option) => !banned.includes(option.value),
          )}
          value={required}
          onChange={setRequired}
        />
        <Button size="lg" onClick={preview}>
          Generate map and preview draft
        </Button>
      </Stack>
    </Container>
  );
}
