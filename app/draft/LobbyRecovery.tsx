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
}: {
  defaultOpened?: boolean;
  defaultRecoveryCode?: string;
}) {
  const fetcher = useFetcher<{ error: string }>();
  return (
    <Accordion
      variant="contained"
      className="ph-no-capture"
      defaultValue={defaultOpened ? "rejoin" : undefined}
    >
      <Accordion.Item value="rejoin">
        <Accordion.Control>Rejoin an existing draft</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Already joined a draft? Your saved recovery code takes you
              straight back to your lobby, including on a new device.
            </Text>
            {fetcher.data?.error && (
              <Alert color="red" role="alert">
                {fetcher.data.error}
              </Alert>
            )}
            <fetcher.Form method="post" action="/draft/rejoin">
              <Group align="end">
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
                  style={{ flex: "1 1 240px" }}
                />
                <Button type="submit" loading={fetcher.state !== "idle"}>
                  Rejoin lobby
                </Button>
              </Group>
            </fetcher.Form>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
