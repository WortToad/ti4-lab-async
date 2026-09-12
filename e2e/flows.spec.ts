import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const prefix = "/ti4";
async function miniPreview(page: Page) {
  await page.goto(`${prefix}/draft/minimilty/new?playerCount=3`);
  await page
    .getByRole("button", {
      name: "Generate map and preview draft",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your draft", exact: true }),
  ).toBeVisible();
}
async function previewSnapshot(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(sessionStorage).find(
      (key) => key.startsWith("ti4:draft-preview:") && !key.endsWith(":latest"),
    );
    return key ? sessionStorage.getItem(key) : null;
  });
}

for (const [name, path, heading] of [
  ["Milty", "/draft/prechoice?format=milty&playerCount=3", "Milty"],
  ["Nucleus", "/draft/prechoice?format=nucleus&playerCount=3", "Nucleus"],
  ["Texas", "/draft/prechoice?format=texas&playerCount=3", "Texas"],
  [
    "Twilight's Fall",
    "/draft/prechoice?format=twilight&playerCount=3",
    "Milty",
  ],
  ["Franken", "/draft/bag/new?variant=franken&playerCount=3", "Franken"],
  [
    "Twilight bags",
    "/draft/bag/new?variant=twilights_fall&playerCount=3",
    "Twilight",
  ],
  ["RAW", "/draft/raw/new?playerCount=3", "Rules as written"],
  [
    "Twilight RAW",
    "/draft/raw/new?mode=twilightsFall&playerCount=3",
    "Twilight",
  ],
  ["Mantis", "/draft/mantis/new?playerCount=4", "Mantis"],
  ["Mini-Milty", "/draft/minimilty/new?playerCount=3", "Mini-Milty"],
] as const) {
  test(`${name} setup renders and accepts its player count`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${prefix}${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      heading,
    );
    const count = name === "Mantis" ? "4" : "3";
    await expect(
      page.getByRole("radio", { name: count, exact: true }),
    ).toBeChecked();
    if (name === "Twilight's Fall")
      await expect(
        page.getByRole("tab", { name: "Twilight's Fall packs", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("textbox", { name: "Your name", exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
}

test("edited preview survives reload and failed creation, then clears after retry", async ({
  page,
}) => {
  await miniPreview(page);
  const original = await previewSnapshot(page);
  expect(original).not.toBeNull();
  await page
    .getByRole("button", { name: "Regenerate map", exact: true })
    .click();
  await expect.poll(() => previewSnapshot(page)).not.toBe(original);
  const edited = await previewSnapshot(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Review your draft", exact: true }),
  ).toBeVisible();
  expect(await previewSnapshot(page)).toBe(edited);
  await page.route("**/api/draft/create", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporary test outage; retry creation." }),
    }),
  );
  await page
    .getByRole("button", { name: "Create shared lobby", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Temporary test outage");
  expect(await previewSnapshot(page)).toBe(edited);
  await page.unroute("**/api/draft/create");
  await page
    .getByRole("button", { name: "Create shared lobby", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copy invite link", exact: true }),
  ).toBeVisible();
  expect(await previewSnapshot(page)).toBeNull();
  await expect(
    page.getByRole("button", { name: "Start draft", exact: true }),
  ).toBeDisabled();
});

for (const mode of ["base", "bag", "raw", "mantis"] as const) {
  test(`${mode} players join, start, recover on a new device, and pause/resume`, async ({
    page,
    browser,
  }) => {
    const contexts: BrowserContext[] = [];
    const count = mode === "mantis" ? 4 : 3;
    try {
      if (mode === "base") await miniPreview(page);
      else await page.goto(`${prefix}/draft/${mode}/new?playerCount=${count}`);
      await page
        .getByRole("button", {
          name:
            mode === "mantis"
              ? "Create Mantis lobby"
              : mode === "raw"
                ? "Create RAW lobby"
                : "Create shared lobby",
          exact: true,
        })
        .click();
      const start = page.getByRole("button", {
        name: "Start draft",
        exact: true,
      });
      await expect(start).toBeDisabled();
      const lobbyUrl = page.url();
      let recoveryCode = "";
      for (let index = 0; index < count; index++) {
        const context = await browser.newContext();
        contexts.push(context);
        const guest = await context.newPage();
        await guest.goto(lobbyUrl);
        await guest
          .getByRole("textbox", { name: "Your name", exact: true })
          .fill(`Player ${index + 1}`);
        await guest
          .getByRole("button", { name: "Join lobby", exact: true })
          .click();
        const keyPrompt = guest.getByRole("dialog", {
          name: "Save your private key",
          exact: true,
        });
        await expect(keyPrompt).toBeVisible();
        if (index === 0)
          recoveryCode = await keyPrompt
            .getByRole("textbox", {
              name: "Private key (recovery code)",
              exact: true,
            })
            .inputValue();
        await keyPrompt
          .getByRole("button", { name: "Continue to lobby", exact: true })
          .click();
        await expect(
          guest.getByRole("textbox", { name: "Your name", exact: true }),
        ).toHaveCount(0);
      }
      await expect(start).toBeEnabled();
      await start.click();
      await expect(
        page.getByText("Draft started", { exact: true }),
      ).toBeVisible();

      const recoveryContext = await browser.newContext();
      contexts.push(recoveryContext);
      const recovered = await recoveryContext.newPage();
      await recovered.goto(`${new URL(lobbyUrl).origin}${prefix}/draft/rejoin`);
      await recovered
        .getByRole("textbox", { name: "Recovery code", exact: true })
        .fill(recoveryCode);
      await recovered
        .getByRole("button", { name: "Rejoin lobby", exact: true })
        .click();
      await expect(recovered).toHaveURL(lobbyUrl);
      await expect(
        recovered.getByRole("dialog", {
          name: "Save your private key",
          exact: true,
        }),
      ).toBeVisible();
      await recovered
        .getByRole("button", { name: "Continue to lobby", exact: true })
        .click();
      await expect(
        recovered.getByRole("textbox", { name: "Your name", exact: true }),
      ).toHaveCount(0);

      await page
        .getByRole("button", { name: "Manage lobby", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Admin controls", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Pause draft", exact: true })
        .click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "The admin has paused the draft" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Resume draft", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Pause draft", exact: true }),
      ).toBeVisible();
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}

test("map generation, undo, redo and shared URL preserve the map", async ({
  page,
}) => {
  await page.goto(`${prefix}/map-generator`);
  await page.getByRole("button", { name: "Generate map", exact: true }).click();
  const undo = page.getByRole("button", { name: "Undo map edit", exact: true });
  await expect(undo).toBeEnabled();
  await undo.click();
  await page
    .getByRole("button", { name: "Redo map edit", exact: true })
    .click();
  await page.getByRole("button", { name: "Share map", exact: true }).click();
  const share = page.getByRole("dialog", {
    name: "Share your galaxy",
    exact: true,
  });
  const url = await share
    .getByRole("textbox", { name: "Shareable link", exact: true })
    .inputValue();
  const mapString = await share
    .getByRole("textbox", { name: "Map string", exact: true })
    .inputValue();
  expect(mapString.length).toBeGreaterThan(20);
  await page.goto(url);
  await page.getByRole("button", { name: "Share map", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Map string", exact: true }),
  ).toHaveValue(mapString);
});

test("invalid recovery and template inputs show actionable feedback", async ({
  page,
}) => {
  await page.goto(`${prefix}/draft/rejoin`);
  await page
    .getByRole("textbox", { name: "Recovery code", exact: true })
    .fill("invalid-recovery-code");
  await page.getByRole("button", { name: "Rejoin lobby", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Enter your saved recovery code",
  );
  await page.goto(`${prefix}/draft/prechoice?format=milty&playerCount=3`);
  await page
    .getByRole("button", { name: "Use a draft template", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Use a draft template",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Draft template JSON", exact: true })
    .fill("{broken");
  await dialog
    .getByRole("button", { name: "Preview new lobby", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Draft template JSON", exact: true }),
  ).toHaveValue("{broken");
});

test("an exported template starts a new preview with a fresh roster and no picks", async ({
  page,
}) => {
  await miniPreview(page);
  const template = JSON.parse((await previewSnapshot(page))!).draft;
  template.players = template.players.map((player: { id: number }) => ({
    ...player,
    name: "Previous owner",
  }));
  template.selections = [
    {
      type: "SELECT_FACTION",
      playerId: 0,
      factionId: template.availableFactions[0],
    },
  ];
  template.pickOrder = [0, 1, 2];
  template.stagedSelections = { priorityValue: { 0: "hacan" } };
  await page.goto(`${prefix}/draft/prechoice?format=milty&playerCount=3`);
  await page
    .getByRole("button", { name: "Use a draft template", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Use a draft template",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Draft template JSON", exact: true })
    .fill(JSON.stringify(template));
  await dialog
    .getByRole("button", { name: "Preview new lobby", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your draft", exact: true }),
  ).toBeVisible();
  const restored = await page.evaluate(() => {
    const latest = Object.keys(sessionStorage).find(
      (key) => key.startsWith("ti4:draft-preview:") && key.endsWith(":latest"),
    )!;
    const id = sessionStorage.getItem(latest)!;
    return JSON.parse(sessionStorage.getItem(latest.replace(/latest$/, id))!)
      .draft;
  });
  expect(restored.presetMap).toEqual(template.presetMap);
  expect(restored.availableFactions).toEqual(template.availableFactions);
  expect(
    restored.players.map((player: { name: string }) => player.name),
  ).toEqual(["Player 1", "Player 2", "Player 3"]);
  expect(restored.selections).toEqual([]);
  expect(restored.stagedSelections).toBeUndefined();
});

test("tournament links validate prepared slices and create a named shared table", async ({
  page,
}) => {
  await page.goto(`${prefix}/draft/tournament`);
  await expect(
    page.getByText("Tournament setup link incomplete", { exact: true }),
  ).toBeVisible();
  const params = new URLSearchParams({
    playerCount: "4",
    numFactions: "5",
    urlPrefix: "browser-test",
    slices:
      "Alpha,19,20,21,39,40;Beta,22,23,24,41,42;Gamma,25,26,27,43,44;Delta,28,29,30,45,46",
  });
  await page.goto(`${prefix}/draft/tournament?${params}`);
  const create = page.getByRole("button", {
    name: "Create shared lobby",
    exact: true,
  });
  await expect(create).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Table name", exact: true })
    .fill(`table-${Date.now()}`);
  await create.click();
  await expect(
    page.getByRole("button", { name: "Copy invite link", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/ti4\/draft\/browser-test-table-/);
  await expect(
    page.getByRole("button", { name: "Start draft", exact: true }),
  ).toBeDisabled();
});
