import { expect, test } from "@playwright/test";

test("anonymous customer and staff destinations remain separately protected", async ({ page }) => {
  await page.goto("/mis-viajes?accountId=c0000000-0000-4000-8000-000000000003");
  await expect(page).toHaveURL(/\/mis-viajes\/acceso$/);
  await expect(page.getByRole("heading", { name: "Customer access" })).toBeVisible();
  await page.goto("/admin/portal-invitations");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("invitation secrets leave the URL and malformed invitations cannot send email", async ({ page }) => {
  await page.goto("/mis-viajes/acceso#invite=invalid-token");
  await expect(page).toHaveURL(/\/mis-viajes\/acceso$/);
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await expect(page.locator('input[name="invitationToken"]').nth(0)).toHaveValue("invalid-token");
  await expect(page.locator('input[name="invitationToken"]').nth(1)).toHaveValue("invalid-token");
  await page.getByRole("button", { name: "Send access code" }).click();
  await expect(page.getByRole("status")).toContainText("If access is available");
  await expect(page.locator('input[name="invitationToken"]').nth(1)).toHaveValue("invalid-token");
  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Enter customer portal" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Access could not be verified" })).toBeVisible();
  await expect(page.locator('input[name="invitationToken"]').nth(1)).toHaveValue("invalid-token");
  await expect(page).toHaveURL(/\/mis-viajes\/acceso$/);
});
