import { Group, Switch } from "@mantine/core";

type Props = {
  accessibleColors: boolean;
  onAccessibleColorsChange: (value: boolean) => void;
};

export function HeaderControls({
  accessibleColors,
  onAccessibleColorsChange,
}: Props) {
  return (
    <Group>
      <Switch
        id="a11y-switch"
        label="A11Y"
        checked={accessibleColors}
        onChange={(e) => onAccessibleColorsChange(e.currentTarget.checked)}
      />
    </Group>
  );
}
