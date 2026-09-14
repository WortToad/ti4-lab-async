import type { Page } from "@playwright/test";

export async function reloadSettledPage(page: Page) {
  // Other players' picks trigger background loader refreshes. Let those reads
  // and the Socket.IO handshake finish before deliberately replacing the page;
  // WebKit reports interrupted reads as access-control errors during navigation.
  await page.waitForLoadState("networkidle");
  await page.reload();
}
