import { Button, Group, Paper, Stack, Text, TextInput } from "@mantine/core";
import { Form, useNavigation } from "react-router";

export function LobbyRecovery() {
  const navigation = useNavigation();
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600}>Rejoin a lobby</Text>
        <Text size="sm" c="dimmed">
          Already joined a draft? Your saved player or admin UUID takes you
          straight back to your lobby, including on a new device.
        </Text>
        <Form method="post" action="/draft/rejoin">
          <Group align="end">
            <TextInput
              label="Recovery UUID"
              name="uuid"
              placeholder="Paste your saved UUID"
              autoComplete="off"
              required
              maxLength={64}
              style={{ flex: "1 1 240px" }}
            />
            <Button
              type="submit"
              loading={
                navigation.state === "submitting" &&
                navigation.formAction?.endsWith("/draft/rejoin")
              }
            >
              Rejoin lobby
            </Button>
          </Group>
        </Form>
      </Stack>
    </Paper>
  );
}
