import {
  Alert,
  Button,
  Container,
  Group,
  MultiSelect,
  NumberInput,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { factions } from "~/data/factionData";
import { buildMiniMiltySettings } from "~/draft/minimilty/buildMiniMilty";
import { getFactionPool } from "~/utils/factions";
import type { FactionId } from "~/types";

const baseFactions = getFactionPool(["base"]);
const factionOptions = baseFactions.map((id) => ({
  value: id,
  label: factions[id].name,
}));

export default function MiniMiltySetup() {
  const navigate = useNavigate();
  const [names, setNames] = useState(
    "Player 1\nPlayer 2\nPlayer 3\nPlayer 4\nPlayer 5\nPlayer 6",
  );
  const [numFactions, setNumFactions] = useState(7);
  const [banned, setBanned] = useState<string[]>([]);
  const [required, setRequired] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const players = names
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, id) => ({ id, name }));

  const preview = () => {
    try {
      const draftSettings = buildMiniMiltySettings({
        players,
        numFactions,
        bannedFactions: banned as FactionId[],
        requiredFactions: required as FactionId[],
      });
      navigate("/draft/new", { state: { draftSettings, players } });
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
        <Group justify="space-between">
          <Title order={1}>Mini-Milty</Title>
          <Button component={Link} to="/draft/prechoice" variant="subtle">
            All draft formats
          </Button>
        </Group>
        <Text c="dimmed">
          A base-game faction and speaker draft for 3–6 players. The map is
          filled before drafting, with three blue and two red systems per seat.
          Each player takes a faction and a speaker position in two snake
          rounds; speaker position also determines their seat.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Textarea
          label="Players"
          description="One name per line."
          minRows={6}
          value={names}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setNames(value);
            const count = value
              .split("\n")
              .filter((name) => name.trim()).length;
            setNumFactions(
              Math.min(baseFactions.length - banned.length, count + 1),
            );
          }}
        />
        <NumberInput
          label="Factions in the draft"
          description="The bot's default is one more faction than players."
          value={numFactions}
          min={players.length}
          max={baseFactions.length - banned.length}
          onChange={(value) => setNumFactions(Number(value))}
        />
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
