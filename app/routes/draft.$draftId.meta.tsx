import { getBaseLobby } from "~/drizzle/baseDraftLobby.server";
import { appUrl } from "~/utils/appUrl";
import { LoaderFunctionArgs, data } from "react-router";
import { draftByPrettyUrl } from "~/drizzle/draft.server";
import { Draft } from "~/types";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const draftId = params.draftId;
  if (!draftId) {
    throw new Response("Draft ID required", { status: 400 });
  }

  const result = await draftByPrettyUrl(draftId);
  if (!result) {
    throw new Response("Draft not found", { status: 404 });
  }

  const lobby = getBaseLobby(result.id);
  if (lobby && !lobby.started)
    return data(
      {
        title: `${draftId} - TI4 Draft Command lobby`,
        description: "Enter your name to join and wait for the admin to start.",
        url: appUrl(`/draft/${draftId}`),
        type: "website",
        siteName: "TI4 Draft Command",
        image: appUrl("/brand/ti4-draft-command.png"),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  const draft = JSON.parse(result.data as string) as Draft;

  // Format draft type display name
  const draftType = draft.settings?.type || "Unknown";
  const playerCount = draft.players?.length || 0;
  const draftTypeDisplay = formatDraftType(draftType, playerCount);

  return data({
    title: `${draftId} - TI4 Draft Command`,
    description: `${draftTypeDisplay} on TI4 Draft Command`,
    image: appUrl("/brand/ti4-draft-command.png"),
    url: appUrl(`/draft/${draftId}`),
    type: "website",
    siteName: "TI4 Draft Command",
  });
};

function formatDraftType(type: string, playerCount: number): string {
  const typeMap: Record<string, string> = {
    milty: "Milty Draft",
    miltyeq: "Milty Equidistant Draft",
    prechoice: "Pre-Choice Draft",
    raw: "Raw Draft",
  };

  const baseName = typeMap[type.replace(/\d+p$/, "")] || type;
  return `${baseName} (${playerCount} players)`;
}
