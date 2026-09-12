import { Paper, Stack, Text, Box, UnstyledButton } from "@mantine/core";
import { ReactNode } from "react";

import classes from "./HoverRadioCard.module.css";

type Props = {
  title: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
  children?: ReactNode;
  icon?: ReactNode;
  /** Compact mode with smaller padding and font sizes */
  compact?: boolean;
};

export function HoverRadioCard({
  title,
  description,
  checked,
  onSelect,
  children,
  icon,
  compact = false,
}: Props) {
  return (
    <Paper
      shadow="sm"
      p={compact ? "xs" : "md"}
      withBorder
      className={`${classes.hoverCard} ${checked ? classes.activeCard : ""}`}
    >
      <UnstyledButton
        onClick={onSelect}
        aria-pressed={checked}
        className={classes.selectButton}
      >
        <Stack align="center" gap={compact ? 4 : "xs"}>
          {icon}
          {!icon && (
            <Box
              aria-hidden
              w={compact ? 16 : 20}
              h={compact ? 16 : 20}
              style={{
                borderRadius: "50%",
                border: "2px solid var(--command-accent)",
                background: checked ? "var(--command-accent)" : undefined,
                boxShadow: checked
                  ? "inset 0 0 0 3px var(--command-surface)"
                  : undefined,
              }}
            />
          )}
          <Text fw={600} ta="center" size={compact ? "xs" : "sm"}>
            {title}
          </Text>
        </Stack>
        <Text
          size="xs"
          className={classes.cardDescription}
          mt={compact ? 4 : "xs"}
          lh={1.5}
        >
          {description}
        </Text>
      </UnstyledButton>
      {children && (
        <Box mt="auto" pt={compact ? "xs" : "sm"}>
          {children}
        </Box>
      )}
    </Paper>
  );
}
