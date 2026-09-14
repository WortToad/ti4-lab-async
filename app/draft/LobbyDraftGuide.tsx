import { Accordion, Title } from "@mantine/core";
import type { ReactNode } from "react";

export function LobbyDraftGuide({
  children,
  initiallyExpanded = false,
  order = 2,
}: {
  children: ReactNode;
  initiallyExpanded?: boolean;
  order?: 2 | 3;
}) {
  return (
    <Accordion
      variant="contained"
      radius="md"
      order={order}
      defaultValue={initiallyExpanded ? "guide" : undefined}
    >
      <Accordion.Item value="guide">
        <Accordion.Control>
          <Title component="span" order={order} size="h4">
            How this draft works
          </Title>
        </Accordion.Control>
        <Accordion.Panel>{children}</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
