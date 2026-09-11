import { Anchor, Breadcrumbs, Stack, Text, Title } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "react-router";

export function DraftSetupHeading({
  title,
  description,
  players = 6,
  preview = false,
}: {
  title: string;
  description: string;
  players?: number;
  preview?: boolean;
}) {
  return (
    <Stack gap="sm" className="command-setup-header">
      <Breadcrumbs
        separator={<IconChevronRight size={16} aria-hidden="true" />}
        styles={{
          root: { flexWrap: "wrap" },
          breadcrumb: { whiteSpace: "normal" },
        }}
      >
        <Anchor component={Link} to={`/?playerCount=${players}#draft-formats`}>
          Draft formats
        </Anchor>
        <Text c="dimmed">
          {preview ? "Review your draft" : "Configure your draft"}
        </Text>
      </Breadcrumbs>
      <Title order={1}>{title}</Title>
      <Text c="dimmed" maw={760}>
        {description}
      </Text>
      <Text size="sm" c="imperial.3">
        {preview
          ? "Review → Create lobby → Invite players"
          : "Configure → Create lobby → Invite players"}
      </Text>
    </Stack>
  );
}
