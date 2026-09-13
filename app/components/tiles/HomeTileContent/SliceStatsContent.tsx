import { Group, Stack, Text } from "@mantine/core";
import type { CoreSliceData } from "~/hooks/useCoreSliceValues";
import { SliceValuePopover } from "../../Slice/SliceValuePopover";
import type { SliceStats } from "~/mapgen/utils/sliceScoring";
import { useContext } from "react";
import { MapContext } from "~/contexts/MapContext";

const seatLabel = ["Speaker", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

type Props = {
  seat?: number;
  sliceValue?: number;
  sliceStats: SliceStats;
  coreSliceData?: CoreSliceData;
};

/**
 * Content for home tiles showing slice statistics.
 * Used in map generator to display seat label, slice value, and resource/influence stats.
 */
export function SliceStatsContent({
  seat,
  sliceValue,
  sliceStats,
  coreSliceData,
}: Props) {
  const { radius } = useContext(MapContext);

  // Overview tiles on a phone cannot fit the full stats stack. Zooming in
  // restores the detailed numbers and breakdown control as the tiles grow.
  if (radius < 40) {
    return (
      <Stack align="center" gap={2}>
        {seat !== undefined && (
          <Text size="xs" c="white" lh={1.1} title={seatLabel[seat]}>
            {seat === 0 ? "S" : seatLabel[seat]}
          </Text>
        )}
        {sliceValue !== undefined && (
          <Text size="xs" fw="bold" c="yellow.5" lh={1.1}>
            {sliceValue.toFixed(1)}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack align="center" gap={0}>
      {seat !== undefined && (
        <Text fz={{ base: "xs", xs: "md" }} c="white" lh={1.1}>
          {seatLabel[seat]}
        </Text>
      )}
      {sliceValue !== undefined && (
        <Group gap={4} align="center" wrap="nowrap">
          <Text fz={{ base: "sm", xs: "lg" }} fw="bold" c="yellow.5" lh={1.1}>
            {sliceValue.toFixed(1)}
          </Text>
          {coreSliceData && (
            <SliceValuePopover
              breakdown={coreSliceData.breakdown}
              title="Seat Value"
              variant="light"
            />
          )}
        </Group>
      )}
      <Stack align="center" gap={0}>
        <Text
          fz={{ base: "xs", xs: "sm" }}
          fw="bolder"
          c="white"
          ta="center"
          lh={1.1}
        >
          {Math.round(sliceStats.optimalResources * 10) / 10}/
          {Math.round(sliceStats.optimalInfluence * 10) / 10}
        </Text>
        {sliceStats.techs && (
          <Text
            fz={{ base: "xs", xs: "sm" }}
            fw="bolder"
            c="white"
            ta="center"
            lh={1.1}
          >
            {sliceStats.techs}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
