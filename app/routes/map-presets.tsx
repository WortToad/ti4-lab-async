import { appPath } from "~/utils/appUrl";
import { ActionIcon, Box, Button, Group, Text } from "@mantine/core";
import { Link, useLoaderData } from "react-router";
import { listPresetMaps, TechSkipsData } from "~/drizzle/presetMap.server";
import classes from "./map-presets/styles.module.css";
import {
  IconEye,
  IconHeart,
  IconHeartFilled,
  IconMap,
  IconSparkles,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { MainAppShell } from "~/components/MainAppShell";
import { TechIcon } from "~/components/icons/TechIcon";
import { LegendaryIcon } from "~/components/icons/LegendaryIcon";
import { TechSpecialty } from "~/types";
import type { PresetMapRecord } from "~/drizzle/presetMap.server";

function TechSkipIcon({
  techSpecialty,
  count,
}: {
  techSpecialty: TechSpecialty;
  count: number;
}) {
  if (count === 0) return null;
  return (
    <Box
      pos="relative"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <TechIcon techSpecialty={techSpecialty} size={18} />
      <Text
        size="xs"
        fw="bold"
        c="white"
        pos="absolute"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          WebkitTextStroke: "1.5px black",
          paintOrder: "stroke fill",
          fontSize: "0.6rem",
        }}
      >
        {count}
      </Text>
    </Box>
  );
}

function TechSkipsDisplay({ techSkips }: { techSkips: string | null }) {
  if (!techSkips) return null;

  try {
    const data = JSON.parse(techSkips) as TechSkipsData;
    const hasAny = data.G > 0 || data.R > 0 || data.B > 0 || data.Y > 0;
    if (!hasAny) return null;

    return (
      <Group gap={3}>
        <TechSkipIcon techSpecialty="BIOTIC" count={data.G} />
        <TechSkipIcon techSpecialty="WARFARE" count={data.R} />
        <TechSkipIcon techSpecialty="PROPULSION" count={data.B} />
        <TechSkipIcon techSpecialty="CYBERNETIC" count={data.Y} />
      </Group>
    );
  } catch {
    return null;
  }
}

function LegendaryDisplay({ count }: { count: number | null }) {
  if (!count || count === 0) return null;
  return (
    <Box
      pos="relative"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <LegendaryIcon size={18} />
      <Text
        size="xs"
        fw="bold"
        c="white"
        pos="absolute"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          WebkitTextStroke: "1.5px black",
          paintOrder: "stroke fill",
          fontSize: "0.6rem",
        }}
      >
        {count}
      </Text>
    </Box>
  );
}

type AuthorGroup = {
  author: string;
  totalViews: number;
  totalLikes: number;
  maps: PresetMapRecord[];
};

const presetImageUrl = (preset: PresetMapRecord) =>
  preset.imageUrl ?? appPath(`/map-preset/${preset.id}.png`);

function groupByAuthor(presets: PresetMapRecord[]): AuthorGroup[] {
  const grouped = new Map<string, PresetMapRecord[]>();

  for (const preset of presets) {
    const existing = grouped.get(preset.author);
    if (existing) {
      existing.push(preset);
    } else {
      grouped.set(preset.author, [preset]);
    }
  }

  const authors: AuthorGroup[] = [];
  for (const [author, maps] of grouped) {
    // Maps are already sorted by views desc from the server query
    const totalViews = maps.reduce((sum, m) => sum + (m.views ?? 0), 0);
    const totalLikes = maps.reduce((sum, m) => sum + (m.likes ?? 0), 0);
    authors.push({ author, totalViews, totalLikes, maps });
  }

  // Sort authors by total views descending (most popular first)
  authors.sort((a, b) => b.totalViews - a.totalViews);
  return authors;
}

function MapCard({
  preset,
  stats,
  onLike,
}: {
  preset: PresetMapRecord;
  stats: { likes: number; views: number; liked: boolean } | undefined;
  onLike: (id: string) => void;
}) {
  return (
    <Link to={`/maps/${preset.slug}`} className={classes.cardLink}>
      <div className={classes.card}>
        <div className={classes.mapPreviewWrap}>
          <Box
            component="img"
            src={presetImageUrl(preset)}
            alt={preset.name}
            className={classes.mapPreview}
          />
        </div>
        <div className={classes.cardContent}>
          <div className={classes.name}>{preset.name}</div>
          <div className={classes.authorTag}>
            <span className={classes.authorDot}>
              {preset.author.charAt(0).toUpperCase()}
            </span>
            {preset.author}
          </div>
          <div className={classes.mapStats}>
            {preset.avgSliceValue != null && (
              <span className={classes.stat}>
                <span className={classes.statValue}>
                  {preset.avgSliceValue}
                </span>
                <span className={classes.statLabel}>Avg</span>
              </span>
            )}
            {preset.totalResources != null && preset.totalInfluence != null && (
              <span className={classes.stat}>
                <span className={classes.statValue}>
                  {preset.totalResources}/{preset.totalInfluence}
                </span>
                <span className={classes.statLabel}>R/I</span>
              </span>
            )}
            <LegendaryDisplay count={preset.legendaries} />
            <TechSkipsDisplay techSkips={preset.techSkips} />
          </div>
          {preset.description && (
            <div className={classes.description}>{preset.description}</div>
          )}
        </div>
        <div className={classes.statsRow}>
          <Group gap="xs" className={classes.statGroup}>
            <IconEye size={14} />
            <Text size="xs">{stats?.views ?? preset.views ?? 0}</Text>
          </Group>
          <Group gap={6} className={classes.statGroup}>
            <ActionIcon
              variant="subtle"
              color={stats?.liked ? "red" : "gray"}
              size="xs"
              className={classes.heartButton}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onLike(preset.id);
              }}
            >
              {stats?.liked ? (
                <IconHeartFilled size={14} />
              ) : (
                <IconHeart size={14} />
              )}
            </ActionIcon>
            <Text size="xs">{stats?.likes ?? preset.likes ?? 0}</Text>
          </Group>
          <Button
            component="a"
            href={appPath(`/map-generator?map=${encodeURIComponent(preset.mapString)}`)}
            variant="subtle"
            color="blue"
            size="compact-xs"
            leftSection={<IconSparkles size={11} />}
            className={classes.genButton}
            onClick={(event) => event.stopPropagation()}
          >
            Generator
          </Button>
        </div>
      </div>
    </Link>
  );
}

export const loader = async () => {
  const presets = await listPresetMaps();
  return { presets };
};

export default function MapPresets() {
  const { presets } = useLoaderData<typeof loader>();
  const [statsById, setStatsById] = useState<
    Record<string, { likes: number; views: number; liked: boolean }>
  >(() =>
    Object.fromEntries(
      presets.map((preset) => [
        preset.id,
        {
          likes: preset.likes ?? 0,
          views: preset.views ?? 0,
          liked: false,
        },
      ]),
    ),
  );

  const totalMaps = presets.length;

  // Flatten author groups into a single ordered list,
  // preserving author-popularity ordering
  const orderedMaps = useMemo(() => {
    const groups = groupByAuthor(presets);
    return groups.flatMap((group) => group.maps);
  }, [presets]);

  const handleLike = async (id: string) => {
    const response = await fetch(appPath(`/api/preset-maps/${id}/like`), {
      method: "POST",
    });
    const result = await response.json().catch(() => null);
    if (!result?.success) return;

    setStatsById((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { likes: 0, views: 0, liked: false }),
        likes: result.likes ?? prev[id]?.likes ?? 0,
        liked: result.liked ?? prev[id]?.liked ?? false,
      },
    }));
  };

  return (
    <MainAppShell>
      <Box className={classes.page}>
        <div className={classes.header}>
          <div className={classes.headerRow}>
            <h1 className={classes.title}>Published Maps</h1>
            <span className={classes.badge}>
              <IconMap size={12} />
              {totalMaps}
            </span>
          </div>
          <p className={classes.subtitle}>
            Browse community-created preset maps. Most popular first.
          </p>
        </div>

        <div className={classes.grid}>
          {orderedMaps.map((preset) => (
            <MapCard
              key={preset.id}
              preset={preset}
              stats={statsById[preset.id]}
              onLike={handleLike}
            />
          ))}
        </div>
      </Box>
    </MainAppShell>
  );
}
