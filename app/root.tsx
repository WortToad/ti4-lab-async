import { appPath, appUrl } from "~/utils/appUrl";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./main.css";

import {
  Links,
  Link,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";
import {
  Button,
  ColorSchemeScript,
  Container,
  Group,
  MantineProvider,
  Paper,
  Stack,
  Text,
  Title,
  mantineHtmlProps,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { SocketProvider } from "./socketContext";
import { Notifications } from "@mantine/notifications";
import { MainAppShell } from "./components/MainAppShell";

import { commandTheme } from "./theme";

export const meta = () => [
  { title: "TI4 Draft Command" },
  {
    name: "description",
    content:
      "TI4 Draft Command — Twilight Imperium 4 drafting and map building.",
  },
  { property: "og:title", content: "TI4 Draft Command" },
  {
    property: "og:description",
    content: "Twilight Imperium 4 drafting and map building.",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket>();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(appPath("/sw.js"))
        .then((registration) => {
          console.log(
            "Service Worker registered with scope:",
            registration.scope,
          );
        })
        .catch((error) => {
          console.log("Service Worker registration failed:", error);
        });
    }
  }, []);

  useEffect(() => {
    const socket = io({ path: appPath("/socket.io") });
    setSocket(socket);
    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("confirmation", (data) => {
      console.log(data);
    });
  }, [socket]);

  return (
    <html lang="en" {...mantineHtmlProps} data-mantine-color-scheme="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="application-name" content="TI4 Draft Command" />
        <link
          rel="icon"
          type="image/png"
          sizes="any"
          href={appPath("/brand/ti4-draft-command-gold.png")}
        />
        <link
          rel="apple-touch-icon"
          href={appPath("/brand/ti4-draft-command-gold.png")}
        />
        <link rel="manifest" href={appPath("/site.webmanifest?v=5")} />
        <meta name="theme-color" content="#071321" />
        <meta name="msapplication-TileColor" content="#071321" />
        <meta property="og:site_name" content="TI4 Draft Command" />
        <meta
          property="og:image"
          content={appUrl("/brand/ti4-draft-command-gold.png")}
        />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1920" />
        <meta property="og:image:height" content="1920" />
        <meta
          property="og:image:alt"
          content="TI4 Draft Command pixel-art crest"
        />
        <meta name="twitter:card" content="summary" />
        <meta
          name="twitter:image"
          content={appUrl("/brand/ti4-draft-command-gold.png")}
        />
        <meta
          name="twitter:image:alt"
          content="TI4 Draft Command pixel-art crest"
        />
        <Meta />
        <Links />
        <ColorSchemeScript defaultColorScheme="dark" forceColorScheme="dark" />
      </head>
      <body>
        <MantineProvider
          theme={commandTheme}
          defaultColorScheme="dark"
          forceColorScheme="dark"
        >
          <Notifications />
          <SocketProvider socket={socket}>{children}</SocketProvider>
        </MantineProvider>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const notFound = status === 404;
  const needsAccess = status === 401 || status === 403;

  return (
    <MainAppShell>
      <Container size="sm" py="xl">
        <Paper withBorder p="xl" radius="md">
          <Stack gap="md">
            <Title order={1} size="h2">
              {notFound
                ? "We couldn't find that page"
                : needsAccess
                  ? "Restore your draft access"
                  : "We couldn't load this page"}
            </Title>
            <Text>
              {notFound
                ? "Check that you copied the complete link. To return to a draft you've already joined, use your recovery code."
                : needsAccess
                  ? "Use your recovery code to rejoin this draft, or open its shared lobby link."
                  : "There was a problem loading this page. Check your connection and try again. You can also use your recovery code to return to your draft."}
            </Text>
            <Group>
              {!notFound && !needsAccess && (
                <Button onClick={() => window.location.reload()}>
                  Try again
                </Button>
              )}
              <Button component={Link} to="/draft/rejoin" variant="light">
                Rejoin a draft
              </Button>
              <Button component={Link} to="/draft/prechoice" variant="subtle">
                Start a new draft
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    </MainAppShell>
  );
}
