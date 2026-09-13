import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { mapConfigs } from "../app/mapgen/mapConfigs";

const prefix = "/ti4";
async function savedMap(page: Page) {
  return page.evaluate(() => {
    const saved = sessionStorage.getItem("ti4:map-editor:v1");
    return saved ? (JSON.parse(saved).mapString as string) : null;
  });
}
async function menuItem(page: Page, menu: string, item: string) {
  await page.getByRole("button", { name: menu, exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

test("map spaces support keyboard editing, closing, resizing and redo", async ({
  page,
}) => {
  await page.goto(`${prefix}/map-generator`);
  await page
    .getByRole("button", { name: "Add system at position 1", exact: true })
    .press("Enter");
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
  await picker.getByRole("button", { name: /Wellon/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Replace system 19 at position 1",
      exact: true,
    }),
  ).toBeVisible();
  const placed = await savedMap(page);
  await page.getByRole("button", { name: "Close spaces", exact: true }).click();
  await page
    .getByRole("button", { name: "Close map space 1", exact: true })
    .click();
  await expect
    .poll(async () => (await savedMap(page))?.split(",")[0])
    .toBe("X");
  await page
    .getByRole("button", { name: "Undo map edit", exact: true })
    .click();
  await expect.poll(() => savedMap(page)).toBe(placed);
  await page
    .getByRole("button", { name: "Redo map edit", exact: true })
    .click();
  await expect
    .poll(async () => (await savedMap(page))?.split(",")[0])
    .toBe("X");
  await page
    .getByRole("button", { name: "Add outer ring", exact: true })
    .click();
  await expect(page.getByText("4 rings", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await savedMap(page))?.split(",").length)
    .toBe(60);
  await page
    .getByRole("button", { name: "Undo map edit", exact: true })
    .click();
  await expect(page.getByText("3 rings", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await savedMap(page))?.split(",").length)
    .toBe(36);
});

for (const config of Object.values(mapConfigs)) {
  test(`${config.name} editor generates, restores, exports and starts a preset draft`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${prefix}/map-generator`);
    await page
      .getByRole("textbox", { name: "Galaxy layout", exact: true })
      .click();
    await page.getByRole("option", { name: config.name, exact: true }).click();
    await expect(
      page.getByText(`${config.numPlayers} players`, { exact: true }),
    ).toBeVisible();
    const blank = await savedMap(page);
    await page
      .getByRole("button", { name: "Generate map", exact: true })
      .click();
    await expect.poll(() => savedMap(page)).not.toBe(blank);
    const generated = (await savedMap(page))!;
    expect(generated.split(",")).not.toContain("_");
    expect(
      generated.split(",").filter((tile) => tile.startsWith("H")),
    ).toHaveLength(config.numPlayers);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect.poll(() => savedMap(page)).toBe(blank);
    await page
      .getByRole("button", { name: "Undo map edit", exact: true })
      .click();
    await expect.poll(() => savedMap(page)).toBe(generated);
    await page.reload();
    await expect.poll(() => savedMap(page)).toBe(generated);
    await expect(
      page.getByRole("textbox", { name: "Galaxy layout", exact: true }),
    ).toHaveValue(config.name);
    await page.getByRole("button", { name: "Share map", exact: true }).click();
    const share = page.getByRole("dialog", {
      name: "Share your galaxy",
      exact: true,
    });
    const url = await share
      .getByRole("textbox", { name: "Shareable link", exact: true })
      .inputValue();
    expect(new URL(url).pathname).toBe(`${prefix}/map-generator`);
    const shared = await page.context().newPage();
    await shared.goto(url);
    await expect.poll(() => savedMap(shared)).toBe(generated);
    await shared.close();
    await share.press("Escape");
    await menuItem(page, "Import & export", "Map strings");
    const strings = page.getByRole("dialog", {
      name: "Map String Import / Export",
      exact: true,
    });
    const exported = await strings.locator("textarea[readonly]").inputValue();
    expect(exported.trim().split(/\s+/)).toHaveLength(
      config.mapSize === 4 ? 60 : 36,
    );
    await strings.getByRole("button", { name: "Cancel", exact: true }).click();
    await menuItem(page, "Create a draft", "Draft factions on this map");
    await expect(
      page.getByRole("heading", { name: "Review your draft", exact: true }),
    ).toBeVisible();
    // This is a real creation handoff, including layouts without slice support.
    await page
      .getByRole("button", { name: "Create shared lobby", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Copy invite link", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("map imports reject invalid input, preserve edits on failure and recover after undo", async ({
  page,
}) => {
  await page.goto(`${prefix}/map-generator`);
  await page.getByRole("button", { name: "Generate map", exact: true }).click();
  await expect.poll(() => savedMap(page)).not.toContain("_");
  const original = await savedMap(page);
  await menuItem(page, "Import & export", "Map strings");
  const dialog = page.getByRole("dialog", {
    name: "Map String Import / Export",
    exact: true,
  });
  const exported = await dialog.locator("textarea[readonly]").inputValue();
  await dialog
    .getByPlaceholder("Paste a TTPG map string…")
    .fill("invalid-system");
  await dialog
    .getByRole("button", { name: "Import TTPG Map", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await expect(
    page.getByText("This is not a valid TTPG map string", { exact: true }),
  ).toBeVisible();
  expect(await savedMap(page)).toBe(original);
  await dialog.getByPlaceholder("Paste a TTPG map string…").fill(exported);
  await dialog
    .getByRole("button", { name: "Import TTPG Map", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Undo map edit", exact: true })
    .click();
  await expect.poll(() => savedMap(page)).toBe(original);

  await menuItem(page, "Import & export", "Publish map");
  const publish = page.getByRole("dialog", {
    name: "Publish Map",
    exact: true,
  });
  await publish
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Recovered galaxy");
  await publish
    .getByRole("textbox", { name: "Author", exact: true })
    .fill("Browser test");
  await publish
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("A generated galaxy retained across a failed publish.");
  await page.route("**/api/preset-maps", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Test publishing outage" }),
    }),
  );
  await publish.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByText("Test publishing outage", { exact: true }),
  ).toBeVisible();
  await expect(
    publish.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Recovered galaxy");
  expect(await savedMap(page)).toBe(original);
  await page.unroute("**/api/preset-maps");
  await publish.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\/ti4\/maps\//);
  await expect(
    page.getByRole("heading", { name: "Recovered galaxy", exact: true }),
  ).toBeVisible();
});

async function submit(page: Page, button: Locator, confirm = false) {
  if (confirm) {
    await button.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    button = dialog.getByRole("button", { name: "Confirm", exact: true });
  }
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/draft/"),
  );
  await button.click();
  expect((await response).ok()).toBe(true);
  // The next device reload must follow the committed write.
}

for (const mode of ["raw", "mantis"] as const) {
  test(`${mode} players draft and build the entire galaxy through the map controls`, async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(180_000);
    const contexts: BrowserContext[] = [];
    const players: Page[] = [];
    const errors: string[] = [];
    const count = mode === "mantis" ? 4 : 3;
    try {
      await page.goto(`${prefix}/draft/${mode}/new?playerCount=${count}`);
      await page
        .getByRole("button", {
          name: mode === "raw" ? "Create RAW lobby" : "Create Mantis lobby",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", { name: "Start draft", exact: true }),
      ).toBeDisabled();
      const url = page.url();
      for (let index = 0; index < count; index++) {
        const context = await browser.newContext(testInfo.project.use);
        contexts.push(context);
        const player = await context.newPage();
        players.push(player);
        player.on("pageerror", (error) => errors.push(error.message));
        await player.goto(url);
        await player
          .getByRole("textbox", { name: "Your name", exact: true })
          .fill(`Builder ${index + 1}`);
        await player
          .getByRole("button", { name: "Join lobby", exact: true })
          .click();
        await player
          .getByRole("button", { name: "Continue to lobby", exact: true })
          .click();
      }
      await page
        .getByRole("button", { name: "Start draft", exact: true })
        .click();
      await expect(
        page.getByText("Draft started", { exact: true }),
      ).toBeVisible();
      if (mode === "raw") {
        for (const [index, player] of players.entries()) {
          await player.reload();
          await submit(
            player,
            player.getByRole("button", {
              name: [
                "Federation of Sol",
                "Emirates of Hacan",
                "Barony of Letnev",
              ][index],
              exact: true,
            }),
          );
        }
      }
      let complete = false;
      let actions = 0;
      while (!complete && actions < 100) {
        let acted = false;
        for (const player of players) {
          await player.reload();
          if (
            await player
              .getByRole("textbox", { name: "Async map string", exact: true })
              .count()
          ) {
            complete = true;
            break;
          }
          if (mode === "mantis") {
            const choice = player
              .getByRole("button", {
                name: /^(Select|Draft tile \S+|Add system at position \d+|Choose .+ home)$/,
              })
              .and(player.locator(":enabled"))
              .first();
            if (await choice.count()) {
              await submit(player, choice, true);
              acted = true;
              actions++;
            }
          } else {
            const tiles = player
              .getByRole("button", { name: /^Select tile / })
              .and(player.locator(":enabled"));
            for (const tile of await tiles.all()) {
              await tile.click();
              const position = player
                .getByRole("button", { name: /^Place at / })
                .first();
              if (await position.count()) {
                await submit(player, position);
                acted = true;
                actions++;
                break;
              }
            }
          }
        }
        expect(
          complete || acted,
          "Every unfinished round must have an available player action",
        ).toBe(true);
      }
      expect(complete).toBe(true);
      expect(actions).toBeGreaterThan(count * 4);
      await page.reload();
      const exported = await page
        .getByRole("textbox", { name: "Async map string", exact: true })
        .inputValue();
      expect(exported).not.toContain("undefined");
      expect(exported.split(/\s+/)).toHaveLength(36);
      for (const player of players) {
        await player.reload();
        await expect(
          player.getByRole("textbox", {
            name: "Async map string",
            exact: true,
          }),
        ).toHaveValue(exported);
      }
      expect(errors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}
