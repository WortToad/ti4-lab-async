import { expect, test } from "@playwright/test";

test("map likes recover from network and server errors, prevent duplicate submissions, and survive reload", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const created = await request.post("/ti4/api/preset-maps", {
    data: {
      name: "Visitor recovery galaxy",
      author: "Browser test",
      description: "A saved map for testing likes and recovery.",
      mapConfigId: "milty4p",
      mapString: Array.from({ length: 36 }, (_, index) =>
        index % 9 === 0 ? `H${index / 9}` : String(19 + index),
      ).join(","),
    },
  });
  expect(created.ok()).toBe(true);
  const { id, slug } = await created.json();
  await page.goto(`/ti4/maps/${slug}`);
  const button = page.getByRole("button", { name: "Like map", exact: true });
  const endpoint = `**/api/preset-maps/${id}/like`;
  const failure = page.getByText("Unable to like map", { exact: true });

  for (const kind of ["network", "server", "invalid-response"]) {
    await page.route(endpoint, (route) =>
      kind === "network"
        ? route.abort("failed")
        : route.fulfill({
            status: kind === "server" ? 503 : 200,
            contentType: "text/html",
            body: "Unavailable",
          }),
    );
    await button.click();
    await expect(failure).toBeVisible();
    await expect(button).toBeEnabled();
    await page.unroute(endpoint);
    await page.reload();
  }

  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route(endpoint, async (route) => {
    requests++;
    await pending;
    await route.continue();
  });
  try {
    await button.click();
    await expect.poll(() => requests).toBe(1);
    await expect(button).toBeDisabled();
    // Two extra clicks dispatched while the write is pending cannot resubmit.
    await button.evaluate((element: HTMLButtonElement) => {
      element.click();
      element.click();
    });
    release();
    await expect(
      page.getByRole("button", { name: "Map liked", exact: true }),
    ).toBeDisabled();
    expect(requests).toBe(1);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Map liked", exact: true }),
    ).toBeDisabled();
    const response = await request.post(`/ti4/api/preset-maps/${id}/like`);
    expect(await response.json()).toMatchObject({
      success: true,
      likes: 1,
      liked: true,
    });
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});

test("missing draft and replay links return 404 for slugs and legacy IDs", async ({
  request,
}) => {
  for (const id of ["missing-draft", "00000000-0000-4000-8000-000000000000"]) {
    for (const suffix of ["", "/replay"]) {
      const response = await request.get(`/ti4/draft/${id}${suffix}`);
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain("Cannot read properties");
    }
  }
});
