import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import {
  BAG_BAN_PRESETS,
  BAG_CATALOG,
  getBagDraftPool,
  type BagItemCategory,
} from "~/draft/bag/catalog";
import { bagCategoryLabel } from "~/draft/bag/BagComponents";
import { createBagDraft } from "~/draft/bag/bagDraft.server";
import { BAG_VARIANTS, getBagRules } from "~/draft/bag/rules";

type DraftInput = Parameters<typeof createBagDraft>[0];

export async function loader({ request }: LoaderFunctionArgs) {
  const requestedVariant = new URL(request.url).searchParams.get("variant");
  const variant =
    BAG_VARIANTS.find((entry) => entry.id === requestedVariant)?.id ??
    "franken";
  const factions = new Map<string, string>();
  for (const item of BAG_CATALOG) {
    if (item.faction)
      factions.set(item.faction, item.factionName ?? item.faction);
  }
  return {
    variant,
    banPresets: BAG_BAN_PRESETS,
    factions: Array.from(factions, ([value, label]) => ({ value, label })).sort(
      (a, b) => a.label.localeCompare(b.label),
    ),
    items: [false, true].map((twilightsFall) =>
      getBagDraftPool({
        twilightsFall,
        includeDiscordantStars: true,
        includeThundersEdge: true,
        includeBlueReverie: true,
        includeLostLegacies: true,
        includeMonuments: true,
      }).map((item) => ({
        value: item.id,
        label: `${item.name} · ${bagCategoryLabel(item.category, twilightsFall ? "twilights_fall" : "franken")}${item.factionName ? ` · ${item.factionName}` : ""}`,
      })),
    ),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  try {
    const input = JSON.parse(String(form.get("settings") ?? "")) as DraftInput;
    const result = await createBagDraft(input);
    return redirect(`/draft/bag/${result.id}?key=${result.adminToken}`, {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create this draft. Please check the settings.",
      },
      { status: 400 },
    );
  }
}

export default function NewBagDraft() {
  const options = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [variant, setVariant] = useState<DraftInput["variant"]>(
    options.variant,
  );
  const [playerNames, setPlayerNames] = useState(
    "Player 1\nPlayer 2\nPlayer 3\nPlayer 4\nPlayer 5\nPlayer 6",
  );
  const [includeDiscordantStars, setIncludeDiscordantStars] = useState(false);
  const [includeThundersEdge, setIncludeThundersEdge] = useState(true);
  const [includeBlueReverie, setIncludeBlueReverie] = useState(false);
  const [includeLostLegacies, setIncludeLostLegacies] = useState(false);
  const [includeTiles, setIncludeTiles] = useState(true);
  const [includeMonuments, setIncludeMonuments] = useState(false);
  const [shufflePlayers, setShufflePlayers] = useState(true);
  const [categoryLimits, setCategoryLimits] = useState<
    DraftInput["categoryLimits"]
  >({});
  const [firstBagPicks, setFirstBagPicks] = useState<number | undefined>();
  const [laterBagPicks, setLaterBagPicks] = useState<number | undefined>();
  const [bannedItemIds, setBannedItemIds] = useState<string[]>([]);
  const [bannedFactions, setBannedFactions] = useState<string[]>([]);
  const [priorityFactions, setPriorityFactions] = useState<string[]>([]);
  const [banPresetIds, setBanPresetIds] = useState<string[]>([]);
  const players = playerNames
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);
  const settings: DraftInput = {
    variant,
    players,
    includeDiscordantStars,
    includeThundersEdge,
    includeTiles,
    includeMonuments,
    shufflePlayers,
    categoryLimits,
    firstBagPicks,
    laterBagPicks,
    bannedItemIds: [
      ...new Set([
        ...bannedItemIds,
        ...options.banPresets
          .filter((preset) => banPresetIds.includes(preset.id))
          .flatMap((preset) => preset.itemIds),
      ]),
    ],
    bannedFactions,
    priorityFactions,
    includeBlueReverie,
    includeLostLegacies,
  };
  const rules = getBagRules(settings);
  const activeVariant = BAG_VARIANTS.find((entry) => entry.id === variant);
  const categories = [
    ...new Set([
      ...Object.keys(rules.draftLimits),
      ...Object.keys(rules.keepLimits),
    ]),
  ] as BagItemCategory[];
  const isTwilightsFall =
    variant === "twilights_fall" || variant === "inaugural_splice";
  const categoryLabel = (category: BagItemCategory) =>
    bagCategoryLabel(category, variant);

  function changeVariant(next: string | null) {
    if (!next) return;
    setVariant(next as DraftInput["variant"]);
    setCategoryLimits({});
    setFirstBagPicks(undefined);
    setLaterBagPicks(undefined);
    setBanPresetIds([]);
  }

  function changeLimit(
    category: BagItemCategory,
    field: "draft" | "keep",
    value: string | number,
  ) {
    if (typeof value !== "number") return;
    setCategoryLimits((current) => ({
      ...current,
      [category]: {
        draft: current?.[category]?.draft ?? rules.draftLimits[category] ?? 0,
        keep: current?.[category]?.keep ?? rules.keepLimits[category] ?? 0,
        [field]: value,
      },
    }));
  }

  return (
    <Stack className="ph-no-capture" maw={1100} mx="auto" py="xl" gap="lg">
      <Anchor component={Link} to="/draft/prechoice" size="sm">
        ← All draft formats
      </Anchor>
      <div>
        <Title order={1}>Bag &amp; Franken drafts</Title>
        <Text c="dimmed" mt="xs">
          Build your own faction by choosing components from bags that pass
          around the table. Everyone gets a private player link and can draft
          when they are ready.
        </Text>
      </div>
      <Form method="post">
        <input type="hidden" name="settings" value={JSON.stringify(settings)} />
        <Stack gap="lg">
          {actionData?.error && (
            <Alert color="red" title="Draft could not be created">
              {actionData.error}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Paper withBorder p="lg" radius="md">
              <Stack>
                <Title order={2} size="h3">
                  Draft format
                </Title>
                <Select
                  label="Variant"
                  data={BAG_VARIANTS.map((entry) => ({
                    value: entry.id,
                    label: entry.name,
                  }))}
                  value={variant}
                  onChange={changeVariant}
                  allowDeselect={false}
                />
                <Text size="sm">{activeVariant?.description}</Text>
                <Group gap="xs">
                  <Badge variant="light">
                    First bag: {rules.firstBagPicks} picks
                  </Badge>
                  <Badge variant="light">
                    Later bags: {rules.laterBagPicks} picks
                  </Badge>
                </Group>
                {isTwilightsFall && (
                  <Alert color="violet" title="Twilight’s Fall">
                    Assemble abilities, genomes, and unit upgrades using the
                    Twilight’s Fall component pool.
                  </Alert>
                )}
              </Stack>
            </Paper>
            <Paper withBorder p="lg" radius="md">
              <Stack>
                <Title order={2} size="h3">
                  Players
                </Title>
                <Textarea
                  label="One player name per line"
                  description="Names identify each private seat. Share each link only with its player."
                  value={playerNames}
                  onChange={(event) =>
                    setPlayerNames(event.currentTarget.value)
                  }
                  minRows={6}
                  autosize
                />
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {players.length} players
                  </Text>
                  <Switch
                    label="Shuffle seating order"
                    checked={shufflePlayers}
                    onChange={(event) =>
                      setShufflePlayers(event.currentTarget.checked)
                    }
                  />
                </Group>
              </Stack>
            </Paper>
          </SimpleGrid>
          <Paper withBorder p="lg" radius="md">
            <Stack>
              <Title order={2} size="h3">
                Components
              </Title>
              <Text size="sm" c="dimmed">
                Base game and Prophecy of Kings components are included.
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Switch
                  label="Thunder’s Edge factions"
                  checked={includeThundersEdge}
                  onChange={(event) =>
                    setIncludeThundersEdge(event.currentTarget.checked)
                  }
                />
                <Switch
                  label="Discordant Stars factions"
                  checked={includeDiscordantStars}
                  onChange={(event) =>
                    setIncludeDiscordantStars(event.currentTarget.checked)
                  }
                />
                <Switch
                  label="Blue Reverie factions"
                  checked={includeBlueReverie}
                  onChange={(event) =>
                    setIncludeBlueReverie(event.currentTarget.checked)
                  }
                />
                <Switch
                  label="Lost Legacies factions"
                  checked={includeLostLegacies}
                  onChange={(event) =>
                    setIncludeLostLegacies(event.currentTarget.checked)
                  }
                />
                {variant !== "inaugural_splice" && (
                  <Switch
                    label="Draft map tiles and speaker order"
                    checked={includeTiles}
                    onChange={(event) => {
                      setIncludeTiles(event.currentTarget.checked);
                      setCategoryLimits({});
                    }}
                  />
                )}
                {!isTwilightsFall && variant !== "standard_bag_draft" && (
                  <Switch
                    label="Monuments"
                    checked={includeMonuments}
                    onChange={(event) => {
                      setIncludeMonuments(event.currentTarget.checked);
                      setCategoryLimits({});
                    }}
                  />
                )}
              </SimpleGrid>
            </Stack>
          </Paper>
          <Accordion variant="separated">
            <Accordion.Item value="limits">
              <Accordion.Control>
                Advanced: picks and category limits
              </Accordion.Control>
              <Accordion.Panel>
                <Stack>
                  <Text size="sm" c="dimmed">
                    The draft limit controls how many components of each type a
                    player can collect. The keep limit controls the final
                    faction. Changing the variant restores its defaults.
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <NumberInput
                      label="Picks from the first bag"
                      min={1}
                      max={20}
                      allowDecimal={false}
                      value={firstBagPicks ?? rules.firstBagPicks}
                      onChange={(value) =>
                        setFirstBagPicks(
                          typeof value === "number" ? value : undefined,
                        )
                      }
                    />
                    <NumberInput
                      label="Picks from later bags"
                      min={1}
                      max={20}
                      allowDecimal={false}
                      value={laterBagPicks ?? rules.laterBagPicks}
                      onChange={(value) =>
                        setLaterBagPicks(
                          typeof value === "number" ? value : undefined,
                        )
                      }
                    />
                  </SimpleGrid>
                  <Table.ScrollContainer minWidth={400}>
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Component</Table.Th>
                          <Table.Th>Draft</Table.Th>
                          <Table.Th>Keep</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {categories.map((category) => (
                          <Table.Tr key={category}>
                            <Table.Td>{categoryLabel(category)}</Table.Td>
                            <Table.Td>
                              <NumberInput
                                aria-label={`${categoryLabel(category)} draft limit`}
                                disabled={
                                  variant === "frankendraz" &&
                                  ![
                                    "FACTION",
                                    "BLUETILE",
                                    "REDTILE",
                                    "DRAFTORDER",
                                  ].includes(category)
                                }
                                min={0}
                                max={
                                  category === "DRAFTORDER" ||
                                  category === "MAHACTKING"
                                    ? 1
                                    : 12
                                }
                                allowDecimal={false}
                                value={rules.draftLimits[category] ?? 0}
                                onChange={(value) =>
                                  changeLimit(category, "draft", value)
                                }
                                maw={100}
                              />
                            </Table.Td>
                            <Table.Td>
                              <NumberInput
                                aria-label={`${categoryLabel(category)} keep limit`}
                                min={0}
                                max={12}
                                allowDecimal={false}
                                value={rules.keepLimits[category] ?? 0}
                                onChange={(value) =>
                                  changeLimit(category, "keep", value)
                                }
                                maw={100}
                              />
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => {
                      setCategoryLimits({});
                      setFirstBagPicks(undefined);
                      setLaterBagPicks(undefined);
                    }}
                    style={{ alignSelf: "flex-start" }}
                  >
                    Restore variant limits
                  </Button>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="bans">
              <Accordion.Control>
                Advanced: excluded factions and components
              </Accordion.Control>
              <Accordion.Panel>
                <Stack>
                  {!isTwilightsFall && variant !== "standard_bag_draft" && (
                    <MultiSelect
                      label="Bot ban presets"
                      description="Preset exclusions are added to any individual components selected below."
                      data={options.banPresets.map((preset) => ({
                        value: preset.id,
                        label: preset.name,
                      }))}
                      value={banPresetIds}
                      onChange={setBanPresetIds}
                      clearable
                    />
                  )}
                  <MultiSelect
                    searchable
                    clearable
                    label="Exclude factions"
                    description="Removes all draft components belonging to these factions."
                    data={options.factions}
                    value={bannedFactions}
                    onChange={setBannedFactions}
                    nothingFoundMessage="No matching faction"
                  />
                  {variant === "frankendraz" && (
                    <MultiSelect
                      searchable
                      clearable
                      label="Prioritize factions"
                      description="Prefer these faction packages when filling the bags. Enable their source above."
                      data={options.factions}
                      value={priorityFactions}
                      onChange={setPriorityFactions}
                      nothingFoundMessage="No matching faction"
                    />
                  )}
                  <MultiSelect
                    searchable
                    clearable
                    label="Exclude individual components"
                    description="Search by component, category, or faction name."
                    data={options.items[isTwilightsFall ? 1 : 0]}
                    value={bannedItemIds}
                    onChange={setBannedItemIds}
                    limit={80}
                    nothingFoundMessage="No matching component"
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          <Alert color="blue" title="Playing with friends">
            After creating the draft, save your host link and send each player
            their private seat link. Bags pass automatically when everyone
            submits their picks. Finish by choosing which components to keep.
          </Alert>
          <Button
            type="submit"
            size="lg"
            loading={navigation.state === "submitting"}
            disabled={players.length < 2 || players.length > 8}
          >
            Create bag draft
          </Button>
          {(players.length < 2 || players.length > 8) && (
            <Text size="sm" c="red">
              Enter between 2 and 8 players.
            </Text>
          )}
        </Stack>
      </Form>
    </Stack>
  );
}
