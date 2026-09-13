import {
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCards,
  IconCrown,
  IconDna,
  IconEye,
  IconHexagon,
  IconRocket,
  IconSparkles,
} from "@tabler/icons-react";
import { FactionIcon } from "~/components/icons/FactionIcon";
import { TechIcon } from "~/components/icons/TechIcon";
import { SystemTileCard } from "~/components/SystemTileCard";
import { TileLegend } from "~/components/TileLegend";
import { GameTerm, GameTerms } from "~/components/GameTerm";
import { factions } from "~/data/factionData";
import { mahactKingReferences } from "~/data/mahactKingReferences";
import {
  MahactKingReference,
  MahactKingUnits,
} from "~/routes/draft.$id/components/MahactKingReference";
import type { TechSpecialty } from "~/types";
import { Surface } from "~/ui";
import { useSafeOutletContext } from "~/useSafeOutletContext";
import { appPath } from "~/utils/appUrl";
import {
  CATEGORY_LABELS,
  type BagDraftItem,
  type BagItemCategory,
} from "./definitions";
import type { BagVariant } from "./types";
import { getBagFaction, unitLabel, type UnitColor } from "./visuals";
import { BagItemDescription } from "./BagItemDescription";
import { BagSystemDescription } from "./BagSystemDescription";
import { UnitDetails, UnitSymbol } from "./UnitDetails";
import classes from "./BagComponents.module.css";

const sourceNames: Record<string, string> = {
  base: "Base game",
  pok: "Prophecy of Kings",
  thunders_edge: "Thunder’s Edge",
  twilight: "Twilight’s Fall",
  twilights_fall: "Twilight’s Fall",
  twilight_ds: "Twilight’s Fall · Discordant Stars",
  ds: "Discordant Stars",
  blue_reverie: "Blue Reverie",
  theodisi: "Lost Legacies",
  monuments: "Monuments",
  franken: "Franken",
  uncharted_space: "Uncharted Space",
};

const techTypes: Record<string, TechSpecialty> = {
  biotic: "BIOTIC",
  cybernetic: "CYBERNETIC",
  propulsion: "PROPULSION",
  warfare: "WARFARE",
};

export function bagCategoryLabel(
  category: BagItemCategory,
  variant: BagVariant,
) {
  if (variant === "twilights_fall" || variant === "inaugural_splice") {
    if (category === "TECH") return "Abilities";
    if (category === "AGENT") return "Genomes";
    if (category === "UNIT") return "Unit upgrades";
  }
  return CATEGORY_LABELS[category] ?? category;
}

function ComponentIcon({ item }: { item: BagDraftItem }) {
  const faction = getBagFaction(item);
  if (faction)
    return <FactionIcon faction={faction} style={{ width: 38, height: 38 }} />;
  if (item.factionIconPath)
    return (
      <img
        src={appPath(item.factionIconPath)}
        alt={item.factionName ?? "Faction"}
        width={38}
        height={38}
        style={{ objectFit: "contain" }}
        loading="lazy"
      />
    );
  const Icon =
    item.category === "MAHACTKING"
      ? IconCrown
      : item.category === "AGENT"
        ? IconDna
        : item.systemId
          ? IconHexagon
          : item.unit || item.category === "STARTINGFLEET"
            ? IconRocket
            : item.category === "ABILITY" || item.category === "TECH"
              ? IconSparkles
              : IconCards;
  return <Icon size={30} stroke={1.5} aria-hidden />;
}

function Fleet({
  fleet,
  color,
}: {
  fleet: NonNullable<BagDraftItem["fleet"]>;
  color?: UnitColor;
}) {
  return (
    <SimpleGrid type="container" cols={{ base: 2, "30rem": 3 }} spacing="xs">
      {fleet.map(({ unit, count }) => (
        <Group key={unit} gap="xs" wrap="nowrap" className={classes.fleetUnit}>
          <UnitSymbol unit={unit} color={color} />
          <div>
            <Text fw={700} size="lg" lh={1.1}>
              {count}
            </Text>
            <Text size="xs" c="dimmed">
              {unitLabel(unit)}
            </Text>
          </div>
        </Group>
      ))}
    </SimpleGrid>
  );
}

export function BagItemCard({
  item,
  variant = "franken",
  selected,
  disabled,
  onSelect,
  note,
  unitColor,
}: {
  item: BagDraftItem;
  variant?: BagVariant;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (selected: boolean) => void;
  note?: string;
  unitColor?: UnitColor;
}) {
  const [opened, { open, close }] = useDisclosure();
  const { originalArt } = useSafeOutletContext();
  const factionId = getBagFaction(item);
  const faction = factionId ? factions[factionId] : undefined;
  const king =
    item.category === "MAHACTKING" && factionId
      ? mahactKingReferences[factionId]
      : undefined;
  const imagePath =
    item.imagePath ??
    (item.category === "FACTION" && factionId
      ? `/factioncards/${factionId}.png`
      : undefined);
  const showOriginalCard = originalArt && imagePath && !item.systemId;
  const order =
    item.category === "DRAFTORDER" ? item.id.split(":")[1] : undefined;

  return (
    <Surface
      variant="card"
      color={selected ? "blue" : undefined}
      className={classes.card}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      style={king ? { borderTop: `3px solid ${king.accent}` } : undefined}
    >
      <Box className={classes.header}>
        <Box className={classes.icon}>
          <ComponentIcon item={item} />
        </Box>
        <Group gap={6} className={classes.category}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts="0.04em">
            <GameTerms>{bagCategoryLabel(item.category, variant)}</GameTerms>
          </Text>
          {item.technologyTypes?.map((type) =>
            techTypes[type.toLowerCase()] ? (
              <TechIcon
                key={type}
                techSpecialty={techTypes[type.toLowerCase()]}
                size={16}
              />
            ) : null,
          )}
        </Group>
        {onSelect ? (
          <Checkbox
            color="sky"
            checked={selected ?? false}
            disabled={disabled}
            onChange={(event) => onSelect(event.currentTarget.checked)}
            label={<GameTerms showHelp={false}>{item.name}</GameTerms>}
            classNames={{ label: classes.name }}
            styles={{
              body: { alignItems: "center" },
              label: { cursor: disabled ? "not-allowed" : "pointer" },
            }}
            className={classes.selection}
          />
        ) : (
          <Text className={`${classes.name} ${classes.selection}`}>
            <GameTerms>{item.name}</GameTerms>
          </Text>
        )}
        {item.factionName && item.factionName !== item.name && (
          <Text size="xs" c="dimmed" className={classes.factionName}>
            {item.factionName}
          </Text>
        )}
      </Box>
      <Stack gap="sm" p="md" className={classes.body}>
        {item.systemId && (
          <SystemTileCard
            systemId={item.systemId}
            imagePath={imagePath}
            radius={112}
            padding={4}
            style={{ background: "transparent", border: 0 }}
          />
        )}
        {showOriginalCard && (
          <button
            type="button"
            className={classes.artButton}
            onClick={open}
            aria-label={`Enlarge ${item.name} original card`}
          >
            <img
              src={appPath(imagePath)}
              alt={`${item.name} original card`}
              loading="lazy"
            />
          </button>
        )}
        {order && (
          <Text ff="heading" fw={700} fz={42} ta="center" c="violet" py="xs">
            {order.padStart(2, "0")}
          </Text>
        )}
        {item.fleet && (
          <Fleet fleet={item.fleet} color={king?.unitColor ?? unitColor} />
        )}
        {king ? (
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              <GameTerm term="commodities">{`${king.commodities} commodities`}</GameTerm>
            </Text>
            <MahactKingUnits reference={king} />
          </Stack>
        ) : item.systemId ? (
          <BagSystemDescription
            systemId={item.systemId}
            description={item.description}
          />
        ) : item.unit && !item.originalDescription ? (
          <>
            <UnitDetails
              unit={item.unit}
              showText={item.category !== "TECH"}
              color={unitColor}
            />
            {item.category === "TECH" && (
              <BagItemDescription description={item.description} />
            )}
          </>
        ) : item.description ? (
          <BagItemDescription description={item.description} />
        ) : null}
        {note && (
          <Text size="sm" className={classes.note}>
            <GameTerms>{note}</GameTerms>
          </Text>
        )}
      </Stack>
      <Group justify="space-between" gap="xs" className={classes.footer}>
        <Text size="xs" c="dimmed">
          {sourceNames[item.source] ?? item.source.replaceAll("_", " ")}
        </Text>
        <Group gap={4}>
          {item.systemId && <TileLegend />}
          {(imagePath || king) && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<IconEye size={14} />}
              onClick={open}
            >
              {king
                ? "King reference"
                : item.systemId
                  ? "Original tile"
                  : "Original card"}
            </Button>
          )}
        </Group>
      </Group>
      <Modal
        opened={opened}
        onClose={close}
        title={item.name}
        size={king ? "xl" : "lg"}
        centered
      >
        {king && faction ? (
          <MahactKingReference faction={faction} reference={king} />
        ) : imagePath ? (
          <Stack gap="sm">
            <img
              src={appPath(imagePath)}
              alt={`${item.name} original ${item.systemId ? "tile" : "card"}`}
              className={classes.original}
            />
            {item.originalDescription && (
              <Text size="sm">
                Use the draft rules shown on the component when they differ from
                the printed card.
              </Text>
            )}
          </Stack>
        ) : null}
      </Modal>
    </Surface>
  );
}
