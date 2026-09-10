import { Button, Group, List, Modal, Stack, Text } from "@mantine/core";
import { bagCategoryLabel } from "./BagComponents";
import type { BagDraftItem } from "./definitions";
import type { BagVariant } from "./types";

export function BagSelectionConfirmation({
  opened,
  onClose,
  onConfirm,
  items,
  variant,
  assembling = false,
  passingTo,
  busy,
}: {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: BagDraftItem[];
  variant: BagVariant;
  assembling?: boolean;
  passingTo?: string;
  busy: boolean;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={assembling ? "Confirm your final faction" : "Confirm your picks"}
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          {assembling
            ? `Keep these ${items.length} components for your final faction and map.`
            : items.length > 0
              ? `Add ${items.length === 1 ? "this component" : `these ${items.length} components`} to your collection.`
              : "Pass this bag without collecting any components."}
        </Text>
        {items.length > 0 && (
          <List spacing="sm">
            {items.map((item) => (
              <List.Item key={item.id}>
                <Text size="sm" fw={600}>
                  {item.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {bagCategoryLabel(item.category, variant)}
                </Text>
              </List.Item>
            ))}
          </List>
        )}
        <Text size="sm" c="dimmed">
          {assembling
            ? "Your completed faction becomes public once everyone confirms their final choices."
            : `The remaining components will pass${passingTo ? ` to ${passingTo}` : ""} when everyone is ready.`}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Back to selection
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {assembling
              ? "Confirm faction"
              : items.length
                ? "Confirm picks"
                : "Confirm pass"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
