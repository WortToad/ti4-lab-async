import { Text } from "@mantine/core";
import { SystemId as SystemIdType } from "~/types";

type Props = {
  id: SystemIdType;
  scale: number;
  radius: number;
  rotation?: number;
  highlight?: boolean;
};

export function SystemId({
  id,
  scale,
  rotation,
  radius,
  highlight = false,
}: Props) {
  const transforms = [];
  if (highlight) transforms.push(`translate(${radius * 0.3}px, 0px)`);
  if (rotation) transforms.push(`rotate(${rotation}deg)`);

  return (
    <Text
      size="xs"
      lh={1.1}
      c="white"
      pos="absolute"
      top={15 * scale}
      fw="bolder"
      style={{ transform: transforms.join(" ") }}
    >
      {id}
    </Text>
  );
}
