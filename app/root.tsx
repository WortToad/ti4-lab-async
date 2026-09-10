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
  createTheme,
  mantineHtmlProps,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { SocketProvider } from "./socketContext";
import { Notifications } from "@mantine/notifications";
import { MainAppShell } from "./components/MainAppShell";

const mantineTheme = createTheme({
  colors: {
    // override dark colors here to change them for all components
    dark: [
      "#d5d7e0",
      "#acaebf",
      "#8c8fa3",
      "#666980",
      "#4d4f66",
      "#34354a",
      "#2b2c3d",
      "#1d1e30",
      "#0c0d21",
      "#01010a",
    ],
    // used by dark theme
    palePurple: [
      "#f3f2f7",
      "#e2e2e8",
      "#c3c2d2",
      "#a2a0bc",
      "#8583aa",
      "#73719e",
      "#6a679a",
      "#595787",
      "#4f4c79",
      "#44426c",
    ],
    purple: [
      "#f3edff",
      "#e0d7fa",
      "#beabf0",
      "#9a7ce6",
      "#7c56de",
      "#683dd9",
      "#5f2fd8",
      "#4f23c0",
      "#451eac",
      "#3a1899",
    ],
    spaceBlue: [
      "#eef3ff",
      "#dee4f3",
      "#bcc6df",
      "#98a7cc",
      "#798cbb",
      "#657cb2",
      "#5a73ae",
      "#4a6299",
      "#40578a",
      "#324b7c",
    ],
    discordBlue: [
      "#ecf1ff",
      "#d7e0fa",
      "#afbded",
      "#8499e0",
      "#5f79d5",
      "#4866cf",
      "#3b5ccd",
      "#2c4cb6",
      "#2444a4",
      "#173992",
    ],
    magenta: [
      "#ffe9f6",
      "#ffd1e6",
      "#faa1c9",
      "#f66eab",
      "#f24391",
      "#f02881",
      "#f01879",
      "#d60867",
      "#c0005c",
      "#a9004f",
    ],
  },
  breakpoints: {
    xs: "36em",
    sm: "48em",
    md: "62em",
    lg: "75em",
    xl: "88em",
    xxl: "120em",
  },
  primaryColor: "purple",
  fontFamily: '"Quantico", sans-serif',
  headings: {
    fontFamily: "Orbitron",
  },
  components: {
    Button: Button.extend({
      defaultProps: {
        variant: "gradient",
        gradient: { from: "purple", to: "indigo.9", deg: 90 },
      },
    }),
  },
});

export const meta = () => [
  { title: "TI4Toad" },
  {
    name: "description",
    content: "TI4Toad — Twilight Imperium 4 drafting and map building.",
  },
  { property: "og:title", content: "TI4Toad" },
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
        <meta name="application-name" content="TI4Toad" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href={appPath("/apple-touch-icon.png?v=3")}
        />
        <link
          rel="icon"
          type="image/x-icon"
          href={appPath("/favicon.ico?v=3")}
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={appPath("/favicon-32x32.png?v=3")}
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href={appPath("/favicon-16x16.png?v=3")}
        />
        <link rel="manifest" href={appPath("/site.webmanifest?v=3")} />
        <meta name="theme-color" content="#1d1e30" />
        <meta name="msapplication-TileColor" content="#1d1e30" />
        <meta
          name="msapplication-TileImage"
          content={appPath("/mstile-150x150.png?v=3")}
        />
        <meta
          name="msapplication-config"
          content={appPath("/browserconfig.xml?v=3")}
        />
        <meta property="og:site_name" content="TI4Toad" />
        <meta property="og:image" content={appUrl("/ti4toad.png?v=3")} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1241" />
        <meta property="og:image:height" content="1241" />
        <meta property="og:image:alt" content="TI4Toad logo" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:image" content={appUrl("/ti4toad.png?v=3")} />
        <meta name="twitter:image:alt" content="TI4Toad logo" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400..900&family=Quantico:ital,wght@0,400;0,700;1,400;1,700&display=swap&display=swap"
          rel="stylesheet"
        />
        <Meta />
        <Links />
        <ColorSchemeScript defaultColorScheme="dark" forceColorScheme="dark" />
      </head>
      <body>
        <MantineProvider
          theme={mantineTheme}
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
