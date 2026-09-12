import type { ActionFunctionArgs } from "react-router";

export function formRequest(
  path: string,
  fields: Record<string, string>,
  cookie = "",
  params: Record<string, string> = {},
): ActionFunctionArgs {
  return {
    request: new Request(`http://localhost${path}`, {
      method: "POST",
      body: new URLSearchParams(fields),
      headers: { Cookie: cookie },
    }),
    params,
    context: {},
    unstable_pattern: path,
  };
}

export function jsonRequest(
  path: string,
  body: unknown,
  cookie = "",
  params: Record<string, string> = {},
): ActionFunctionArgs {
  return {
    ...formRequest(path, {}, cookie, params),
    request: new Request(`http://localhost${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", Cookie: cookie },
    }),
  };
}

export function cookieHeader(headers?: HeadersInit) {
  return new Headers(headers)
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
