import { Alert, Button, Container, Stack, Title } from "@mantine/core";
import {
  data,
  Link,
  redirect,
  useActionData,
  type ActionFunctionArgs,
} from "react-router";
import { LobbyRecovery } from "~/draft/LobbyRecovery";
import { bagCookie, findBagLobby } from "~/draft/bag/bagDraft.server";
import {
  findMantisRecovery,
  mantisAdminCookie,
  mantisCookie,
} from "~/drizzle/mantisDraft.server";
import { findRawRecovery, rawCookie } from "~/drizzle/rawDraft.server";
import { validRecoveryToken } from "~/draft/lobby.server";
import { baseCookie, findBaseRecovery } from "~/drizzle/baseDraftLobby.server";

const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
export function headers() {
  return privateHeaders;
}
export function meta() {
  return [
    { title: "Rejoin a lobby · TI4Toad" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const uuid = String(form.get("uuid") ?? "")
    .trim()
    .toLowerCase();
  if (!validRecoveryToken(uuid))
    return data(
      {
        error:
          "Enter your saved recovery code. Ask your lobby admin for a replacement if you have lost it.",
      },
      { status: 400, headers: privateHeaders },
    );
  const bag = findBagLobby(uuid);
  const mantis = !bag ? findMantisRecovery(uuid) : undefined;
  const raw = !bag && !mantis ? findRawRecovery(uuid) : undefined;
  const base = !bag && !mantis && !raw ? findBaseRecovery(uuid) : undefined;
  const found = bag ?? mantis ?? raw ?? base;
  if (!found)
    return data(
      {
        error:
          "This recovery code was not found. Check that you copied the whole code, or ask your lobby admin to recover or replace it.",
      },
      { status: 404, headers: privateHeaders },
    );
  const cookie = bag
    ? bagCookie(bag.id, bag.role)
    : mantis
      ? mantis.role === "admin"
        ? mantisAdminCookie(mantis.id)
        : mantisCookie(mantis.id)
      : raw
        ? rawCookie(raw.id, raw.role)
        : baseCookie(base!.id, base!.role);
  const mode = bag ? "bag" : mantis ? "mantis" : "raw";
  return redirect(base ? `/draft/${base.id}` : `/draft/${mode}/${found.id}`, {
    headers: { ...privateHeaders, "Set-Cookie": await cookie.serialize(uuid) },
  });
}

export default function RejoinLobby() {
  const result = useActionData<typeof action>();
  return (
    <Container size="sm" py="xl">
      <Stack>
        <Title order={1}>Return to your draft</Title>
        {result?.error && (
          <Alert color="red" role="alert">
            {result.error}
          </Alert>
        )}
        <LobbyRecovery defaultOpened />
        <Button component={Link} to="/draft/prechoice" variant="subtle">
          Back to draft setup
        </Button>
      </Stack>
    </Container>
  );
}
