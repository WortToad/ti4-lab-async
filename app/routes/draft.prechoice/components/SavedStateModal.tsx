import { Alert, Button, Modal, Stack, Text, Textarea } from "@mantine/core";

type Props = {
  opened: boolean;
  savedStateJson: string;
  onClose: () => void;
  onSavedStateChange: (value: string) => void;
  onContinue: () => void;
  error?: string | null;
};

export function SavedStateModal({
  opened,
  savedStateJson,
  onClose,
  onSavedStateChange,
  onContinue,
  error,
}: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="Use a draft template">
      <Stack>
        <Text size="sm">
          Reuse an exported map, faction pool and settings to prepare a new
          lobby. Players join again, and drafting starts from the beginning.
        </Text>
        <Text size="sm" c="dimmed">
          To resume an existing lobby, use its link or recovery code. Encrypted
          lobby backups are restored inside that lobby’s admin controls.
        </Text>
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Textarea
          label="Draft template JSON"
          placeholder="Paste an exported draft template"
          autosize
          minRows={15}
          maxRows={30}
          value={savedStateJson}
          onChange={(event) => onSavedStateChange(event.currentTarget.value)}
        />
        <Button onClick={onContinue} disabled={!savedStateJson.trim()}>
          Preview new lobby
        </Button>
      </Stack>
    </Modal>
  );
}
