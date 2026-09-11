import { DraftSetupHeading } from "~/components/DraftSetupHeading";
import {
  Alert,
  Button,
  Checkbox,
  Container,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useState } from "react";
import {
  data,
  Form,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
  type ActionFunctionArgs,
} from "react-router";
import { factions as allFactions } from "~/data/factionData";
import {
  createMantisRoom,
  mantisAdminCookie,
} from "~/drizzle/mantisDraft.server";
import type { MantisSettings } from "~/draft/mantis/engine";
import { MapBuildDiagram } from "~/draft/mantis/MapBuildDiagram";
import { LobbyPlayerCount } from "~/draft/LobbyPlayerCount";
import { makeLobbyPlayers, parseLobbyPlayerCount } from "~/draft/lobbySetup";
import type { FactionId, GameSet } from "~/types";
import { getFactionPool } from "~/utils/factions";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const count = Number(form.get("playerCount") ?? 6);
    if (!Number.isInteger(count) || count < 4 || count > 8)
      throw new Error("Choose between 4 and 8 players.");
    const players = makeLobbyPlayers(count);
    const sets: GameSet[] = ["base"];
    if (form.has("pok")) sets.push("pok");
    if (form.has("te")) sets.push("te");
    if (form.has("ds"))
      sets.push("discordant", "discordantexp", "unchartedstars");
    const settings: MantisSettings = {
      players,
      tileGameSets: sets,
      factionGameSets: sets,
      numFactions: Number(form.get("numFactions")),
      extraBlues: Number(form.get("extraBlues")),
      extraReds: Number(form.get("extraReds")),
      mulligans: Number(form.get("mulligans")),
      bannedFactions: String(form.get("bannedFactions") ?? "")
        .split(",")
        .filter(Boolean) as FactionId[],
      requiredFactions: String(form.get("requiredFactions") ?? "")
        .split(",")
        .filter(Boolean) as FactionId[],
      draftOrder: form.has("staticOrder")
        ? players.map((player) => player.id)
        : undefined,
    };
    const { id, token } = createMantisRoom(settings);
    return redirect(`/draft/mantis/${id}`, {
      headers: { "Set-Cookie": await mantisAdminCookie(id).serialize(token) },
    });
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the draft.",
      },
      { status: 400 },
    );
  }
}

export default function MantisNew() {
  const [search] = useSearchParams();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const [banned, setBanned] = useState<string[]>([]);
  const [required, setRequired] = useState<string[]>([]);
  const [extraBlues, setExtraBlues] = useState(0);
  const [extraReds, setExtraReds] = useState(0);
  const [mulligans, setMulligans] = useState(1);
  const [pok, setPok] = useState(true);
  const [te, setTe] = useState(true);
  const [discordant, setDiscordant] = useState(false);
  const [numFactions, setNumFactions] = useState<string | number>(8);
  const [playerCount, setPlayerCount] = useState(() =>
    parseLobbyPlayerCount(search.get("playerCount"), 4, 8),
  );
  const gameSets: GameSet[] = ["base"];
  if (pok) gameSets.push("pok");
  if (te) gameSets.push("te");
  if (discordant)
    gameSets.push("discordant", "discordantexp", "unchartedstars");
  const enabledFactions = getFactionPool(gameSets);
  const availableFactions = enabledFactions.filter(
    (id) => !banned.includes(id),
  );
  const options = Object.values(allFactions)
    .filter((f) => f.set !== "twilightsFall")
    .map((f) => ({
      value: f.id,
      label: f.name,
      disabled: !enabledFactions.includes(f.id),
    }));
  const unavailableRequired = required.filter(
    (id) => !availableFactions.includes(id as FactionId),
  );
  const countError =
    availableFactions.length < playerCount
      ? `At least ${playerCount} factions are needed. Enable more content or remove some bans.`
      : !Number.isInteger(numFactions) ||
          Number(numFactions) < playerCount ||
          Number(numFactions) > availableFactions.length
        ? `Choose between ${playerCount} and ${availableFactions.length} factions.`
        : undefined;
  const requiredError = unavailableRequired.length
    ? `Unavailable: ${unavailableRequired.map((id) => allFactions[id as FactionId].name).join(", ")}. Enable their content or remove their ban or requirement.`
    : required.length > Number(numFactions)
      ? `Increase the faction pool to at least ${required.length} or remove some required factions.`
      : undefined;
  return (
    <Container size="sm" py="xl">
      <Form method="post">
        <Stack gap="lg">
          <DraftSetupHeading
            title="Mantis draft"
            description="Draft individual systems, factions, and speaker positions. Keep three blue and two red tiles, then build your corner of the galaxy."
            players={playerCount}
          />
          {result?.error && <Alert color="red">{result.error}</Alert>}
          <Alert color="blue" title="Create a shared lobby">
            Choose your settings and create the lobby, then share its link.
            Everyone enters their own name to join, including you if you are
            playing. Start the draft once everyone has joined. Each player’s
            recovery code and this browser’s saved access let them return later.
          </Alert>
          <input type="hidden" name="playerCount" value={playerCount} />
          <LobbyPlayerCount
            description="4–8 players; names are entered when joining."
            count={playerCount}
            onChange={(count) => {
              setPlayerCount(count);
              setNumFactions((current) =>
                typeof current === "number" && Number.isFinite(current)
                  ? Math.max(count, current)
                  : count,
              );
            }}
            min={4}
            max={8}
          />
          <Checkbox
            name="staticOrder"
            label="Use join order for the snake draft"
            description="Otherwise the initial draft order is shuffled. Speaker positions are chosen during the draft."
          />
          <Group>
            <Checkbox
              name="pok"
              label="Prophecy of Kings"
              checked={pok}
              onChange={(event) => setPok(event.currentTarget.checked)}
            />
            <Checkbox
              name="te"
              label="Thunder's Edge"
              checked={te}
              onChange={(event) => setTe(event.currentTarget.checked)}
            />
            <Checkbox
              name="ds"
              label="Discordant Stars"
              checked={discordant}
              onChange={(event) => setDiscordant(event.currentTarget.checked)}
            />
          </Group>
          <Text size="sm" c="dimmed">
            Base game content is always included.
          </Text>
          <NumberInput
            name="numFactions"
            label="Factions in the public pool"
            description={`${availableFactions.length} factions available with the current content and bans.`}
            min={playerCount}
            max={Math.max(playerCount, availableFactions.length)}
            value={numFactions}
            onChange={setNumFactions}
            error={countError}
            allowDecimal={false}
          />
          <MultiSelect
            label="Banned factions"
            searchable
            data={options}
            value={banned}
            onChange={setBanned}
          />
          <input type="hidden" name="bannedFactions" value={banned.join(",")} />
          <MultiSelect
            label="Required factions"
            searchable
            description="Enable a faction's content before adding it. Existing choices are kept when content is disabled."
            data={options.map((f) => ({
              ...f,
              disabled: f.disabled || banned.includes(f.value),
            }))}
            value={required}
            onChange={setRequired}
            error={requiredError}
          />
          <input
            type="hidden"
            name="requiredFactions"
            value={required.join(",")}
          />
          <Group grow>
            <NumberInput
              name="extraBlues"
              label="Extra blue tiles"
              min={0}
              max={2}
              value={extraBlues}
              onChange={(value) =>
                setExtraBlues(typeof value === "number" ? value : 0)
              }
              allowDecimal={false}
            />
            <NumberInput
              name="extraReds"
              label="Extra red tiles"
              min={0}
              max={2}
              value={extraReds}
              onChange={(value) =>
                setExtraReds(typeof value === "number" ? value : 0)
              }
              allowDecimal={false}
            />
          </Group>
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={3}>Build the map with your drafted tiles</Title>
              <Text size="sm">
                If you draft extra tiles, choose which to discard until you have
                exactly 3 blue and 2 red. Once every hand is ready, map building
                starts automatically. The app sets the layout and home systems
                using your drafted seats and factions. On your turn, it draws
                one of your remaining tiles at random; you choose which
                highlighted space in your section receives it.
              </Text>
              <MapBuildDiagram
                playerCount={playerCount}
                source="pool"
                draftBlues={3 + extraBlues}
                draftReds={2 + extraReds}
                mulligans={mulligans}
              />
              <Text size="sm">
                Everyone fills their one stage 1 space, then their two stage 2
                spaces, then their two stage 3 spaces, as numbered in the map
                above. The player with the most empty spaces in the current
                group places next; ties follow speaker order. All five of your
                kept tiles are placed, with your home system in a separate home
                position.
              </Text>
            </Stack>
          </Paper>
          <NumberInput
            name="mulligans"
            label="Mulligans per player"
            description="Total redraws per player for the whole map build. Draw a different tile from your remaining hand; the original stays to be placed later."
            min={0}
            max={3}
            value={mulligans}
            onChange={(value) => setMulligans(Number(value) || 0)}
            allowDecimal={false}
          />
          <Button
            type="submit"
            loading={navigation.state !== "idle"}
            disabled={!!countError || !!requiredError}
          >
            Create Mantis lobby
          </Button>
        </Stack>
      </Form>
    </Container>
  );
}
