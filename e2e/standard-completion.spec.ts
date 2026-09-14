import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import draftPreview from "./fixtures/draft-preview.json" with { type: "json" };
import { reloadSettledPage } from "./browser-navigation";

test("a lobby waits for its scripts before accepting a player's name", async ({
  page,
  browser,
}, testInfo) => {
  await page.goto("/ti4/draft/raw/new?playerCount=3");
  await page.getByRole("button", { name: "Create RAW lobby", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start draft", exact: true }))
    .toBeDisabled();
  const guest = await browser.newContext(testInfo.project.use);
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  try {
    await guest.route("**/assets/*.js", async (route) => {
      await scriptsReady;
      await route.continue();
    });
    const player = await guest.newPage();
    await player.goto(page.url(), { waitUntil: "commit" });
    const name = player.getByRole("textbox", { name: "Your name", exact: true });
    await expect(name).toBeVisible();
    await expect(name).toBeDisabled();
    releaseScripts();
    await name.fill("Slow connection player");
    await expect(name).toHaveValue("Slow connection player");
    await player.getByRole("button", { name: "Join lobby", exact: true }).click();
    await expect(player.getByRole("dialog", { name: "Save your private key", exact: true }))
      .toBeVisible();
    await expect(page.getByRole("listitem").getByText("Slow connection player", { exact: true }))
      .toBeVisible();
  } finally {
    releaseScripts();
    await guest.close();
  }
});

test("players finish a standard draft with keyboard controls, export the map, and replay every pick", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(150_000);
  const contexts: BrowserContext[] = [];
  const players: Page[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.addInitScript((snapshot) => {
      if (location.pathname !== "/ti4/draft/new") return;
      const prefix = "ti4:draft-preview:/ti4/draft/new:v1:";
      sessionStorage.setItem(`${prefix}keyboard`, JSON.stringify(snapshot));
      sessionStorage.setItem(`${prefix}latest`, "keyboard");
    }, draftPreview);
    await page.goto("/ti4/draft/new");
    await page
      .getByRole("button", { name: "Create shared lobby", exact: true })
      .click();
    const start = page.getByRole("button", {
      name: "Start draft",
      exact: true,
    });
    await expect(start).toBeDisabled();
    const url = page.url();
    for (let index = 0; index < 3; index++) {
      const context = await browser.newContext(testInfo.project.use);
      contexts.push(context);
      const player = await context.newPage();
      players.push(player);
      player.on("pageerror", (error) => errors.push(error.message));
      player.on("dialog", (dialog) => dialog.accept());
      await player.goto(url);
      await player
        .getByRole("textbox", { name: "Your name", exact: true })
        .fill(`Keyboard ${index + 1}`);
      await player
        .getByRole("button", { name: "Join lobby", exact: true })
        .press("Enter");
      await player
        .getByRole("button", { name: "Continue to lobby", exact: true })
        .press("Enter");
    }
    await start.click();
    await expect(
      page.getByText("Draft started", { exact: true }),
    ).toBeVisible();
    let complete = false;
    let actions = 0;
    while (!complete && actions < 20) {
      let acted = false;
      for (const player of players) {
        await reloadSettledPage(player);
        await expect(
          player.getByRole("heading", {
            name: /^(Draft Order|Draft Complete)$/,
          }),
        ).toBeVisible();
        if (
          await player
            .getByRole("heading", { name: "Draft Complete", exact: true })
            .count()
        ) {
          complete = true;
          break;
        }
        const choice = player
          .getByRole("button", {
            name: /^(Select|Choose seat \d+)$/,
            includeHidden: true,
          })
          .and(player.locator(":enabled"))
          .first();
        if (!(await choice.count())) continue;
        await expect(choice).toBeVisible();
        const choosingSeat = (
          await choice.getAttribute("aria-label")
        )?.startsWith("Choose seat ");
        const saved = player.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            response.url().includes("/draft/"),
          { timeout: 10_000 },
        );
        // Native button activation must work without generating a mouse event.
        await choice.press(actions % 2 === 0 ? "Enter" : "Space");
        const confirmation = player.getByRole("dialog", {
          name: "Confirm seat selection",
          exact: true,
        });
        if (choosingSeat) {
          await expect(confirmation).toBeVisible();
          await confirmation
            .getByRole("button", { name: "Confirm", exact: true })
            .press("Enter");
        }
        expect((await saved).ok()).toBe(true);
        actions++;
        acted = true;
      }
      expect(
        complete || acted,
        "An unfinished draft must offer a legal player action",
      ).toBe(true);
    }
    expect(complete).toBe(true);
    expect(actions).toBe(9);
    await reloadSettledPage(page);
    await expect(
      page.getByRole("heading", { name: "Draft Complete", exact: true }),
    ).toBeVisible();
    const exported = await page
      .locator("input[readonly]")
      .filter({ visible: true })
      .last()
      .inputValue();
    expect(exported.trim().split(/\s+/)).toHaveLength(36);
    expect(exported).not.toMatch(/undefined|NaN/);
    for (const player of players) {
      await reloadSettledPage(player);
      await expect(
        player.getByRole("heading", { name: "Draft Complete", exact: true }),
      ).toBeVisible();
      await expect(
        player.locator("input[readonly]").filter({ visible: true }).last(),
      ).toHaveValue(exported);
    }
    await page
      .getByRole("button", { name: "Replay Draft", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Draft Replay", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Pick 0 of 9", { exact: true })).toBeVisible();
    const forward = page.getByRole("button", { name: "Forward", exact: true });
    for (let pick = 1; pick <= 9; pick++) {
      await forward.press("Enter");
      await expect(
        page.getByText(`Pick ${pick} of 9`, { exact: true }),
      ).toBeVisible();
    }
    await expect(forward).toBeDisabled();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByText("Pick 8 of 9", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByText("Pick 0 of 9", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "End", exact: true }).click();
    await expect(page.getByText("Pick 9 of 9", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
