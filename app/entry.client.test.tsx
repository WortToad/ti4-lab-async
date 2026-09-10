import { useId, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HydratedRouter } from "react-router/dom";
import { afterEach, expect, test, vi } from "vitest";

const { hydrateRoot } = vi.hoisted(() => ({ hydrateRoot: vi.fn() }));
vi.mock("react-dom/client", () => ({ hydrateRoot }));
vi.mock("posthog-js", () => ({ default: { init: vi.fn() } }));
vi.mock("react-router/dom", () => ({
  HydratedRouter: () => <div id={useId()}>Router content</div>,
}));

afterEach(() => vi.unstubAllGlobals());

test("preserves server useId values when mounting client analytics", async () => {
  vi.stubGlobal("document", {});
  // The query keeps the router's SSR plugin from replacing .client files with
  // an empty module while this test inspects the browser entry.
  const browserEntry = "./entry.client.tsx?hydration-test";
  await import(browserEntry);
  expect(hydrateRoot).toHaveBeenCalledOnce();
  const clientTree = hydrateRoot.mock.calls[0][1] as ReactNode;

  // The server entry renders its router as a single tree. Adding an analytics
  // sibling on the client changes every useId and breaks responsive CSS.
  expect(renderToStaticMarkup(clientTree)).toBe(
    renderToStaticMarkup(<HydratedRouter />),
  );
});
