import { Accordion, Box, Group, Paper, ThemeIcon, Title } from "@mantine/core";
import { ReactNode } from "react";

type Props = {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  color?: string;
  badge?: ReactNode;
};

export function ConfigSection({
  title,
  icon,
  children,
  collapsible = false,
  defaultCollapsed = true,
  color = "blue",
  badge,
}: Props) {
  const heading = (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon
        className="command-config-icon"
        size={32}
        variant="light"
        color={color}
      >
        {icon}
      </ThemeIcon>
      <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
      {badge}
    </Group>
  );
  if (collapsible) {
    return (
      <Accordion
        defaultValue={defaultCollapsed ? null : "settings"}
        variant="separated"
        order={3}
        styles={{ label: { fontSize: "var(--command-font-card-title)" } }}
      >
        <Accordion.Item value="settings">
          <Accordion.Control>{heading}</Accordion.Control>
          <Accordion.Panel>{children}</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );
  }
  return (
    <Paper withBorder p="md">
      <Title
        order={3}
        size="h4"
        mb="md"
        pb="sm"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
      >
        {heading}
      </Title>
      <Box>{children}</Box>
    </Paper>
  );
}
