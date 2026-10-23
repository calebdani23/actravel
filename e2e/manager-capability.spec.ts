import { test, expect } from "@playwright/test";

test.describe("Manager capability browser evidence", () => {
  test("Manager navigation, healthy dashboard, fallback, account, and direct denial", async ({ page }) => {
    await page.goto("/e2e-manager-capability?scenario=manager-navigation");
    await expect(page.getByRole("heading", { name: "Manager navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mi día" })).toHaveAttribute("href", "/admin/dashboard");
    await expect(page.locator("header p").filter({ hasText: /^Mi día$/ })).toBeVisible();
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

  test("Mi día is keyboard operable and announces pending, failure, and success", async ({ page }) => {
    await page.goto("/e2e-manager-capability?scenario=mi-dia-accessibility");
    await expect(page.getByRole("heading", { name: "Mi día" })).toBeVisible();
    await expect(page.getByRole("list")).toBeVisible();
    await expect(page.locator("time")).toHaveAttribute("datetime", "2026-09-28T12:00:00.000000Z");
    await expect(page.getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", /referenceTime=.*afterDueAt=.*afterId=/);

    const reason = page.getByLabel("Motivo de cancelación");
    const start = page.getByRole("button", { name: "Iniciar" });
    await page.keyboard.press("Tab");
    await expect(reason).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(start).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(reason).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    const pendingForm = page.locator("form[aria-busy=true]");
    await expect(pendingForm).toBeVisible();
    await expect(reason).toBeDisabled();
    const pendingButtons = pendingForm.getByRole("button", { name: "Actualizando…" });
    await expect(pendingButtons).toHaveCount(3);
    for (const button of await pendingButtons.all()) await expect(button).toBeDisabled();
    const alert = page.locator('p[role="alert"]');
    await expect(alert).toHaveText("No pudimos actualizar la tarea. Intenta de nuevo.");
    await expect(alert).toBeFocused();

    const cancel = page.getByRole("button", { name: "Cancelar" });
    const complete = page.getByRole("button", { name: "Completar" });
    await page.keyboard.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(complete).toBeFocused();
    await page.keyboard.press("Enter");
    const status = page.getByRole("status");
    await expect(status).toHaveText("Tarea completada.");
    await expect(status).toHaveAttribute("aria-live", "polite");

    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    const next = page.getByRole("link", { name: "Siguiente" });
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/scenario=mi-dia-accessibility.*afterId=/);
    await expect(page.getByText("Página siguiente activada")).toBeVisible();
  });

  test("Dashboard route errors focus safe feedback and invoke reset", async ({ page }) => {
    await page.goto("/e2e-manager-capability?scenario=dashboard-route-error");
    const alert = page.getByRole("alert").filter({ hasText: "No pudimos mostrar el Dashboard." });
    await expect(alert).toBeFocused();
    await expect(alert).toContainText("No pudimos mostrar el Dashboard.");
    await expect(page.getByText("provider-sql-secret", { exact: false })).toHaveCount(0);

    await page.keyboard.press("Tab");
    const retry = page.getByRole("button", { name: "Reintentar" });
    await expect(retry).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("route-error-reset-count")).toHaveText("Reset invocations: 1");
  });

  test("unsupported roles preserve Resumen and their existing Dashboard links", async ({ page }) => {
    const scenarios = {
      operaciones: ["Reservas", "Cotizaciones", "Documentos"],
      finanzas: ["Pagos", "Cotizaciones"],
      marketing: ["Registro", "Destinos", "Paquetes", "Plantillas"],
    };
    for (const [role, links] of Object.entries(scenarios)) {
      await page.goto(`/e2e-manager-capability?scenario=unsupported-${role}`);
      await expect(page.getByRole("heading", { name: "Legacy Dashboard preserved" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Resumen" })).toHaveAttribute("href", "/admin/dashboard");
      await expect(page.locator("header p").filter({ hasText: /^Resumen$/ })).toBeVisible();
      await expect(page.getByRole("link", { name: "Mi día" })).toHaveCount(0);
      for (const name of links) await expect(page.getByRole("link", { name })).toBeVisible();
    }
  });
});
