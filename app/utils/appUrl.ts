/** Shared by Vite, React Router, the Node server, and browser URL helpers. */
export function normalizeBasePath(value = ""): string {
  const path = value.replace(/\/+$/, "");
  if (path && !/^\/(?:[A-Za-z0-9_-]+\/?)+$/.test(path)) {
    throw new Error("TI4_BASE_PATH must be empty or a path such as /ti4");
  }
  return path;
}

function basePath(): string {
  // Vite replaces BASE_URL in both browser and SSR builds. Plain Node (the
  // custom server and maintenance scripts) uses the deployment variable.
  return normalizeBasePath(
    import.meta.env?.BASE_URL ??
      (typeof process !== "undefined" ? process.env.TI4_BASE_PATH : ""),
  );
}

/** For fetch, assets, cookies, and ordinary anchors. Router Links/Forms already
 * apply the basename, so their `to`/`action` props should stay unprefixed. */
export function appPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const base = basePath();
  if (
    base &&
    (path === base ||
      path.startsWith(`${base}/`) ||
      path.startsWith(`${base}?`) ||
      path.startsWith(`${base}#`))
  )
    return path;
  return `${base}${path}`;
}

/** Canonical public URL for sharing, metadata, and image captions. */
export function appUrl(path: string): string {
  const configured =
    import.meta.env?.VITE_PUBLIC_ORIGIN ??
    (typeof process !== "undefined"
      ? process.env.VITE_PUBLIC_ORIGIN
      : undefined);
  const origin =
    configured ||
    (typeof window !== "undefined"
      ? window.location.origin
      : `http://localhost:${typeof process !== "undefined" ? process.env.PORT || 3000 : 3000}`);
  return new URL(appPath(path), origin).href;
}
