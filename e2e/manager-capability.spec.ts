import { test, expect } from "@playwright/test";

test.describe("Manager capability browser evidence", () => {
  test("Manager navigation, healthy dashboard, fallback, account, and direct denial", async ({ page }) => {
    await page.goto("/e2e-manager-capability?scenario=manager-navigation");
    await expect(page.getByRole("heading", { name: "Manager navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Resumen" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mi cuenta" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Staff" })).toHaveCount(0);

    await page.goto("/e2e-manager-capability?scenario=dashboard-healthy");
    await expect(page.getByRole("heading", { name: "Dashboard healthy" })).toBeVisible();
    await page.goto("/e2e-manager-capability?scenario=dashboard-unhealthy");
    await expect(page).toHaveURL(/scenario=account$/);
    await expect(page.getByRole("heading", { name: "Account fallback" })).toBeVisible();
    await page.goto("/e2e-manager-capability?scenario=account");
    await expect(page.getByTestId("dashboard-read-count")).toHaveText("Dashboard reads: 0");
    await page.goto("/e2e-manager-capability?scenario=direct-denial");
    await expect(page.getByRole("heading", { name: "Assignment denied" })).toBeVisible();
    await expect(page.getByTestId("target-read-count")).toHaveText("Target reads: 0");
  });

  test("Admin Manager assignment controls are available and non-Admin combinations are denied", async ({ page }) => {
    await page.goto("/e2e-manager-capability?scenario=admin-staff");
    await expect(page.getByRole("heading", { name: "Manager assignment" })).toBeVisible();
    await expect(page.locator('select[name="role"]').first().locator('option[value="manager"]')).toHaveText("Gerencia");
    await expect(page.locator('select[name="role"]').last().locator('option[value="manager"]')).toHaveText("Gerencia");
    await expect(page.getByTestId("manager-display")).toHaveText("Gerencia");
    await expect(page.getByRole("button", { name: "Crear usuario" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();

    await page.goto("/e2e-manager-capability?scenario=combined-denial");
    await expect(page.getByRole("heading", { name: "Assignment denied" })).toBeVisible();
    await expect(page.getByTestId("target-read-count")).toHaveText("Target reads: 0");
  });
});
