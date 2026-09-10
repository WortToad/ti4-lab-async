import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Container,
  Group,
  Paper,
  Select,
  SegmentedControl,
  Stack,
  Text,
  NumberInput,
  Title,
} from "@mantine/core";
import { useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
  type ActionFunctionArgs,
} from "react-router";
import { createRawRoom, rawCookie } from "~/drizzle/rawDraft.server";
import type { RawSettings } from "~/draft/raw/engine";
import { getRawLayouts } from "~/draft/raw/layouts";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const mode = String(form.get("mode"));
    if (mode !== "base" && mode !== "twilightsFall")
      throw new Error("Choose normal TI4 or Twilight’s Fall.");
    const count = Number(form.get("playerCount"));
    if (!Number.isInteger(count) || count < 3 || count > 8)
      throw new Error("Choose between 3 and 8 player slots.");
    const names = Array.from({ length: count }, (_, i) => `Slot ${i + 1}`);
    const settings: RawSettings = {
      players: names.map((name, id) => ({ id, name })),
      mode,
      pok: form.has("pok"),
      te: mode === "twilightsFall" || form.has("te"),
      layout: String(form.get("layout") ?? "") || undefined,
    };
    const { id, token } = createRawRoom(settings);
    return redirect(`/draft/raw/${id}`, {
      headers: {
        "Set-Cookie": await rawCookie(id, "admin").serialize(token),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the RAW setup.",
      },
      { status: 400 },
    );
  }
}

export default function RawNew() {
  const [search] = useSearchParams();
  const [mode, setMode] = useState(
    search.get("mode") === "twilightsFall" ? "twilightsFall" : "base",
  );
  const [pok, setPok] = useState(true);
  const [te, setTe] = useState(true);
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
  const [count, setCount] = useState(6);
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const twilight = mode === "twilightsFall";
  const layouts = getRawLayouts({
    players: Array.from({ length: count }, (_, id) => ({ id, name: "" })),
    pok,
    te: twilight || te,
  });
  const layout =
    layouts.find((entry) => entry.id === selectedLayout) ?? layouts[0];

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Anchor component={Link} to="/draft/prechoice" size="sm">
          ← All draft formats
        </Anchor>
        <div>
          <Title order={1}>Rules as written (RAW)</Title>
          <Text c="dimmed" mt="xs">
            Draft and build your galaxy using the official setup rules.
          </Text>
        </div>
        <Form method="post">
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="layout" value={layout?.id ?? ""} />
          <Stack gap="lg">
            {result?.error && (
              <Alert color="red" title="Setup could not be created">
                {result.error}
              </Alert>
            )}
            <SegmentedControl
              value={mode}
              onChange={setMode}
              fullWidth
              data={[
                { value: "base", label: "Normal TI4" },
                { value: "twilightsFall", label: "Twilight’s Fall" },
              ]}
            />
            <Paper withBorder p="lg" radius="md">
              <Stack gap="sm">
                <Title order={2} size="h3">
                  {twilight
                    ? "Official starting draft"
                    : "Official galaxy construction"}
                </Title>
                <Text size="sm">
                  {twilight
                    ? "Draft faction reference cards by passing left, then reveal a priority card to determine seating and speaker. Build the galaxy, choose home systems and Mahact kings, and perform the inaugural splice."
                    : "Randomly determine the speaker and choose factions. Each player receives a private hand of system tiles, then takes turns choosing a tile and placing it in the galaxy."}
                </Text>
                <Text size="sm">
                  The map uses the official layout and tile counts for your
                  player count and expansions. Fill each ring before the next,
                  reverse placement order each round, and follow anomaly and
                  wormhole adjacency rules.
                </Text>
              </Stack>
            </Paper>
            <NumberInput
              name="playerCount"
              label="Player slots"
              description="Share one lobby link. Each player enters their name and joins before the admin starts."
              value={count}
              onChange={(value) =>
                setCount(typeof value === "number" ? value : 0)
              }
              min={3}
              max={8}
              allowDecimal={false}
              required
            />
            <Group>
              <Text size="sm" c="dimmed">
                {count} players · 3–8 supported
              </Text>
            </Group>
            <Stack gap="sm">
              <Checkbox
                name="pok"
                label="Prophecy of Kings"
                checked={pok}
                onChange={(event) => setPok(event.currentTarget.checked)}
              />
              {twilight ? (
                <Text size="sm">
                  Thunder’s Edge and the Twilight’s Fall components are
                  included.
                </Text>
              ) : (
                <Checkbox
                  name="te"
                  label="Thunder’s Edge"
                  checked={te}
                  onChange={(event) => setTe(event.currentTarget.checked)}
                />
              )}
            </Stack>
            <Select
              label="Official map layout"
              data={layouts.map((entry) => ({
                value: entry.id,
                label: entry.label,
              }))}
              value={layout?.id ?? null}
              onChange={setSelectedLayout}
              allowDeselect={false}
              description={
                layout?.description ??
                "Enter 3–6 players, or enable Prophecy of Kings for 7–8 players."
              }
            />
            <Alert color="blue" title="One lobby link for everyone">
              Share the lobby link. Players enter their name, join, and save
              their recovery UUID. The host starts once everyone has joined.
              Seating and cards stay hidden until then. Admin
              recovery controls include undo, checkpoints, and private save
              files; only your own hidden hands are visible when you also join
              as a player.
            </Alert>
            <Button
              type="submit"
              size="lg"
              loading={navigation.state === "submitting"}
              disabled={!layout}
            >
              Create RAW setup
            </Button>
            <Text size="xs" c="dimmed">
              Rules: Living Rules Reference v2.0, pp. 4–6; Thunder’s Edge, p. 7;
              Twilight’s Fall, pp. 7–8.
            </Text>
          </Stack>
        </Form>
      </Stack>
    </Container>
  );
}
