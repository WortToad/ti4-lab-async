import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const paused = (page: Page) =>
  page.getByRole("alert").filter({ hasText: "The admin has paused the draft" });

async function confirm(page: Page, title: string, cancel = false) {
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: cancel ? "Cancel" : "Confirm", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}

async function download(page: Page, name: string) {
  const control = button(page, name);
  // The accordion's height transition can clip a stable button between mouse
  // down and mouse up. Wait for its containing panels before starting a download.
  await control.evaluate(async (element) => {
    const animations: Animation[] = [];
    for (let node: Element | null = element; node; node = node.parentElement)
      animations.push(...node.getAnimations());
    await Promise.allSettled(
      animations
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    );
  });
  const pending = page.waitForEvent("download");
  await control.click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/\.ti4-state\.json$/);
  return readFile((await file.path())!, "utf8");
}

async function importSave(page: Page, state: string) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "checkpoint.ti4-state.json",
    mimeType: "application/json",
    buffer: Buffer.from(state),
  });
  await confirm(page, "Import this saved state?");
}

async function makePick(mode: string, players: Page[]) {
  for (const player of players) await player.reload();
  const availableChoice = (player: Page) =>
    (mode === "raw"
      ? button(player, "Federation of Sol")
      : player.getByRole("button", { name: /^(Select|Ban)$/ })
    )
      .and(player.locator(":enabled"))
      .first();
  if (mode !== "bag")
    await expect
      .poll(async () => {
        const choices = await Promise.all(
          players.map((player) => availableChoice(player).count()),
        );
        return choices.some((count) => count > 0);
      })
      .toBe(true);
  for (const player of players) {
    if (mode === "bag") {
      const submit = player.getByRole("button", {
        name: /^Submit \d+ picks?$/,
      });
      const count = Number((await submit.innerText()).match(/\d+/)![0]);
      for (let index = 0; index < count; index++)
        await player
          .locator('input[type="checkbox"]:enabled:not(:checked)')
          .first()
          .check();
      await submit.click();
      const dialog = player.getByRole("dialog", {
        name: "Confirm your picks",
        exact: true,
      });
      await dialog
        .getByRole("button", { name: "Confirm picks", exact: true })
        .click();
      await expect(button(player, "Undo this round’s picks")).toBeVisible();
      return;
    }
    const choice = availableChoice(player);
    if (!(await choice.count()) || !(await choice.isEnabled())) continue;
    const response = player.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/draft/"),
    );
    if (mode === "base" || mode === "texas")
      player.once("dialog", (dialog) => dialog.accept());
    await choice.click();
    if (mode === "mantis")
      await player
        .getByRole("dialog", { name: "Confirm choice", exact: true })
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
    expect((await response).ok()).toBe(true);
    return;
  }
  throw new Error(`No player could make the first ${mode} pick`);
}

// Run against each real lobby route: operation field names and response fields
// differ between families even though they render the same controls.
export async function exerciseAdminControls(
  mode: "base" | "texas" | "bag" | "raw" | "mantis",
  admin: Page,
  players: Page[],
  playerCode: string,
) {
  for (const page of [admin, ...players]) page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  admin.on("pageerror", (error) => errors.push(error.message));
  const lobbyUrl = admin.url();
  await button(admin, "Admin controls").click();
  await expect(button(admin, "Restore checkpoint")).toBeDisabled();
  await button(admin, "Save checkpoint").click();
  await expect(button(admin, "Save checkpoint")).toBeEnabled();
  await admin
    .getByRole("combobox", { name: "Saved checkpoint", exact: true })
    .click();
  const saved = admin.getByRole("option", { name: /^(Saved|Manual)/ }).last();
  const label = await saved.innerText();
  await saved.click();
  const initialSave = await download(admin, "Export selected checkpoint");
  expect(JSON.parse(initialSave)).toMatchObject({
    format: "ti4-lobby-save",
    version: 1,
  });
  expect(initialSave).not.toContain(playerCode);

  await makePick(mode, players);
  await admin.reload();
  await button(admin, "Admin controls").click();
  const pickedSave = await download(admin, "Export current state");
  expect(pickedSave).not.toContain(playerCode);
  await button(admin, "Undo latest action").click();
  await confirm(admin, "Undo the latest action?", true);
  await expect(paused(admin)).toBeHidden();
  await button(admin, "Undo latest action").click();
  await confirm(admin, "Undo the latest action?");
  await expect(paused(admin)).toBeVisible();
  await button(admin, "Resume draft").click();
  await expect(paused(admin)).toBeHidden();

  await admin
    .getByRole("combobox", { name: "Saved checkpoint", exact: true })
    .click();
  await admin.getByRole("option", { name: label, exact: true }).click();
  await button(admin, "Restore checkpoint").click();
  await confirm(admin, "Restore this checkpoint?", true);
  await expect(paused(admin)).toBeHidden();
  await button(admin, "Restore checkpoint").click();
  await confirm(admin, "Restore this checkpoint?");
  await expect(paused(admin)).toBeVisible();
  await admin.reload();
  await expect(paused(admin)).toBeVisible();
  await button(admin, "Admin controls").click();
  await admin
    .getByRole("combobox", { name: "Saved checkpoint", exact: true })
    .click();
  await expect(
    admin.getByRole("option", { name: /Recovery|Before restoring/ }).first(),
  ).toBeVisible();
  await admin.keyboard.press("Escape");
  await button(admin, "Resume draft").click();
  await expect(paused(admin)).toBeHidden();

  const corrupt = JSON.parse(pickedSave);
  corrupt.data = "AAAA" + corrupt.data.slice(4);
  await importSave(admin, JSON.stringify(corrupt));
  await expect(
    admin.getByRole("alert").filter({ hasText: "This save is damaged" }),
  ).toBeVisible();
  await expect(paused(admin)).toBeHidden();
  await importSave(admin, pickedSave);
  await expect(paused(admin)).toBeVisible();
  await button(admin, "Resume draft").click();
  await expect(paused(admin)).toBeHidden();

  if (mode === "bag") {
    await button(admin, "Rewind draft round").click();
    const dialog = admin.getByRole("dialog", {
      name: "Rewind the draft round?",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    const response = admin.waitForResponse(
      (response) => response.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Restore round", exact: true })
      .click();
    expect((await response).ok()).toBe(true);
    await players[0].reload();
    await expect(button(players[0], "Undo this round’s picks")).toBeHidden();
    await expect(
      players[0].getByRole("button", { name: /^Submit \d+ picks?$/ }),
    ).toBeVisible();
  }

  await admin
    .getByRole("combobox", { name: "Rename player", exact: true })
    .click();
  await admin.getByRole("option", { name: "Player 1", exact: true }).click();
  await admin
    .getByRole("textbox", { name: "New name", exact: true })
    .fill("Renamed captain");
  await button(admin, "Rename").click();
  await expect(
    admin
      .getByRole("listitem")
      .filter({ has: admin.getByText("Renamed captain", { exact: true }) })
      .first(),
  ).toBeVisible();
  const row = admin
    .locator(".mantine-Paper-root")
    .filter({ has: admin.getByText("Renamed captain", { exact: true }) })
    .filter({ has: button(admin, "Replace recovery code") })
    .last();
  await row
    .getByRole("button", { name: "Replace recovery code", exact: true })
    .click();
  await confirm(admin, "Replace player recovery code?", true);
  await expect(row).toContainText(playerCode);
  await row
    .getByRole("button", { name: "Replace recovery code", exact: true })
    .click();
  await confirm(admin, "Replace player recovery code?");
  await expect(row).not.toContainText(playerCode);
  const replacementCode = (await row.innerText()).match(
    /[a-f0-9]{8}-[a-f0-9-]{27}/i,
  )![0];

  const player = players[0];
  await player.goto(`${new URL(lobbyUrl).origin}/ti4/draft/rejoin`);
  await player
    .getByRole("textbox", { name: "Recovery code", exact: true })
    .fill(playerCode);
  await button(player, "Rejoin lobby").click();
  await expect(player.getByRole("alert")).toBeVisible();
  await player
    .getByRole("textbox", { name: "Recovery code", exact: true })
    .fill(replacementCode);
  await button(player, "Rejoin lobby").click();
  await expect(player).toHaveURL(lobbyUrl);
  await button(player, "Continue to lobby").click();
  await expect(button(player, "Admin controls")).toHaveCount(0);

  await row
    .getByRole("button", { name: "Replace player", exact: true })
    .click();
  await confirm(admin, "Replace this player?", true);
  await expect(paused(admin)).toBeHidden();
  await row
    .getByRole("button", { name: "Replace player", exact: true })
    .click();
  await confirm(admin, "Replace this player?");
  await expect(paused(admin)).toBeVisible();
  await expect(button(admin, "Resume draft")).toBeDisabled();
  // Restoring old draft data must never resurrect a released credential.
  await importSave(admin, initialSave);
  await expect(button(admin, "Resume draft")).toBeDisabled();
  await player.goto(`${new URL(lobbyUrl).origin}/ti4/draft/rejoin`);
  await player
    .getByRole("textbox", { name: "Recovery code", exact: true })
    .fill(replacementCode);
  await button(player, "Rejoin lobby").click();
  await expect(player.getByRole("alert")).toBeVisible();
  await player.evaluate(() => localStorage.clear());
  await player.context().clearCookies();
  await player.goto(lobbyUrl);
  await player
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill("Replacement captain");
  await button(player, "Join lobby").click();
  await button(player, "Continue to lobby").click();
  await expect(button(admin, "Resume draft")).toBeEnabled();
  await button(admin, "Resume draft").click();
  await expect(paused(admin)).toBeHidden();
  await admin.reload();
  await expect(
    admin
      .getByRole("listitem")
      .filter({ has: admin.getByText("Replacement captain", { exact: true }) })
      .first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
}
