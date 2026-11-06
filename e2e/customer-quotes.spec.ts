import { expect, test } from "@playwright/test";

test("anonymous quote detail and staff work routes reject forged identity and malformed cursors", async ({ page }) => {
  for (const path of ["/mis-viajes/cotizaciones", "/mis-viajes/cotizaciones/not-a-uuid?version=invalid&customerId=forged"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/mis-viajes\/acceso$/);
    await expect(page.getByRole("heading", { name: "Customer access" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept proposal", exact: true })).toHaveCount(0);
  }
  await page.goto("/admin/customer-quote-work?before=invalid&after=invalid");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("button", { name: "Claim intake", exact: true })).toHaveCount(0);
});

test("anonymous PDF tampering never returns bytes or a storage URL", async ({ request }) => {
  const response = await request.get("/mis-viajes/cotizaciones/pdf/invalid?bucket=documents&path=private.pdf", { maxRedirects: 0 });
  // The configured Auth proxy redirects; without a configured provider the route denies directly.
  if (response.status() === 307) {
    expect(new URL(response.headers().location, response.url()).pathname).toBe("/mis-viajes/acceso");
  } else {
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "Quote PDF is unavailable." });
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  expect(response.headers()["content-type"] ?? "").not.toContain("application/pdf");
  expect(response.headers().location ?? "").not.toContain("/storage/");
});
