import { Popover, Text, Title, UnstyledButton } from "@mantine/core";
import { ReactNode, useState } from "react";

type Props = {
  children: ReactNode;
  title?: string;
  description?: string;
  disabled?: boolean;
};

export function LegendaryPopover({
  children,
  title,
  description,
  disabled = false,
}: Props) {
  const [opened, setOpened] = useState(false);

  const handleMouseEnter = () => {
    if (!disabled) {
      setOpened(true);
    }
  };

  const handleMouseLeave = () => {
    if (!disabled) {
      setOpened(false);
    }
  };

  if (disabled) return <>{children}</>;

  return (
    <Popover
      opened={disabled ? false : opened}
      onChange={disabled ? undefined : setOpened}
      position="top"
      withArrow
      width={300}
    >
      <Popover.Target>
        <UnstyledButton
          aria-label={title ?? "Legendary planet ability"}
          onClick={() => setOpened(!opened)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            display: "inline-block",
            pointerEvents: disabled ? "none" : "auto",
          }}
        >
          {children}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        {title && (
          <Title order={6} mb={4}>
            {title}
          </Title>
        )}
        {description && <Text size="sm">{description}</Text>}
      </Popover.Dropdown>
    </Popover>
  );
}
