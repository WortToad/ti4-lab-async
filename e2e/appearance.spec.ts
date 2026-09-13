import { expect, test } from "@playwright/test";
import draftPreview from "./fixtures/draft-preview.json" with { type: "json" };

// These baselines were captured before the dependency/runtime upgrade.
// Keep the same browser version when comparing dependency changes.
const pages = [
  ["home", "/"],
  ["draft-preview", "/draft/new"],
  ["milty", "/draft/prechoice?format=milty&playerCount=3"],
  ["texas", "/draft/prechoice?format=texas&playerCount=3"],
  ["twilight", "/draft/prechoice?format=twilight&playerCount=3"],
  ["franken", "/draft/bag/new?variant=franken&playerCount=3"],
  ["raw", "/draft/raw/new?playerCount=3"],
  ["mantis", "/draft/mantis/new?playerCount=4"],
  ["mini-milty", "/draft/minimilty/new?playerCount=3"],
  ["map", `/map-generator?map=${Array(18).fill("_").join(",")}`],
  ["rejoin", "/draft/rejoin"],
] as const;

for (const [name, path] of pages) {
  test(`${name} appearance stays consistent`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    if (name === "draft-preview") {
      await page.addInitScript((snapshot) => {
        const prefix = "ti4:draft-preview:/ti4/draft/new:v1:";
        sessionStorage.setItem(`${prefix}appearance`, JSON.stringify(snapshot));
        sessionStorage.setItem(`${prefix}latest`, "appearance");
      }, draftPreview);
    }
    await page.goto(`/ti4${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images, (image) => image.decode().catch(() => {})),
      );
    });
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: "disabled",
      // Allow only isolated antialiasing pixels on rounded corners.
      maxDiffPixels: 5,
    });
    expect(errors).toEqual([]);
  });
}
