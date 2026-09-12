import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Button,
  CopyButton,
  Divider,
  Group,
  Text,
} from "@mantine/core";
import { IconCheck, IconCopy, IconExternalLink } from "@tabler/icons-react";

type Props = {
  mapString: string;
  shareUrl: string;
  opened: boolean;
  onClose: () => void;
};

export function ShareMapModal({ mapString, shareUrl, opened, onClose }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      title="Share your galaxy"
    >
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          Send your map to the table, or keep a copy for your next game.
        </Text>
        <Stack gap="sm">
          <TextInput
            label="Shareable link"
            value={shareUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <Group gap="sm">
            <CopyButton value={shareUrl}>
              {({ copied, copy }) => (
                <Button
                  color={copied ? "success.4" : "imperial"}
                  onClick={copy}
                  leftSection={
                    copied ? <IconCheck size={20} /> : <IconCopy size={20} />
                  }
                >
                  {copied ? "Link copied" : "Copy link"}
                </Button>
              )}
            </CopyButton>
            <Button
              component="a"
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              color="blue.3"
              rightSection={<IconExternalLink size={18} aria-hidden="true" />}
            >
              Open in new tab
            </Button>
          </Group>
        </Stack>
        <Divider />
        <Stack gap="sm">
          <Textarea
            label="Map string"
            description="A copy of this map’s system layout."
            value={mapString}
            readOnly
            autosize
            minRows={2}
            maxRows={5}
            onFocus={(event) => event.currentTarget.select()}
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
          />
          <CopyButton value={mapString}>
            {({ copied, copy }) => (
              <Button
                variant="light"
                color={copied ? "success.4" : "blue.3"}
                onClick={copy}
                leftSection={
                  copied ? <IconCheck size={20} /> : <IconCopy size={20} />
                }
              >
                {copied ? "Map string copied" : "Copy map string"}
              </Button>
            )}
          </CopyButton>
        </Stack>
      </Stack>
    </Modal>
  );
}
