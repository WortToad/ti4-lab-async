import {
  Accordion,
  Badge,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { bagCategoryLabel } from "./BagComponents";
import { isTwilightsFallBag } from "./rules";
import type { BagItemCategory } from "./catalog";
import type { BagDraftView, BagRules, BagVariant } from "./types";

export function BagDraftGuide({
  rules,
  variant,
  phase = "lobby",
}: {
  rules: BagRules;
  variant: BagVariant;
  phase?: BagDraftView["phase"];
}) {
  const hasTiles =
    (rules.draftLimits.BLUETILE ?? 0) + (rules.draftLimits.REDTILE ?? 0) > 0;
  const active =
    phase === "lobby"
      ? 0
      : phase === "drafting"
        ? 1
        : phase === "assembling"
          ? 2
          : 3;
  const stages = [
    {
      title: "Join the lobby",
      text: "Enter your name to join, then save your recovery UUID. The admin starts once everyone has joined.",
    },
    {
      title: "Collect from passing bags",
      text: `Pick ${rules.firstBagPicks} from your first bag, then ${rules.laterBagPicks} per pass when available. Everyone picks together; bags pass after everyone is ready.`,
    },
    {
      title: "Choose what to keep",
      text: "Build your final faction from your collection. Keep the required number in every category (or all available choices if you have fewer), then confirm.",
    },
    {
      title: hasTiles ? "Reveal and build the map" : "Reveal and play",
      text: hasTiles
        ? "Final factions become public together. With 3 blue and 2 red tiles per player, the next phase uses those same tiles to build each player’s section of one shared map. See the map guide below for requirements and placement."
        : "Final choices become public once everyone confirms. Copy or download the results, then use your separately arranged map.",
    },
  ];
  const categories = [
    ...new Set([
      ...Object.keys(rules.draftLimits),
      ...Object.keys(rules.keepLimits),
    ]),
  ] as BagItemCategory[];
  const content = (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
        {stages.map((stage, index) => (
          <Paper
            key={stage.title}
            withBorder
            p="sm"
            radius="md"
            bg={
              index === active ? "var(--mantine-color-blue-light)" : undefined
            }
            aria-current={index === active ? "step" : undefined}
          >
            <Stack gap="xs">
              <Group gap="xs">
                <Badge variant={index === active ? "filled" : "light"}>
                  {index + 1}
                </Badge>
                <Text size="sm" fw={600}>
                  {stage.title}
                </Text>
              </Group>
              <Text size="sm">{stage.text}</Text>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
      <Accordion variant="contained">
        <Accordion.Item value="rules">
          <Accordion.Control>
            Collection limits, final choices and privacy
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Text size="sm">
                <strong>Keep counts are required.</strong> Choose exactly the
                number shown, or keep every available choice if you have fewer.
                A lower count is not an optional choice.
                {isTwilightsFallBag(variant) &&
                  " In Twilight’s Fall and Inaugural Splice, you may fill an ability, genome, or unit upgrade slot with a generic technology instead."}
              </Text>
              <Text size="sm">
                <strong>A bag</strong> is the set of choices currently offered
                to you. <strong>Your collection</strong> contains everything you
                have drafted so far. <strong>Your final faction</strong>{" "}
                contains only the components you keep after the bags stop
                passing.
              </Text>
              <Text size="sm">
                Take at most one component per category per pass
                {variant === "frankendraz"
                  ? ", except that you may take multiple faction packages"
                  : ""}
                . You cannot exceed a category’s collection maximum across all
                bags. If there are fewer legal choices, the required pick count
                is reduced; bags with no legal choices pass automatically.
                Drafting ends when nobody can take anything else.
              </Text>
              {variant === "frankendraz" && (
                <Text size="sm">
                  A faction package unlocks that faction’s components for
                  assembly. Drafting a package does not commit you to playing
                  that complete faction: combine its components with those from
                  your other drafted packages.
                </Text>
              )}
              <Text size="sm">
                Your bag and collected picks stay private to your slot. The
                admin sees lobby progress and recovery controls; other players’
                hands stay hidden. Completed factions are revealed only when
                everyone finishes.
              </Text>
              <Table.ScrollContainer minWidth={300}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Collect up to</Table.Th>
                      <Table.Th>Keep afterward</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {categories
                      .filter(
                        (category) =>
                          (rules.draftLimits[category] ?? 0) +
                            (rules.keepLimits[category] ?? 0) >
                          0,
                      )
                      .map((category) => (
                        <Table.Tr key={category}>
                          <Table.Td>
                            {bagCategoryLabel(category, variant)}
                          </Table.Td>
                          <Table.Td>
                            {rules.draftLimits[category] ??
                              (variant === "frankendraz" ? "From packages" : 0)}
                          </Table.Td>
                          <Table.Td>
                            {category === "FACTION"
                              ? "Choose components"
                              : (rules.keepLimits[category] ?? 0)}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );

  if (phase !== "lobby") {
    return (
      <Accordion variant="separated" radius="md">
        <Accordion.Item value="guide">
          <Accordion.Control>How this draft works</Accordion.Control>
          <Accordion.Panel>{content}</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );
  }

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="md">
        <Title order={2} size="h3">
          How this draft works
        </Title>
        {content}
      </Stack>
    </Paper>
  );
}
