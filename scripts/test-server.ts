import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createServer as createHttpsServer } from "node:https";
import { request as proxyRequest } from "node:http";
import { once } from "node:events";

// Isolate both the database and compiled assets from any running preview.
// Keep bundles under the project so their external imports resolve node_modules.
const cache = resolve(".cache");
mkdirSync(cache, { recursive: true });
const directory = mkdtempSync(join(cache, "browser-tests-"));
Object.assign(process.env, {
  NODE_ENV: "production",
  PORT: "0",
  TI4_LAB_DATABASE_PATH: pathToFileURL(join(directory, "drafts.sqlite")).href,
  TI4_BUILD_DIRECTORY: join(directory, "build"),
  TI4_BASE_PATH: "/ti4",
  DISCORD_DISABLED: "true",
  R2_INTEGRATION_DISABLED: "true",
  VITE_POSTHOG_KEY: "",
  VITE_PUBLIC_ORIGIN: `https://127.0.0.1:${process.env.TI4_E2E_PORT ?? "3187"}`,
});
process.once("exit", () => rmSync(directory, { recursive: true, force: true }));
process.once("SIGTERM", () => process.exit(0));
process.once("SIGINT", () => process.exit(0));
// Exercise the deployed bundle and keep editor changes from reloading test pages.
const build = spawnSync(
  process.execPath,
  ["node_modules/@react-router/dev/bin.cjs", "build"],
  { stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);
const { httpServer } = await import("../server");
if (!httpServer.listening) await once(httpServer, "listening");
const address = httpServer.address();
if (!address || typeof address === "string")
  throw new Error("Missing test server port");

// Exercise production Secure cookies in every engine. WebKit correctly rejects
// them over HTTP, even when that HTTP connection uses the loopback address.
const key = join(directory, "localhost.key");
const cert = join(directory, "localhost.crt");
const certificate = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=IP:127.0.0.1,DNS:localhost",
    "-keyout",
    key,
    "-out",
    cert,
  ],
  { stdio: "pipe" },
);
if (certificate.status !== 0)
  throw new Error("Could not generate the browser test HTTPS certificate");
const tls = createHttpsServer({
  key: readFileSync(key),
  cert: readFileSync(cert),
});
const forwardedHeaders = (
  headers: import("node:http").IncomingHttpHeaders,
) => ({
  ...headers,
  "x-forwarded-proto": "https",
});
tls.on("request", (request, response) => {
  const upstream = proxyRequest(
    {
      hostname: "127.0.0.1",
      port: address.port,
      method: request.method,
      path: request.url,
      headers: forwardedHeaders(request.headers),
    },
    (result) => {
      response.writeHead(result.statusCode ?? 502, result.headers);
      result.pipe(response);
    },
  );
  upstream.on("error", () => {
    response.writeHead(502);
    response.end();
  });
  request.pipe(upstream);
});
tls.on("upgrade", (request, socket, head) => {
  const upstream = proxyRequest({
    hostname: "127.0.0.1",
    port: address.port,
    path: request.url,
    headers: forwardedHeaders(request.headers),
  });
  upstream.on("upgrade", (response, connection, upstreamHead) => {
    socket.write(
      `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`,
    );
    for (let index = 0; index < response.rawHeaders.length; index += 2)
      socket.write(
        `${response.rawHeaders[index]}: ${response.rawHeaders[index + 1]}\r\n`,
      );
    socket.write("\r\n");
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) connection.write(head);
    socket.on("error", () => connection.destroy());
    connection.on("error", () => socket.destroy());
    socket.pipe(connection).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  upstream.end();
});
tls.listen(Number(process.env.TI4_E2E_PORT ?? "3187"), "127.0.0.1");
