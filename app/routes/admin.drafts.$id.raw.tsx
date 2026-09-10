import {
  getBaseLobby,
  projectBaseDraft,
} from "~/drizzle/baseDraftLobby.server";
import { type LoaderFunctionArgs } from "react-router";
import { draftByPrettyUrl } from "~/drizzle/draft.server";

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.id) {
    throw new Response("Draft ID is required", { status: 400 });
  }

  const draft = await draftByPrettyUrl(params.id);
  if (!draft) {
    throw new Response("Not Found", { status: 404 });
  }

  const lobby = getBaseLobby(draft.id);
  if (lobby && !lobby.started)
    throw new Response("The admin has not started this lobby.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  // This endpoint contains public draft information only. Private recovery saves
  // are exported through the lobby's authenticated admin controls.
  return new Response(
    JSON.stringify(projectBaseDraft(JSON.parse(draft.data as string))),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline",
      },
    },
  );
}
