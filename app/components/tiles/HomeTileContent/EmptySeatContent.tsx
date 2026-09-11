import { Group, Stack, Text } from "@mantine/core";
import { useDraft } from "~/draftStore";
import type { CoreSliceData } from "~/hooks/useCoreSliceValues";
import { SliceValuePopover } from "../../Slice/SliceValuePopover";
import classes from "../Tiles.module.css";

const seatLabel = ["Speaker", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

type Props = {
  seat?: number;
  coreSliceData?: CoreSliceData;
  selectable?: boolean;
};

/**
 * Content for empty home tile seats during draft.
 * The surrounding MapTile supplies the full-size, keyboard-accessible button.
 */
export function EmptySeatContent({ seat, coreSliceData, selectable }: Props) {
  const hydrated = useDraft((state) => state.hydrated);
  const draftSpeaker = useDraft((state) => state.draft.settings.draftSpeaker);

  return (
    <Stack align="center" gap={0}>
      {!draftSpeaker && hydrated && seat !== undefined && (
        <Text size="xl" fw="bold" className={classes.seatLabel} lh={1.1}>
          {seatLabel[seat]}
        </Text>
      )}
      {coreSliceData && (
        <Group gap={4} align="center">
          <Text fz={{ base: "sm", xs: "lg" }} fw="bold" c="yellow.5" lh={1.1}>
            {coreSliceData.value.toFixed(1)}
          </Text>
          <SliceValuePopover
            breakdown={coreSliceData.breakdown}
            title="Seat Value"
            variant="dark"
          />
        </Group>
      )}
      {selectable && (
        <Text span size="xs" fw={700} c="imperial.4" lh={1.4}>
          Choose
        </Text>
      )}
    </Stack>
  );
}
