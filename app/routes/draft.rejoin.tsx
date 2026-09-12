import {
  Alert,
  Button,
  Container,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconKey, IconShieldLock } from "@tabler/icons-react";
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
    { title: "Rejoin a lobby · TI4 Draft Command" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const submittedCode = String(form.get("uuid") ?? "");
  const uuid = submittedCode.trim().toLowerCase();
  if (!validRecoveryToken(uuid))
    return data(
      {
        uuid: submittedCode.slice(0, 128),
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
        uuid: submittedCode.slice(0, 128),
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
    <Container size="sm" className="command-rejoin-page">
      <Paper withBorder className="command-rejoin-card">
        <Stack gap="lg">
          <ThemeIcon size={52} radius="md" variant="light" color="imperial">
            <IconKey size={28} stroke={1.5} aria-hidden="true" />
          </ThemeIcon>
          <div>
            <Text className="command-eyebrow" mb="sm">
              Your seat is waiting
            </Text>
            <Title order={1} size="h2">
              Return to your draft
            </Title>
          </div>
          {result?.error && (
            <Alert color="red" role="alert">
              {result.error}
            </Alert>
          )}
          <LobbyRecovery standalone defaultRecoveryCode={result?.uuid} />
          <div className="command-recovery-note">
            <IconShieldLock size={20} aria-hidden="true" />
            <Text size="sm" c="dimmed">
              Your code restores your player or admin access. If you’ve lost it,
              ask your lobby admin for help.
            </Text>
          </div>
        </Stack>
      </Paper>
      <Button
        component={Link}
        to="/"
        variant="subtle"
        color="gray"
        mt="lg"
        leftSection={<IconArrowLeft size={18} aria-hidden="true" />}
      >
        Choose a draft format
      </Button>
    </Container>
  );
}
