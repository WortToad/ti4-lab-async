import {
  Badge,
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
import { factions } from "~/data/factionData";
import { mahactKingReferences } from "~/data/mahactKingReferences";
import { MahactKingReference } from "~/routes/draft.$id/components/MahactKingReference";
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
import { getBagFaction, unitIconPath, unitLabel } from "./visuals";
import { BagItemDescription } from "./BagItemDescription";
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

function UnitSymbol({ unit, size = 38 }: { unit: string; size?: number }) {
  const path = unitIconPath(unit);
  return path ? (
    <img
      src={appPath(path)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      loading="lazy"
    />
  ) : (
    <IconRocket size={size} stroke={1.5} aria-hidden />
  );
}

function Fleet({ fleet }: { fleet: NonNullable<BagDraftItem["fleet"]> }) {
  return (
    <SimpleGrid type="container" cols={{ base: 2, "30rem": 3 }} spacing="xs">
      {fleet.map(({ unit, count }) => (
        <Group key={unit} gap="xs" wrap="nowrap" className={classes.fleetUnit}>
          <UnitSymbol unit={unit} />
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

function UnitDetails({
  unit,
  showText = true,
}: {
  unit: NonNullable<BagDraftItem["unit"]>;
  showText?: boolean;
}) {
  return (
    <Stack gap="sm">
      <Group gap="sm">
        <UnitSymbol unit={unit.type} />
        <Text size="sm" fw={600}>
          {unitLabel(unit.type)}
        </Text>
      </Group>
      {unit.stats.length > 0 && (
        <SimpleGrid cols={unit.stats.length > 2 ? 4 : 2} spacing={6}>
          {unit.stats.map((stat) => (
            <Box key={stat.label} className={classes.stat}>
              <Text fw={700} size="lg" lh={1.2}>
                {stat.value}
              </Text>
              <Text size="xs" c="dimmed">
                {stat.label}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      )}
      {unit.abilities.length > 0 && (
        <Group gap={6}>
          {unit.abilities.map((ability) => (
            <Badge
              key={ability}
              variant="light"
              color="gray"
              className={classes.trait}
            >
              {ability}
            </Badge>
          ))}
        </Group>
      )}
      {showText && unit.text && (
        <BagItemDescription description={unit.text} />
      )}
    </Stack>
  );
}

export function BagItemCard({
  item,
  variant = "franken",
  selected,
  disabled,
  onSelect,
  note,
}: {
  item: BagDraftItem;
  variant?: BagVariant;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (selected: boolean) => void;
  note?: string;
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
      color={selected ? "violet" : undefined}
      className={classes.card}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      style={king ? { borderTop: `3px solid ${king.accent}` } : undefined}
    >
      <Group
        gap="sm"
        wrap="nowrap"
        align="center"
        className={classes.header}
      >
        <Box className={classes.icon}>
          <ComponentIcon item={item} />
        </Box>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts="0.04em">
              {bagCategoryLabel(item.category, variant)}
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
              checked={selected ?? false}
              disabled={disabled}
              onChange={(event) => onSelect(event.currentTarget.checked)}
              label={item.name}
              classNames={{ label: classes.name }}
              styles={{
                label: { cursor: disabled ? "not-allowed" : "pointer" },
              }}
            />
          ) : (
            <Text className={classes.name}>{item.name}</Text>
          )}
          {item.factionName && item.factionName !== item.name && (
            <Text size="xs" c="dimmed">
              {item.factionName}
            </Text>
          )}
        </Stack>
      </Group>
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
        {item.fleet && <Fleet fleet={item.fleet} />}
        {item.unit && !item.originalDescription ? (
          <>
            <UnitDetails unit={item.unit} showText={item.category !== "TECH"} />
            {item.category === "TECH" && (
              <BagItemDescription description={item.description} />
            )}
          </>
        ) : item.description ? (
          <BagItemDescription
            description={item.description}
            planetStats={Boolean(item.systemId)}
          />
        ) : null}
        {note && (
          <Text size="xs" c="dimmed" className={classes.note}>
            {note}
          </Text>
        )}
      </Stack>
      <Group justify="space-between" gap="xs" className={classes.footer}>
        <Text size="xs" c="dimmed">
          {sourceNames[item.source] ?? item.source.replaceAll("_", " ")}
        </Text>
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
