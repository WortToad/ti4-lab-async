import {
  Accordion,
  Alert,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useFetcher } from "react-router";

export function LobbyRecovery({
  defaultOpened = false,
  defaultRecoveryCode = "",
  standalone = false,
}: {
  defaultOpened?: boolean;
  defaultRecoveryCode?: string;
  standalone?: boolean;
}) {
  const fetcher = useFetcher<{ error: string }>();
  const content = (
    <Stack gap="md" className="ph-no-capture">
      <Text size="sm" c="dimmed">
        Already joined a draft? Your saved recovery code takes you straight back
        to your lobby, including on a new device.
      </Text>
      {fetcher.data?.error && (
        <Alert color="red" role="alert">
          {fetcher.data.error}
        </Alert>
      )}
      <fetcher.Form method="post" action="/draft/rejoin">
        <Group
          align="end"
          className={standalone ? "command-recovery-form" : undefined}
        >
          <TextInput
            label="Recovery code"
            name="uuid"
            defaultValue={defaultRecoveryCode}
            placeholder="Paste your saved recovery code"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={128}
            error={fetcher.data?.error ? true : undefined}
            style={{ flex: standalone ? "auto" : "1 1 240px", minWidth: 0 }}
          />
          <Button type="submit" loading={fetcher.state !== "idle"}>
            Rejoin lobby
          </Button>
        </Group>
      </fetcher.Form>
    </Stack>
  );
  if (standalone) return content;
  return (
    <Accordion
      variant="contained"
      className="ph-no-capture"
      defaultValue={defaultOpened ? "rejoin" : undefined}
    >
      <Accordion.Item value="rejoin">
        <Accordion.Control>Rejoin an existing draft</Accordion.Control>
        <Accordion.Panel>{content}</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
