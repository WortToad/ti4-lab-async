import { ActionIcon, Button, Group, Radio, Stack, Text } from "@mantine/core";
import { IconInfoCircle, IconSettings } from "@tabler/icons-react";
import { MAPS, ChoosableDraftType } from "../maps";
import { SliceSettingsFormatType } from "~/components/SliceSettingsModal";

type Props = {
  playerCount: number;
  selectedMapType: ChoosableDraftType;
  onMapTypeHover: (mapType: ChoosableDraftType | undefined) => void;
  onMapTypeSelect: (mapType: ChoosableDraftType) => void;
  onOpenSettings: (formatType: SliceSettingsFormatType) => void;
  onOpenMinorFactionsInfo: () => void;
};
function settingsFormat(type: string): SliceSettingsFormatType | undefined {
  if (type.startsWith("miltyeq")) return "miltyeq";
  if (type.startsWith("milty")) return "milty";
  if (type.startsWith("heisen")) return "heisen";
}
export function MapStyleSelector({
  playerCount,
  selectedMapType,
  onMapTypeSelect,
  onOpenSettings,
  onOpenMinorFactionsInfo,
}: Props) {
  return (
    <Stack w="100%" gap="md" mt="sm">
      <Radio.Group
        label="Galaxy layout"
        description="Choose a layout to see its map and draft rules."
        value={selectedMapType}
        onChange={(value) => onMapTypeSelect(value as ChoosableDraftType)}
      >
        <Stack gap="xs" mt="md">
          {Object.entries(MAPS)
            .filter(([, map]) => map.playerCount === playerCount)
            .map(([type, map]) => {
              const format = settingsFormat(type);
              return (
                <Group key={type} gap="xs" wrap="nowrap">
                  <Radio.Card
                    value={type}
                    p="sm"
                    radius="sm"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background:
                        selectedMapType === type ? "#e8bc5810" : undefined,
                      borderColor:
                        selectedMapType === type
                          ? "var(--command-accent)"
                          : "var(--mantine-color-default-border)",
                    }}
                  >
                    <Group wrap="nowrap" gap="sm">
                      <Radio.Indicator color="imperial" />
                      <Text fw={600}>{map.title}</Text>
                    </Group>
                  </Radio.Card>
                  {format && (
                    <ActionIcon
                      variant="default"
                      size="lg"
                      aria-label={`Configure ${map.title} slice generation`}
                      onClick={() => {
                        onMapTypeSelect(type as ChoosableDraftType);
                        onOpenSettings(format);
                      }}
                    >
                      <IconSettings size={21} aria-hidden="true" />
                    </ActionIcon>
                  )}
                </Group>
              );
            })}
        </Stack>
      </Radio.Group>
      <Button
        variant="subtle"
        color="blue.3"
        leftSection={<IconInfoCircle size={20} />}
        onClick={onOpenMinorFactionsInfo}
      >
        About minor factions
      </Button>
    </Stack>
  );
}
