import { expect, test } from "@playwright/test";

const setupPath = "/ti4/draft/bag/new?variant=twilights_fall&playerCount=6";
const dataPath = "/ti4/draft/bag/new.data?variant=twilights_fall&playerCount=6";
const proxyHeaders = {
  Host: "lobby.example",
  "X-Forwarded-Proto": "https",
  Origin: "https://lobby.example",
};
const settings = JSON.stringify({
  variant: "twilights_fall",
  players: Array.from({ length: 6 }, (_, index) => `Player ${index + 1}`),
  includeThundersEdge: true,
  includeTiles: true,
});

test("Create shared lobby works with HTTPS forwarded browser submissions", async ({
  page,
}) => {
  await page.route("**/draft/bag/new.data?**", async (route) => {
    const request = route.request();
    const publicUrl = new URL(request.url());
    publicUrl.protocol = "https:";
    // Forward at the network boundary so Chromium does not restore the local
    // HTTP Origin header when sending the intercepted browser request.
    const response = await route.fetch({
      headers: {
        ...request.headers(),
        origin: publicUrl.origin,
        "x-forwarded-proto": "https",
      },
      maxRedirects: 0,
    });
    await route.fulfill({ response });
  });
  await page.goto(setupPath);
  await expect(
    page.getByRole("radio", { name: "6", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Create shared lobby", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ti4\/draft\/bag\/[^/?]+$/);
  await expect(
    page.getByRole("button", { name: "Copy invite link", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start draft", exact: true }),
  ).toBeDisabled();
});

test("HTTPS forwarded lobby creation preserves the redirect and admin access", async ({
  request,
  page,
  context,
  baseURL,
}) => {
  // Model the HTTPS edge forwarding a browser form to the HTTP Node server.
  const response = await request.post(setupPath, {
    headers: proxyHeaders,
    form: { settings },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  const location = response.headers().location;
  expect(location).toMatch(/^\/ti4\/draft\/bag\/[^/?]+$/);
  const cookie = response.headers()["set-cookie"];
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Path=/ti4");

  // Follow the redirect as the creator and verify that the lobby is usable.
  const [name, value] = cookie.split(";")[0].split("=");
  await context.addCookies([{ name, value, url: baseURL! }]);
  await page.goto(location);
  await expect(
    page.getByRole("button", { name: "Copy invite link", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start draft", exact: true }),
  ).toBeDisabled();
});

test("HTTPS forwarded client submissions reach action validation", async ({
  request,
}) => {
  const response = await request.post(dataPath, {
    headers: proxyHeaders,
    form: {
      settings: JSON.stringify({ ...JSON.parse(settings), players: [] }),
    },
  });
  expect(response.status()).toBe(400);
  const body = await response.text();
  expect(body).toContain(
    "Player count must be a whole number between 2 and 8.",
  );
  expect(body).not.toContain("SanitizedError");
});

for (const origin of ["https://other.example", "http://lobby.example"]) {
  test(`forwarded actions still reject a mismatched origin: ${origin}`, async ({
    request,
  }) => {
    const response = await request.post(dataPath, {
      headers: { ...proxyHeaders, Origin: origin },
      form: { settings },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("SanitizedError");
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });
}
