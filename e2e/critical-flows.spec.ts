import { test, expect } from "@playwright/test";
import { futureIsoDate, loginAsAdmin } from "./support";

test("public quote flow persists safely and is visible in admin", async ({ page, request, baseURL }) => {
  const unique = `${Date.now()}`;
  const phoneSuffix = unique.slice(-7);
  const holderName = `E2E Quote ${unique}`;
  const email = `e2e.quote.${unique}@example.com`;
  const whatsappDigits = `52998${phoneSuffix}`;
  const whatsapp = `+${whatsappDigits}`;
  const destination = "Cancún";
  const service = "Hotel o resort";
  const campaign = `e2e-critical-flow-${unique}`;

  await page.goto(`/es/cotizar?utm_campaign=${encodeURIComponent(campaign)}&campaign=${encodeURIComponent(campaign)}&destination=${encodeURIComponent(destination)}&service=${encodeURIComponent(service)}&currency=USD`);

  await expect(page.getByRole("heading", { name: "Recibe una propuesta personalizada" })).toBeVisible();
  await expect(page.locator('input[name="mainDestination"]')).toHaveValue(destination);
  await expect(page.locator('select[name="serviceInterest"]')).toHaveValue(service);

  await page.locator('input[name="holderName"]').fill(holderName);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="whatsapp"]').fill(whatsapp);
  await page.locator('input[name="origin"]').fill("CDMX");
  await page.locator('input[name="departureDate"]').fill(futureIsoDate(40));
  await page.locator('input[name="returnDate"]').fill(futureIsoDate(46));
  await page.locator('input[name="adults"]').fill("2");
  await page.locator('input[name="children"]').fill("1");
  await page.locator('select[name="preferredCurrency"]').selectOption("USD");
  await page.locator('input[name="approximateBudget"]').fill("2400");
  await page.locator('textarea[name="notes"]').fill(`Critical E2E coverage ${unique}`);
  await page.locator('input[name="contactConsent"]').check();

  await page.getByRole("button", { name: "Enviar solicitud" }).click();

  await expect(page.getByRole("heading", { name: "Solicitud recibida" })).toBeVisible();
  await expect(page.getByText(holderName, { exact: false })).toBeVisible();
  const referenceText = await page.getByText(/^Ref\./).textContent();
  expect(referenceText).toMatch(/^Ref\. [A-Z0-9]{8}$/);

  const whatsappLink = page.getByRole("link", { name: "Continuar por WhatsApp" });
  await expect(whatsappLink).toBeVisible();
  const whatsappHref = await whatsappLink.getAttribute("href");
  expect(whatsappHref).toBeTruthy();
  expect(whatsappHref).toContain("/api/whatsapp-click?");
  const trackedUrl = new URL(whatsappHref!, baseURL);
  expect(trackedUrl.searchParams.get("pagePath")).toBe("quote-confirmation");
  expect(trackedUrl.searchParams.get("locale")).toBe("es");
  expect(trackedUrl.searchParams.get("message")).toContain(holderName);
  const redirectResponse = await request.get(trackedUrl.toString(), { maxRedirects: 0 });
  expect(redirectResponse.status()).toBe(302);
  expect(redirectResponse.headers()["location"]).toContain("https://wa.me/");

  await loginAsAdmin(page);

  await page.goto("/admin/leads");
  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: holderName })).toBeVisible();
  await page.getByRole("link", { name: holderName }).click();

  await expect(page.getByRole("heading", { name: holderName })).toBeVisible();
  await expect(page.getByText(email, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(whatsappDigits, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Website Quote")).toBeVisible();
  await expect(page.getByText("Cotización recibida")).toBeVisible();

  await page.getByRole("link", { name: "Nueva cotización" }).click();
  await expect(page.getByRole("heading", { name: "Nueva cotización comercial" })).toBeVisible();
  await expect(page.locator('select[name="contactId"]')).not.toHaveValue("");
  await expect(page.locator('select[name="opportunityId"]')).not.toHaveValue("");
  await page.locator('input[name="title"]').fill(`Propuesta E2E ${unique}`);
  await page.locator('input[name="totalAmount"]').fill("2400");
  await page.locator('input[name="depositAmount"]').fill("600");
  await page.locator('input[name="validUntil"]').fill(futureIsoDate(20));
  await page.locator('input[name="pdf"]').setInputFiles({
    name: `propuesta-${unique}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nAC Travel E2E initial quote\n%%EOF"),
  });
  await page.getByRole("button", { name: "Crear cotización con PDF" }).click();

  await expect(page).toHaveURL(/\/admin\/quotes\/[0-9a-f-]+\?created=1$/);
  await expect(page.getByRole("heading", { name: /^COT-[0-9]{4}-[0-9]{6,}$/ })).toBeVisible();
  await expect(page.getByText(`Propuesta E2E ${unique}`, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Lista", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar enviada" })).toBeVisible();
  await expect(page.getByText("PDF de la versión actual", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Vincular PDF legado/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Cotizaciones" }).first()).toBeVisible();
});
