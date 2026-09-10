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
  type ActionFunctionArgs,
} from "react-router";
import { factions as allFactions } from "~/data/factionData";
import {
  createMantisRoom,
  mantisAdminCookie,
} from "~/drizzle/mantisDraft.server";
import type { MantisSettings } from "~/draft/mantis/engine";
import { MapBuildDiagram } from "~/draft/mantis/MapBuildDiagram";
import type { FactionId, GameSet } from "~/types";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const count = Number(form.get("playerCount") ?? 6);
    if (!Number.isInteger(count) || count < 4 || count > 8)
      throw new Error("Choose between 4 and 8 player slots.");
    const names = Array.from({ length: count }, (_, i) => `Player ${i + 1}`);
    const sets: GameSet[] = ["base"];
    if (form.has("pok")) sets.push("pok");
    if (form.has("te")) sets.push("te");
    if (form.has("ds"))
      sets.push("discordant", "discordantexp", "unchartedstars");
    const settings: MantisSettings = {
      players: names.map((name, id) => ({ id, name })),
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
        ? names.map((_, index) => index)
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
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const [banned, setBanned] = useState<string[]>([]);
  const [required, setRequired] = useState<string[]>([]);
  const [extraBlues, setExtraBlues] = useState(0);
  const [extraReds, setExtraReds] = useState(0);
  const [mulligans, setMulligans] = useState(1);
  const [playerCount, setPlayerCount] = useState(6);
  const options = Object.values(allFactions)
    .filter((f) => f.set !== "twilightsFall")
    .map((f) => ({ value: f.id, label: f.name }));
  return (
    <Container size="sm" py="xl">
      <Form method="post">
        <Stack gap="lg">
          <Title order={2}>Mantis draft</Title>
          <Text>
            Take turns drafting a faction, a speaker position and individual map
            tiles from a shared pool. Each player keeps exactly 3 blue and 2 red
            tiles. In the next phase, those same five tiles fill that player’s
            section of the shared map.
          </Text>
          {result?.error && <Alert color="red">{result.error}</Alert>}
          <Alert color="blue" title="Create a shared lobby">
            Everyone uses the same link and enters their name to join. Each
            player receives a recovery UUID. Draft order, seats, and choices
            stay hidden until everyone has joined and you start the draft.
          </Alert>
          <NumberInput
            name="playerCount"
            label="Player slots"
            description="4–8 players; names are entered when joining."
            value={playerCount}
            onChange={(value) =>
              setPlayerCount(typeof value === "number" ? value : 6)
            }
            min={4}
            max={8}
            allowDecimal={false}
            required
          />
          <Checkbox
            name="staticOrder"
            label="Use join order for the snake draft"
            description="Otherwise the initial draft order is shuffled. Speaker positions are chosen during the draft."
          />
          <Group>
            <Checkbox name="pok" label="Prophecy of Kings" defaultChecked />
            <Checkbox name="te" label="Thunder's Edge" defaultChecked />
            <Checkbox name="ds" label="Discordant Stars" />
          </Group>
          <Text size="sm" c="dimmed">
            Base game content is always included.
          </Text>
          <NumberInput
            name="numFactions"
            label="Factions in the public pool"
            min={4}
            max={80}
            defaultValue={8}
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
            data={options.filter((f) => !banned.includes(f.value))}
            value={required}
            onChange={setRequired}
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
                above. The player with
                the most empty spaces in the current group places next; ties
                follow speaker order. All five of your kept tiles are placed,
                with your home system in a separate home position.
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
          <Button type="submit" loading={navigation.state !== "idle"}>
            Create Mantis lobby
          </Button>
        </Stack>
      </Form>
    </Container>
  );
}
