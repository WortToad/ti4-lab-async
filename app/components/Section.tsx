import { Group, Stack, Title, type TitleOrder } from "@mantine/core";
import { ReactNode } from "react";
import classes from "./Section.module.css";

export function Section({ children }: { children: ReactNode }) {
  return (
    <Stack flex={0} gap="md">
      {children}
    </Stack>
  );
}
export function SectionTitle({
  title,
  children,
  order = 2,
}: {
  title: string;
  children?: ReactNode;
  order?: TitleOrder;
}) {
  return (
    <Group className={classes.section} justify="space-between">
      <Title order={order} size={order === 1 ? "h1" : "h3"}>
        {title}
      </Title>
      {children}
    </Group>
  );
}
