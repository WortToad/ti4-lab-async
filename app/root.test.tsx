import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./root";

const route = vi.hoisted(() => ({ error: undefined as unknown }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useRouteError: () => route.error,
}));

function renderError(error: unknown, basename = "/") {
  route.error = error;
  const router = createMemoryRouter(
    [{ path: "*", element: <ErrorBoundary /> }],
    { basename, initialEntries: [`${basename}missing`] },
  );
  try {
    return renderToStaticMarkup(
      <MantineProvider>
        <RouterProvider router={router} />
      </MantineProvider>,
    );
  } finally {
    router.dispose();
  }
}

describe("page error recovery", () => {
  it("offers recovery and draft setup for missing links without rendering error details", () => {
    const html = renderError({
      status: 404,
      statusText: "Not Found",
      internal: true,
      data: "Internal route details should stay private",
    });
    expect(html).toContain("find that page");
    expect(html).toContain('href="/draft/rejoin"');
    expect(html).toContain('href="/draft/prechoice"');
    expect(html).not.toContain("Internal route details");
    expect(html).not.toContain("Try again");
  });

  it("offers retry after unexpected errors without exposing a stack or internal message", () => {
    const html = renderError(new Error("SQLite failure in /private/server.ts"));
    expect(html).toContain("load this page");
    expect(html).toContain("Try again");
    expect(html).not.toContain("SQLite failure");
    expect(html).not.toContain("/private/server.ts");
  });

  it("offers access recovery and keeps links inside a configured base path", () => {
    const html = renderError(
      {
        status: 403,
        statusText: "Forbidden",
        internal: false,
        data: "private",
      },
      "/ti4/",
    );
    expect(html).toContain("Restore your draft access");
    expect(html).toContain('href="/ti4/draft/rejoin"');
    expect(html).toContain('href="/ti4/draft/prechoice"');
  });
});
