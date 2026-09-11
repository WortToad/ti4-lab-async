import { Switch } from "@mantine/core";
type Props = {
  accessibleColors: boolean;
  onAccessibleColorsChange: (value: boolean) => void;
};
export function HeaderControls({
  accessibleColors,
  onAccessibleColorsChange,
}: Props) {
  return (
    <Switch
      label="Distinct map colors"
      description="Use a color-blind friendly map palette"
      checked={accessibleColors}
      onChange={(e) => onAccessibleColorsChange(e.currentTarget.checked)}
    />
  );
}
