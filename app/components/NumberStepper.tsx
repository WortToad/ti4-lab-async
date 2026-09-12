import { ActionIcon, Group, Text } from "@mantine/core";
import { IconMinus, IconPlus } from "@tabler/icons-react";

type Props = {
  label?: string;
  value?: number;
  decrease: (e: React.MouseEvent<HTMLButtonElement>) => void;
  increase: (e: React.MouseEvent<HTMLButtonElement>) => void;
  decreaseDisabled: boolean;
  increaseDisabled: boolean;
};

export function NumberStepper({
  label = "count",
  value,
  decrease,
  increase,
  decreaseDisabled,
  increaseDisabled,
}: Props) {
  return (
    <Group gap={4} wrap="nowrap">
      <ActionIcon
        size="sm"
        variant="subtle"
        color="gray"
        disabled={decreaseDisabled}
        aria-label={`Decrease ${label}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          decrease(event);
        }}
      >
        <IconMinus size={14} />
      </ActionIcon>
      {value !== undefined && (
        <Text
          size="sm"
          fw={600}
          miw={20}
          ta="center"
          c="imperial.3"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </Text>
      )}
      <ActionIcon
        size="sm"
        variant="subtle"
        color="gray"
        disabled={increaseDisabled}
        aria-label={`Increase ${label}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          increase(event);
        }}
      >
        <IconPlus size={14} />
      </ActionIcon>
    </Group>
  );
}
