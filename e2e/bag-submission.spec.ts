import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { BAG_VARIANTS } from "../app/draft/bag/rules";

async function join(page: Page, name: string) {
  await page
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill(name);
  await page.getByRole("button", { name: "Join lobby", exact: true }).click();
  const prompt = page.getByRole("dialog", { name: "Save your private key" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Continue to lobby" }).click();
}

async function submitPicks(page: Page, reloadSelection = false) {
  const round = await page.getByText(/^Round \d+$/).innerText();
  const submit = page.getByRole("button", { name: /^Submit \d+ picks?$/ });
  await expect(submit).toBeVisible();
  const required = Number((await submit.innerText()).match(/\d+/)![0]);
  for (let index = 0; index < required; index++) {
    await page
      .locator('input[type="checkbox"]:enabled:not(:checked)')
      .first()
      .check();
  }
  if (reloadSelection) {
    await page.reload();
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(
      required,
    );
  }
  await expect(submit).toBeEnabled();
  await submit.click();
  const confirmation = page.getByRole("dialog", {
    name: "Confirm your picks",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await confirmation
    .getByRole("button", { name: "Confirm picks", exact: true })
    .click();
  await expect(confirmation).toBeHidden();
  // Completion of the POST and loader revalidation must update the UI too.
  await expect
    .poll(
      async () =>
        (await page.getByText(round, { exact: true }).count()) === 0 ||
        (await page
          .getByRole("button", { name: "Undo this round’s picks", exact: true })
          .isVisible()),
    )
    .toBe(true);
}

for (const variant of BAG_VARIANTS) {
  test(`${variant.name} creates a lobby and submits a complete round of bag picks`, async ({
    page,
    browser,
  }) => {
    const contexts: BrowserContext[] = [];
    const errors: string[] = [];
    const watch = (player: Page) => {
      player.on("pageerror", (error) => errors.push(error.message));
      player.on("response", (response) => {
        if (
          response.status() >= 400 &&
          response.request().method() === "POST"
        ) {
          errors.push(
            `POST ${new URL(response.url()).pathname}: ${response.status()}`,
          );
        }
      });
    };
    watch(page);
    try {
      await page.goto(`/ti4/draft/bag/new?variant=${variant.id}&playerCount=3`);
      await page
        .getByRole("button", { name: "Create shared lobby", exact: true })
        .click();
      await expect(page).toHaveURL(/\/draft\/bag\/[a-f\d-]+$/);
      const lobbyUrl = page.url();
      await join(page, "Captain");
      const players = [page];
      for (const name of ["Navigator", "Engineer"]) {
        const context = await browser.newContext();
        contexts.push(context);
        const player = await context.newPage();
        watch(player);
        await player.goto(lobbyUrl);
        await join(player, name);
        players.push(player);
      }
      await page
        .getByRole("button", { name: "Start draft", exact: true })
        .click();
      await expect(page.getByText("Round 1", { exact: true })).toBeVisible();
      await submitPicks(page, true);
      const undo = page.getByRole("button", {
        name: "Undo this round’s picks",
        exact: true,
      });
      await expect(undo).toBeEnabled();
      await undo.click();
      await submitPicks(page);
      for (const player of players.slice(1)) await submitPicks(player);
      for (const player of players) {
        await expect(
          player.getByText("Round 2", { exact: true }),
        ).toBeVisible();
        await expect(
          player.getByRole("button", { name: /^Submit \d+ picks?$/ }),
        ).toBeVisible();
      }
      expect(errors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}
