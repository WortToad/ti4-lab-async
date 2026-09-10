import {
  Alert,
  Button,
  Checkbox,
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
import {
  data,
  Form,
  redirect,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
} from "react-router";
import { factions as allFactions } from "~/data/factionData";
import { createMantisRoom, mantisCookie } from "~/drizzle/mantisDraft.server";
import type { MantisSettings } from "~/draft/mantis/engine";
import type { FactionId, GameSet } from "~/types";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const names = String(form.get("players") ?? "")
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);
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
      headers: { "Set-Cookie": await mantisCookie(id).serialize(token) },
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
  const options = Object.values(allFactions)
    .filter((f) => f.set !== "twilightsFall")
    .map((f) => ({ value: f.id, label: f.name }));
  return (
    <Container size="sm" py="xl">
      <Form method="post">
        <Stack gap="lg">
          <Title order={2}>Mantis draft</Title>
          <Text>
            Snake draft factions, speaker positions, and individual tiles. Each
            player keeps 3 blue and 2 red tiles, then draws tiles at random to
            build their own slice from the center outward.
          </Text>
          {result?.error && <Alert color="red">{result.error}</Alert>}
          <Textarea
            name="players"
            label="Players, one name per line"
            description="4–8 players"
            defaultValue={Array.from(
              { length: 6 },
              (_, i) => `Player ${i + 1}`,
            ).join("\n")}
            minRows={6}
            required
          />
          <Checkbox
            name="staticOrder"
            label="Use the listed player order for the snake draft"
            description="Otherwise the initial draft order is shuffled."
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
              defaultValue={0}
              allowDecimal={false}
            />
            <NumberInput
              name="extraReds"
              label="Extra red tiles"
              min={0}
              max={2}
              defaultValue={0}
              allowDecimal={false}
            />
          </Group>
          <Text size="sm" c="dimmed">
            Extra tiles are drafted, then discarded before map building. Once
            everyone keeps 3 blue and 2 red tiles, those five tiles fill their
            own section of the shared map.
          </Text>
          <NumberInput
            name="mulligans"
            label="Mulligans per player"
            description="Total redraws per player for the whole map build. Draw a different tile from your remaining hand; the original stays to be placed later."
            min={0}
            max={3}
            defaultValue={1}
            allowDecimal={false}
          />
          <Button type="submit" loading={navigation.state !== "idle"}>
            Create Mantis draft
          </Button>
        </Stack>
      </Form>
    </Container>
  );
}
