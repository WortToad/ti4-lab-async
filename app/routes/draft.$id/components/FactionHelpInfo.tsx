import { appPath } from "~/utils/appUrl";
import { Faction } from "~/types";
import { useDisclosure } from "@mantine/hooks";
import { Box, Button, Modal, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconEye, IconLink } from "@tabler/icons-react";
import { useDraft } from "~/draftStore";
import { mahactKingReferences } from "~/data/mahactKingReferences";
import { MahactKingReference } from "./MahactKingReference";

type Props = {
  faction: Faction;
};

export function FactionHelpInfo({ faction }: Props) {
  const [opened, { open, close }] = useDisclosure();
  const showMonumentImagesInFactionInfo = useDraft(
    (state) => state.draft.settings.showMonumentImagesInFactionInfo,
  );
  const showMonumentImage =
    !!showMonumentImagesInFactionInfo && !!faction.monument;
  const kingReference = mahactKingReferences[faction.id];

  return (
    <>
      <Button.Group>
        <Button
          size="xs"
          variant="subtle"
          flex={1}
          style={{ borderRadius: 0 }}
          leftSection={<IconEye size={14} />}
          color="gray"
          onMouseDown={open}
        >
          Info
        </Button>
        <Button
          size="xs"
          variant="subtle"
          flex={1}
          style={{ borderRadius: 0 }}
          leftSection={<IconLink size={14} />}
          color="gray"
          onClick={() => {
            window.open(faction.wiki, "_blank");
          }}
        >
          Wiki
        </Button>
      </Button.Group>
      <Modal
        opened={opened}
        onClose={close}
        size={kingReference ? "xl" : "100%"}
        title={kingReference ? `${faction.name} reference` : faction.name}
        centered
      >
        {kingReference ? (
          <MahactKingReference faction={faction} reference={kingReference} />
        ) : (
          <SimpleGrid
            cols={{ base: 1, md: showMonumentImage ? 2 : 1 }}
            spacing="lg"
          >
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Faction Card
              </Text>
              <Box>
                <img
                  src={appPath(`/factioncards/${faction.id}.png`)}
                  alt={`${faction.name} faction card`}
                  style={{
                    objectFit: "contain",
                    maxHeight: 500,
                    maxWidth: "100%",
                    margin: "auto",
                    display: "block",
                  }}
                />
              </Box>
            </Stack>
            {showMonumentImage && (
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  Monument
                </Text>
                <Box>
                  <img
                    src={faction.monument ? appPath(faction.monument) : undefined}
                    alt={`${faction.name} monument art`}
                    style={{
                      objectFit: "contain",
                      maxHeight: 500,
                      maxWidth: "100%",
                      margin: "auto",
                      display: "block",
                    }}
                  />
                </Box>
              </Stack>
            )}
          </SimpleGrid>
        )}
      </Modal>
    </>
  );
}
