import { expect, test } from "@playwright/test";

test("pages, assets, redirects and API responses exclude search indexing", async ({
  request,
}) => {
  for (const [path, status] of [
    ["/", 302],
    ["/ti4/", 200],
    ["/ti4/map-generator", 200],
    ["/ti4/draft/prechoice", 200],
    ["/ti4/draft/rejoin", 200],
    ["/ti4/brand/ti4-foundry-gold.png", 200],
    ["/ti4/brand/ti4-draft-command-gold.png", 200],
    ["/ti4/does-not-exist", 404],
  ] as const) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(status);
    expect(response.headers()["x-robots-tag"], path).toContain("noindex");
    expect(response.headers()["x-robots-tag"], path).toContain("nofollow");
    if (
      response.headers()["content-type"]?.includes("text/html") &&
      status !== 302
    ) {
      // Check the server-rendered document without relying on JavaScript.
      expect(await response.text(), path).toMatch(
        /<meta name="robots" content="noindex, nofollow, noimageindex, nosnippet"/,
      );
    }
  }
  const api = await request.post("/ti4/api/preset-maps", { data: {} });
  expect(api.status()).toBe(400);
  expect(await api.json()).toMatchObject({ error: "Missing required fields" });
  expect(api.headers()["x-robots-tag"]).toContain("noindex");
  for (const path of ["/robots.txt", "/ti4/robots.txt"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    // Crawlers must be allowed to fetch the noindex directive.
    expect(await response.text()).toBe("User-agent: *\nDisallow:\n");
  }
});

test("search exclusion survives client navigation and child route metadata", async ({
  page,
}) => {
  await page.goto("/ti4/");
  await page
    .locator("footer")
    .getByRole("link", { name: "Map builder", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ti4\/map-generator$/);
  await expect(
    page.locator('head meta[name="robots"]').first(),
  ).toHaveAttribute("content", /noindex/);
  await page
    .locator("footer")
    .getByRole("link", { name: "Rejoin a draft", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ti4\/draft\/rejoin$/);
  await expect(
    page.locator('head meta[name="robots"]').first(),
  ).toHaveAttribute("content", /noimageindex/);
});
