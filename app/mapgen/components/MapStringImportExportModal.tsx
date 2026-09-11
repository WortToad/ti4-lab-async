import {
  Box,
  Button,
  CopyButton,
  Divider,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from "@mantine/core";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileExport,
  IconUpload,
} from "@tabler/icons-react";
import { useState } from "react";
import type { ExternalMapStringFormat } from "../utils/externalMapStringCodec";

type Props = {
  exportStrings: Record<ExternalMapStringFormat, string>;
  opened: boolean;
  onClose: () => void;
  onImport: (mapString: string, format: ExternalMapStringFormat) => boolean;
};

const FORMAT_OPTIONS = [
  { label: "TTPG", value: "ttpg" },
  { label: "Async", value: "async" },
];

export function MapStringImportExportModal({
  exportStrings,
  opened,
  onClose,
  onImport,
}: Props) {
  const [exportFormat, setExportFormat] =
    useState<ExternalMapStringFormat>("ttpg");
  const [importFormat, setImportFormat] =
    useState<ExternalMapStringFormat>("ttpg");
  const [importString, setImportString] = useState("");

  const exportString = exportStrings[exportFormat];

  const resetAndClose = () => {
    setExportFormat("ttpg");
    setImportFormat("ttpg");
    setImportString("");
    onClose();
  };

  const handleImport = () => {
    if (onImport(importString, importFormat)) resetAndClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={resetAndClose}
      size="lg"
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="violet" size="sm">
            <IconFileExport size={14} />
          </ThemeIcon>
          <Text fw={600} size="sm">
            Map String Import / Export
          </Text>
        </Group>
      }
    >
      <Stack gap="xl">
        <Box>
          <Group justify="space-between" align="end" mb="sm">
            <Group gap="xs">
              <ThemeIcon variant="subtle" color="teal" size="xs">
                <IconUpload size={12} />
              </ThemeIcon>
              <Text size="xs" fw={600} tt="uppercase" c="teal.4">
                Export for
              </Text>
            </Group>
            <SegmentedControl
              size="xs"
              data={FORMAT_OPTIONS}
              value={exportFormat}
              onChange={(value) =>
                setExportFormat(value as ExternalMapStringFormat)
              }
            />
          </Group>

          <Box p="sm" bg="dark.7" style={{ borderRadius: 6 }}>
            <Textarea
              value={exportString || "No map data to export"}
              readOnly
              variant="unstyled"
              autosize
              minRows={2}
              maxRows={5}
              styles={{ input: { fontFamily: "monospace", fontSize: "var(--command-font-control)" } }}
            />
            <Group justify="flex-end" mt="xs">
              <CopyButton value={exportString}>
                {({ copied, copy }) => (
                  <Button
                    size="xs"
                    variant={copied ? "light" : "subtle"}
                    color={copied ? "teal" : "gray"}
                    onClick={copy}
                    disabled={!exportString}
                    leftSection={
                      copied ? <IconCheck size={14} /> : <IconCopy size={14} />
                    }
                  >
                    {copied ? "Copied" : `Copy ${exportFormat === "ttpg" ? "TTPG" : "Async"} String`}
                  </Button>
                )}
              </CopyButton>
            </Group>
          </Box>
        </Box>

        <Divider />

        <Box>
          <Group justify="space-between" align="end" mb="sm">
            <Group gap="xs">
              <ThemeIcon variant="subtle" color="blue" size="xs">
                <IconDownload size={12} />
              </ThemeIcon>
              <Text size="xs" fw={600} tt="uppercase" c="blue.4">
                Import from
              </Text>
            </Group>
            <SegmentedControl
              size="xs"
              data={FORMAT_OPTIONS}
              value={importFormat}
              onChange={(value) =>
                setImportFormat(value as ExternalMapStringFormat)
              }
            />
          </Group>

          <Textarea
            placeholder={
              importFormat === "ttpg"
                ? "Paste a TTPG map string…"
                : "Paste an Async map string…"
            }
            value={importString}
            onChange={(event) => setImportString(event.currentTarget.value)}
            minRows={3}
            autosize
            maxRows={6}
            styles={{ input: { fontFamily: "monospace", fontSize: "var(--command-font-control)" } }}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={handleImport}
              disabled={!importString.trim()}
            >
              Import {importFormat === "ttpg" ? "TTPG" : "Async"} Map
            </Button>
          </Group>
        </Box>
      </Stack>
    </Modal>
  );
}
