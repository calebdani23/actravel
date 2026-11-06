import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:3137";
test.skip(process.env.RUN_CUSTOMER_QUOTES_BROWSER_TESTS !== "1", "Requires the isolated real-SQL quote HTTP fixture.");
async function customerLogin(page: Page, email: string) {
  await page.goto("/mis-viajes/acceso");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send access code" }).click();
  await expect(page.getByRole("status")).toContainText("If access is available");
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Enter customer portal" }).click();
  await expect(page).toHaveURL(/\/mis-viajes$/);
}
async function staffSession(context: BrowserContext, email: string) {
  const cookies: { name: string; value: string; domain: string; path: string }[] = [];
  const client = createServerClient(fixture, "sb_publishable_local_test", { cookies: {
    getAll: () => [],
    setAll: values => { for (const value of values) cookies.push({ name: value.name, value: value.value, domain: "127.0.0.1", path: "/" }); },
  } });
  const result = await client.auth.verifyOtp({ email, token: "123456", type: "email" });
  expect(result.error).toBeNull();
  expect(cookies.length).toBeGreaterThan(0);
  await context.addCookies(cookies);
}

test("verified quote journey: private PDF, stale consent, requests, acceptance and staff work", async ({ page, browser, request }) => {
  test.setTimeout(120000);
  const data = await (await request.get(`${fixture}/fixtures`)).json();
  const { alice, bob, intake } = data.quotes;
  await customerLogin(page, "alice@quotes.test");
  await page.goto("/mis-viajes/cotizaciones");
  await expect(page.locator(`a[href*="${alice.quoteId}"]`)).toBeVisible();
  await expect(page.locator(`a[href*="${bob.quoteId}"]`)).toHaveCount(0);
  await expect(page.getByText("PRIVATE VERSION NOTE")).toHaveCount(0);
  await page.goto(`/mis-viajes/cotizaciones/${alice.quoteId}`);
  await expect(page.getByRole("button", { name: "Accept proposal", exact: true })).toHaveCount(0);
  await expect(page.getByText("Acceptance is unavailable until approved terms are published.")).toBeVisible();

  const pdf = await page.request.get(`/mis-viajes/cotizaciones/pdf/${alice.versionId}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["cache-control"]).toContain("no-store");
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect(createHash("sha256").update(await pdf.body()).digest("hex")).toBe(data.pdfHash);
  const deniedPdf = await page.request.get(`/mis-viajes/cotizaciones/pdf/${bob.versionId}?path=${alice.path}`);
  expect(deniedPdf.status()).toBe(404);

  expect((await (await request.post(`${fixture}/scenario/publish-terms`)).json()).ok).toBe(true);
  await page.reload();
  const accept = page.getByRole("button", { name: "Accept proposal", exact: true });
  const consent = page.getByRole("checkbox", { name: "I accept this proposal PDF and the displayed approved terms." });
  await expect(accept).toBeDisabled();
  await consent.check();
  expect((await (await request.post(`${fixture}/scenario/publish-terms`)).json()).ok).toBe(true);
  await accept.click();
  await expect(page.getByRole("region", { name: "Proposal actions" }).getByRole("alert")).toBeVisible();
  await expect(page.getByRole("region", { name: "Acceptance receipt" })).toHaveCount(0);
  await page.reload();

  const changes = page.getByRole("textbox", { name: "Requested changes", exact: true });
  await changes.fill("x".repeat(2001));
  await page.getByRole("button", { name: "Request changes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Proposal actions" }).getByRole("alert")).toBeVisible();
  await expect(changes).toHaveValue("x".repeat(2001));
  await changes.fill("Please confirm the room arrangement.");
  await page.getByRole("button", { name: "Request changes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Recent change requests" })).toContainText("Please confirm the room arrangement.");
  await expect(changes).toHaveValue("");
  await consent.check();
  await accept.click();
  await expect(page.getByRole("region", { name: "Acceptance receipt" })).toContainText("Verified customer acceptance");
  await expect(page.getByRole("region", { name: "Proposal terms" })).toContainText("TEST ONLY synthetic approved conditions 2.");
  await page.reload();
  await expect(page.getByRole("region", { name: "Acceptance receipt" })).toBeVisible();

  await page.goto(`/mis-viajes/cotizaciones/${intake.quoteId}`);
  await page.getByRole("textbox", { name: "Requested changes", exact: true }).fill("Please review this unassigned proposal.");
  await page.getByRole("button", { name: "Request changes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Recent change requests" })).toContainText("Please review this unassigned proposal.");

  const bobContext = await browser.newContext();
  const advisorContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const opsContext = await browser.newContext();
  try {
    const other = await bobContext.newPage();
    await customerLogin(other, "bob@quotes.test");
    const foreign = await other.goto(`/mis-viajes/cotizaciones/${alice.quoteId}`);
    expect(foreign?.status()).toBe(404);
    await expect(other.getByRole("button", { name: "Accept proposal", exact: true })).toHaveCount(0);
    expect((await other.request.get(`/mis-viajes/cotizaciones/pdf/${alice.versionId}`)).status()).toBe(404);

    await staffSession(advisorContext, "advisor@quotes.test");
    const advisor = await advisorContext.newPage();
    await advisor.goto("/admin/customer-quote-work");
    await expect(advisor.getByRole("heading", { name: "Customer quote work" })).toBeVisible();
    const handoff = advisor.getByRole("article").filter({ hasText: "Verified customer acceptance" });
    await expect(handoff).toContainText("acceptance pre-alert only");
    await handoff.getByRole("button", { name: "Start", exact: true }).click();
    await expect(handoff).toContainText("Task: in_progress");
    await handoff.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(handoff).toContainText("Task: completed");
    await expect(handoff.getByRole("button", { name: "Complete", exact: true })).toHaveCount(0);

    await staffSession(adminContext, "admin@quotes.test");
    const admin = await adminContext.newPage();
    await admin.goto("/admin/customer-quote-work");
    const unassigned = admin.getByRole("article").filter({ hasText: "Please review this unassigned proposal." });
    await expect(unassigned).toContainText("Admin intake");
    await unassigned.getByRole("button", { name: "Claim intake", exact: true }).click();
    await expect(unassigned).toContainText("Task: pending");
    await unassigned.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(unassigned).toContainText("Task: completed");

    await staffSession(opsContext, "ops@quotes.test");
    const ops = await opsContext.newPage();
    await ops.goto("/admin/customer-quote-work");
    await expect(ops.getByText("Verified customer acceptance", { exact: true })).toBeVisible();
    await expect(ops.getByText("Verified customer change request", { exact: true })).toHaveCount(0);
    await expect(ops.getByRole("button", { name: /^(Start|Complete|Cancel|Claim intake)$/ })).toHaveCount(0);
  } finally {
    await Promise.all([bobContext, advisorContext, adminContext, opsContext].map(context => context.close()));
  }
});
