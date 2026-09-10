import {
  type ActionFunctionArgs,
  type MetaFunction,
  Outlet,
  redirect,
  data,
  Link,
  useActionData,
} from "react-router";
import { MainAppShell } from "~/components/MainAppShell";
import { Alert, Button, Stack, Text } from "@mantine/core";
import { createDraft } from "~/drizzle/draft.server";
import { baseCookie } from "~/drizzle/baseDraftLobby.server";
import { createMultiDraft } from "~/drizzle/multiDraft.server";
import type { DiscordData, Draft, DraftSettings, Player } from "~/types";
import { prepareMultidraft } from "./prepareDraft.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  let prepared: Draft[];
  let playerCount = 6;
  try {
    let settings: DraftSettings;
    let players: Player[];
    let discordData: DiscordData | undefined;
    try {
      settings = JSON.parse(String(formData.get("draftSettings")));
      players = JSON.parse(String(formData.get("players")));
      discordData = formData.get("discordData")
        ? JSON.parse(String(formData.get("discordData")))
        : undefined;
    } catch {
      throw new Error(
        "The draft setup could not be read. Return to setup and try again.",
      );
    }
    if (Array.isArray(players)) playerCount = players.length;
    prepared = prepareMultidraft(
      settings,
      players,
      Number(formData.get("numDrafts")),
      discordData,
    );
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "The lobbies could not be prepared. Check the selected content and settings.",
        playerCount,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Prepare and validate every lobby before creating any persistent drafts.
  const draftUrlNames: string[] = [];
  const headers = new Headers();
  for (const draft of prepared) {
    const { prettyUrl, id, adminUuid } = await createDraft(draft);
    headers.append(
      "Set-Cookie",
      await baseCookie(id, "admin").serialize(adminUuid),
    );
    draftUrlNames.push(prettyUrl);
  }
  const multiDraftUrlName = await createMultiDraft(draftUrlNames);
  return redirect(`/multidraft/${multiDraftUrlName}`, { headers });
}

export default function MultiDraft() {
  const result = useActionData<typeof action>();
  return (
    <MainAppShell>
      {result?.error ? (
        <Stack p="lg" maw={700} mx="auto">
          <Alert color="red" title="Lobbies could not be created">
            {result.error}
          </Alert>
          <Text>
            No lobbies were created. Your setup is still available to adjust.
          </Text>
          <Button
            component={Link}
            to={`/draft/prechoice?playerCount=${Math.min(8, Math.max(3, result.playerCount))}`}
          >
            Return to setup
          </Button>
        </Stack>
      ) : (
        <Outlet />
      )}
    </MainAppShell>
  );
}

export const meta: MetaFunction = () => {
  return [
    { title: "TI4Toad Multidraft" },
    { name: "description", content: "TI4Toad, for drafting and map creation." },
  ];
};
