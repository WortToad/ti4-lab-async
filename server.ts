import express from "express";
import { createRequestHandler } from "@react-router/express";
import { createServer } from "http";
import type { ServerBuild } from "react-router";
import { Server } from "socket.io";
import "dotenv/config";
import { appPath, normalizeBasePath } from "~/utils/appUrl.js";
import { initEnv } from "~/env.server.js";
import {
  metricsMiddleware,
  observeSocketConnection,
  observeSocketDisconnection,
  register,
  startEventLoopLagMonitor,
} from "~/observability/metrics.server.js";
import {
  setSocketIO,
  registerDraftSyncHandlers,
} from "~/websocket/broadcast.server.js";

initEnv();
startEventLoopLagMonitor();

const app = express();
const basePath = normalizeBasePath(process.env.TI4_BASE_PATH);
const httpServer = createServer(app);

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? null
    : await import("vite").then((vite) =>
        vite.createServer({
          server: {
            middlewareMode: true,
            // Keep live updates on this app's server. Vite's shared default
            // port can connect previews to another instance and cause reloads.
            hmr: { server: httpServer },
          },
        }),
      );

// Health check endpoint - must be before other middleware
app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use(metricsMiddleware);

if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  app.use(
    appPath("/assets"),
    express.static("build/client/assets", {
      immutable: true,
      maxAge: "1y",
    }),
  );
  app.use(
    basePath || "/",
    express.static("build/client", {
      maxAge: "1h",
      setHeaders(res, filePath) {
        if (filePath.endsWith("/sw.js") || filePath.endsWith(".webmanifest")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );
}

const build: ServerBuild | (() => Promise<ServerBuild>) = viteDevServer
  ? async () =>
      (await viteDevServer.ssrLoadModule(
        "virtual:react-router/server-build",
      )) as ServerBuild
  : ((await import("./build/server/index.js")) as unknown as ServerBuild);

if (
  typeof build !== "function" &&
  (build.basename || "/") !== (basePath || "/")
) {
  throw new Error(
    "TI4_BASE_PATH changed since the build. Rebuild with the same value used at runtime.",
  );
}

if (basePath) {
  app.get("/", (req, res) =>
    res.redirect(302, `${basePath}/${req.url.slice(1)}`),
  );
}

app.all("/{*splat}", createRequestHandler({ build }));

// Connect socket.io
// Attach the socket.io server to the HTTP server
const io = new Server(httpServer, {
  path: appPath("/socket.io"),
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

// Make socket.io instance available for server-side broadcasts
setSocketIO(io);

io.on("connection", (socket) => {
  observeSocketConnection();
  socket.emit("confirmation", "connected!");
  socket.on("disconnect", () => {
    observeSocketDisconnection();
  });

  registerDraftSyncHandlers(socket);

});

const port = Number(process.env.PORT || 3000);
httpServer.listen(port, "0.0.0.0", () => {
  console.log(
    `Express server listening on port ${port}, app path ${basePath || "/"}`,
  );
});

if (process.env.DISCORD_DISABLED !== "true") {
  const { startDiscordBot } = await import("~/discord/bot.server.js");
  startDiscordBot();
}

// Graceful shutdown handling
let isShuttingDown = false;

const shutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received, shutting down gracefully...`);

  io.disconnectSockets(true);
  httpServer.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
