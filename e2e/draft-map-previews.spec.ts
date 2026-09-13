import { expect, test, type Page } from "@playwright/test";

for (const [count, incompatible, compatible] of [
  [4, "4P Small", "Milty 4p"],
  [7, "Milty EQ (7P) Large", "Milty (7P)"],
] as const) {
  test(`Texas rejects ${incompatible} before creation and recovers with a compatible map`, async ({
    page,
  }) => {
    await page.goto(`/ti4/draft/prechoice?format=texas&playerCount=${count}`);
    await expect(
      page.getByRole("radio", { name: String(count), exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("tab", { name: "Texas Style", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.getByRole("radio", { name: incompatible, exact: true }).click();
    const create = page.getByRole("button", {
      name: "Create shared lobby",
      exact: true,
    });
    await expect(create).toBeDisabled();
    await expect(
      page.getByText(/Texas deals five tiles per player/),
    ).toBeVisible();
    await page.getByRole("radio", { name: compatible, exact: true }).click();
    await expect(create).toBeEnabled();
    await create.click();
    await expect(
      page.getByRole("button", { name: "Copy invite link", exact: true }),
    ).toBeVisible();
  });
}

async function preview(page: Page) {
  return page.evaluate(() => {
    const latest = Object.keys(sessionStorage).find(
      (key) => key.startsWith("ti4:draft-preview:") && key.endsWith(":latest"),
    );
    if (!latest) return null;
    const id = sessionStorage.getItem(latest)!;
    return JSON.parse(sessionStorage.getItem(latest.replace(/latest$/, id))!);
  });
}

for (const count of [3, 4, 5, 6, 7, 8]) {
  test(`all ${count}-player slice and map preview edits survive refresh and create a lobby`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const setup = `/ti4/draft/prechoice?format=milty&playerCount=${count}`;
    await page.goto(setup);
    await expect(
      page.getByRole("radio", { name: String(count), exact: true }),
    ).toBeChecked();
    // Discover every layout offered by the UI so new layouts join this suite.
    const layouts = await page
      .getByRole("radio", { name: /Milty|Nucleus|4P Small/ })
      .allTextContents();
    expect(layouts.length).toBeGreaterThan(0);
    for (const layout of layouts)
      await test.step(layout.trim(), async () => {
        await page.goto(setup);
        await expect(
          page.getByRole("radio", { name: String(count), exact: true }),
        ).toBeChecked();
        await page
          .getByRole("radio", { name: layout.trim(), exact: true })
          .click();
        await page
          .getByRole("button", { name: "Preview draft", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Review your draft", exact: true }),
        ).toBeVisible();
        const original = await preview(page);
        expect(original.draft.players).toHaveLength(count);
        await page
          .getByRole("button", { name: "Randomize All", exact: true })
          .click();
        await expect.poll(() => preview(page)).not.toEqual(original);
        const edited = await preview(page);
        expect(edited.draft.slices).toHaveLength(original.draft.slices.length);
        await page.reload();
        await expect(
          page.getByRole("heading", { name: "Review your draft", exact: true }),
        ).toBeVisible();
        expect(await preview(page)).toEqual(edited);
        await page
          .getByRole("button", { name: "Create shared lobby", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: "Copy invite link", exact: true }),
        ).toBeVisible();
      });
  });
}

test("Twilight's Fall pack preview retains edited slices and kings", async ({
  page,
}) => {
  await page.goto("/ti4/draft/prechoice?format=twilight&playerCount=3");
  await page
    .getByRole("button", { name: "Preview draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your draft", exact: true }),
  ).toBeVisible();
  const original = await preview(page);
  await page
    .getByRole("button", { name: "Randomize All", exact: true })
    .click();
  await expect.poll(() => preview(page)).not.toEqual(original);
  await page
    .getByRole("button", { name: "Randomize kings", exact: true })
    .click();
  const edited = await preview(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Review your draft", exact: true }),
  ).toBeVisible();
  expect(await preview(page)).toEqual(edited);
  await page
    .getByRole("button", { name: "Create shared lobby", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copy invite link", exact: true }),
  ).toBeVisible();
});
