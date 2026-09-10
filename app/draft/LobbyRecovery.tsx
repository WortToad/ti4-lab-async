import {
  Accordion,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { Form, useNavigation } from "react-router";

export function LobbyRecovery({
  defaultOpened = false,
}: {
  defaultOpened?: boolean;
}) {
  const navigation = useNavigation();
  return (
    <Accordion
      variant="contained"
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
            <Form method="post" action="/draft/rejoin">
              <Group align="end">
                <TextInput
                  label="Recovery code"
                  name="uuid"
                  placeholder="Paste your saved recovery code"
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
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
