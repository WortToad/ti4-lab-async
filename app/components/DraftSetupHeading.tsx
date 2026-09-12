import { Anchor, Breadcrumbs, Stack, Text, Title } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "react-router";
import classes from "./DraftSetupHeading.module.css";

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
      <ol className={classes.steps} aria-label="Draft setup progress">
        {[
          preview ? "Review draft" : "Configure",
          "Create lobby",
          "Invite players",
        ].map((step, index) => (
          <li key={step} aria-current={index === 0 ? "step" : undefined}>
            <span className={classes.number} aria-hidden="true">
              {index + 1}
            </span>
            <span>{step}</span>
            {index < 2 && (
              <IconChevronRight
                className={classes.separator}
                size={16}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>
    </Stack>
  );
}
