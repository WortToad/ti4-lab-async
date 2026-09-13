import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectMapFits(page: Page, map: Locator) {
  await expect
    .poll(() =>
      map.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          element.scrollWidth <= element.clientWidth + 1 &&
          element.scrollHeight <= element.clientHeight + 1 &&
          Array.from(element.querySelectorAll(".map-tile-button")).every(
            (tile) => {
              const rect = tile.getBoundingClientRect();
              return (
                rect.width > 0 &&
                rect.left >= bounds.left - 1 &&
                rect.right <= bounds.right + 1 &&
                rect.top >= bounds.top - 1 &&
                rect.bottom <= bounds.bottom + 1
              );
            },
          )
        );
      }),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("the full galaxy fits phones, tablets and landscape at every supported ring count", async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const rings of [2, 3, 4, 5]) {
    // Native shared links also need to fit, including five-ring outer tiles.
    const mapString = Array(3 * rings * (rings + 1))
      .fill("_")
      .join(",");
    await page.goto(`/ti4/map-generator?map=${encodeURIComponent(mapString)}`);
    const map = page.getByRole("region", { name: "Galaxy map", exact: true });
    await expect(map.locator(".map-tile-button")).toHaveCount(
      1 + 3 * rings * (rings + 1),
    );
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 844, height: 390 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expectMapFits(page, map);
    }
  }
});

test("phone map zoom, touch editing and tools remain usable", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Exercises real touch input in the mobile project.");
  await page.goto("/ti4/map-generator");
  const map = page.getByRole("region", { name: "Galaxy map", exact: true });
  const tools = page.getByRole("button", {
    name: "Map settings and tools",
    exact: true,
  });
  await expect(tools).toHaveAttribute("aria-expanded", "false");
  await expectMapFits(page, map);
  // The map is available on the first screen, without scrolling through settings.
  expect((await map.boundingBox())!.y).toBeLessThan(600);
  await page.getByRole("button", { name: "Zoom in on map", exact: true }).tap();
  await expect
    .poll(() =>
      map.evaluate((element) => element.scrollWidth > element.clientWidth),
    )
    .toBe(true);
  await expect
    .poll(() => map.evaluate((element) => element.scrollLeft > 0))
    .toBe(true);
  await map.scrollIntoViewIfNeeded();
  const bounds = (await map.boundingBox())!;
  const x = Math.round(bounds.x + bounds.width / 2);
  const y = Math.round(bounds.y + bounds.height / 2);
  const scrollBefore = await map.evaluate((element) => element.scrollLeft);
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let distance = 10; distance <= 100; distance += 10) {
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - distance, y }],
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.detach();
  await expect
    .poll(() => map.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(scrollBefore);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await map
    .getByRole("button", { name: "Add system at position 1", exact: true })
    .tap();
  const picker = page.getByRole("dialog", {
    name: "System Database",
    exact: true,
  });
  await picker
    .getByRole("textbox", {
      name: "Search systems by ID or planet name",
      exact: true,
    })
    .fill("Wellon");
  await picker.getByRole("button", { name: /Wellon/ }).tap();
  await expect(
    map.getByRole("button", {
      name: "Replace system 19 at position 1",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fit map", exact: true }).tap();
  await expectMapFits(page, map);
  await tools.tap();
  await expect(tools).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("textbox", { name: "Galaxy layout", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add outer ring", exact: true }).tap();
  await expect(map.locator(".map-tile-button")).toHaveCount(61);
  await tools.tap();
  await expectMapFits(page, map);
  await page.getByRole("button", { name: "Undo map edit", exact: true }).tap();
  await expect(map.locator(".map-tile-button")).toHaveCount(37);
});

test("generated maps keep seat summaries inside the map in both artwork modes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ti4/map-generator");
  await page.getByRole("button", { name: "Generate map", exact: true }).click();
  const map = page.getByRole("region", { name: "Galaxy map", exact: true });
  for (const artwork of ["Originals", "Simplified"]) {
    const tools = page.getByRole("button", {
      name: "Map settings and tools",
      exact: true,
    });
    await tools.click();
    await page.getByText(artwork, { exact: true }).click();
    await tools.click();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expectMapFits(page, map);
    }
  }
  await page
    .getByRole("button", { name: "Zoom in on map", exact: true })
    .click();
  await expect(
    map
      .getByRole("button", { name: "Explain seat value", exact: true })
      .first(),
  ).toBeVisible();
});
