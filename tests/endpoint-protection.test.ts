import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { checkPublicRateLimit, requesterKeyHash, resetPublicRateLimitFallbackForTests, setPublicRateLimitStoreForTests } from "@/lib/security/public-rate-limit";
import { leadTemplateVariables, renderWhatsAppTemplate } from "@/lib/admin/whatsapp-template-renderer";
import { createQuoteRequestSchema } from "@/lib/validations/quote-request";

const validQuotePayload = {
  locale: "en",
  preferredCurrency: "USD",
  holderName: "Ada Lovelace",
  email: "ada@example.com",
  whatsapp: "+1 555 100 2000",
  origin: "Cancun",
  mainDestination: "Riviera Maya",
  departureDate: "2026-07-01",
  returnDate: "2026-07-07",
  adults: 2,
  children: 1,
  serviceInterest: "Family package",
  approximateBudget: 3500,
  sourceChannel: "website_quote",
  contactConsent: true,
  notes: "Need vegan options",
  website: "",
} as const;

test("rate limiter hashes requester metadata and never exposes raw IP", () => {
  process.env.PUBLIC_RATE_LIMIT_SALT = "test-salt";
  const request = new Request("https://example.com/api/quote-request", {
    headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "Example Browser" },
  });
  const hash = requesterKeyHash(request);
  assert.equal(hash.length, 64);
  assert.doesNotMatch(hash, /203\.0\.113\.10|Example Browser/);
});

test("rate limiter counts windows and returns over-limit metadata", async () => {
  resetPublicRateLimitFallbackForTests();
  process.env.PUBLIC_RATE_LIMIT_QUOTE_REQUEST_MAX = "2";
  process.env.PUBLIC_RATE_LIMIT_QUOTE_REQUEST_WINDOW_SECONDS = "60";
  let count = 0;
  setPublicRateLimitStoreForTests({ increment: async () => ++count });
  const request = new Request("https://example.com/api/quote-request", { headers: { "user-agent": "Test" } });

  assert.equal((await checkPublicRateLimit("quote_request", request)).allowed, true);
  assert.equal((await checkPublicRateLimit("quote_request", request)).allowed, true);
  const third = await checkPublicRateLimit("quote_request", request);
  assert.equal(third.allowed, false);
  assert.equal(third.count, 3);
  assert.equal(third.retryAfterSeconds !== undefined && third.retryAfterSeconds > 0, true);
});

test("quote limiter uses in-process fallback when durable storage fails", async () => {
  resetPublicRateLimitFallbackForTests();
  process.env.PUBLIC_RATE_LIMIT_QUOTE_REQUEST_MAX = "1";
  setPublicRateLimitStoreForTests({ increment: async () => { throw new Error("database offline"); } });
  const request = new Request("https://example.com/api/quote-request", { headers: { "user-agent": "Fallback" } });

  const first = await checkPublicRateLimit("quote_request", request);
  const second = await checkPublicRateLimit("quote_request", request);
  assert.equal(first.allowed, true);
  assert.equal(first.usedFallback, true);
  assert.equal(second.allowed, false);
});

test("whatsapp limiter fails open when durable storage fails", async () => {
  resetPublicRateLimitFallbackForTests();
  setPublicRateLimitStoreForTests({ increment: async () => { throw new Error("database offline"); } });
  const request = new Request("https://example.com/api/whatsapp-click", { headers: { "user-agent": "Fallback" } });

  const result = await checkPublicRateLimit("whatsapp_click", request);
  assert.equal(result.allowed, true);
  assert.equal(result.usedFallback, true);
});

test("quote schema accepts empty honeypot and rejects filled honeypot or suspicious controls", () => {
  const schema = createQuoteRequestSchema("en");
  assert.equal(schema.safeParse(validQuotePayload).success, true);
  assert.equal(schema.safeParse({ ...validQuotePayload, website: "https://bot.example" }).success, false);
  assert.equal(schema.safeParse({ ...validQuotePayload, holderName: "Ada\u0001" }).success, false);
});

test("quote schema requires email while keeping notes optional", () => {
  const schema = createQuoteRequestSchema("en");
  assert.equal(schema.safeParse({ ...validQuotePayload, email: undefined }).success, false);
  assert.equal(schema.safeParse({ ...validQuotePayload, email: "" }).success, false);
  assert.equal(schema.safeParse({ ...validQuotePayload, email: "ada@example.com", notes: undefined }).success, true);
});

test("quote schema normalizes blank meta lead event ids before validation", () => {
  const schema = createQuoteRequestSchema("en");
  const parsed = schema.safeParse({ ...validQuotePayload, metaLeadEventId: "   " });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.metaLeadEventId, undefined);
  assert.equal(schema.safeParse({ ...validQuotePayload, metaLeadEventId: "bad id with spaces" }).success, false);
});

test("admin log retry actions are role gated and forms submit a single logId", () => {
  const actions = readFileSync("app/admin/(protected)/logs/actions.ts", "utf8");
  const page = readFileSync("app/admin/(protected)/logs/page.tsx", "utf8");

  assert.match(actions, /requireAdminRole\(\["admin", "marketing"\]\)/);
  assert.match(actions, /retryNotificationLog\(logId\(formData\), session\.user\.id\)/);
  assert.match(actions, /setNotificationIncidentStatus\(logId\(formData\), incidentStatus\(formData\), session\.user\.id\)/);
  assert.equal(actions.indexOf("await requireAdminRole") < actions.indexOf("retryNotificationLog(logId(formData), session.user.id)"), true);
  assert.match(page, /name="logId"/);
  assert.match(page, /name="incidentStatus"/);
  assert.match(page, /const canRetry = status === "failed" \|\| status === "queued"/);
});

test("admin middleware refreshes Supabase sessions and keeps role checks out of edge redirects", () => {
  const source = readFileSync("middleware.ts", "utf8");
  const loginPage = readFileSync("app/admin/login/page.tsx", "utf8");

  assert.match(source, /createServerClient\(supabaseUrl, supabasePublishableKey/);
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /matcher: \["\/admin\/:path\*"\]/);
  assert.match(source, /isProtectedAdminPath\(pathname\)/);
  assert.match(source, /redirectTo\(request, ADMIN_LOGIN_PATH/);
  assert.match(source, /isAdminLoginPath\(pathname\)/);
  assert.doesNotMatch(source, /ADMIN_DASHBOARD_PATH|redirectTo\(request, [^)]*DASHBOARD/);
  assert.match(loginPage, /const session = await getAdminSession\(\)/);
  assert.match(loginPage, /if \(session\) redirect\("\/admin\/dashboard"\)/);
  assert.doesNotMatch(source, /from\("profiles"\)|from\("profile_roles"\)|requireAdminRole|getAdminSession/);
});

test("admin app keeps server-side role allowlists and avoids service-role imports", () => {
  const files = [
    "app/admin/(protected)/layout.tsx",
    "app/admin/(protected)/leads/page.tsx",
    "app/admin/(protected)/leads/[id]/page.tsx",
    "app/admin/(protected)/leads/[id]/actions.ts",
    "app/admin/(protected)/catalog/[resource]/page.tsx",
    "app/admin/(protected)/catalog/actions.ts",
    "app/admin/(protected)/templates/page.tsx",
    "app/admin/(protected)/templates/actions.ts",
    "app/admin/(protected)/operations/bookings/page.tsx",
    "app/admin/(protected)/operations/documents/page.tsx",
    "app/admin/(protected)/operations/actions.ts",
    "app/admin/(protected)/payments/page.tsx",
    "app/admin/(protected)/logs/page.tsx",
    "app/admin/(protected)/logs/actions.ts",
    "app/admin/(protected)/data-quality/page.tsx",
  ];
  const combined = files.map((file) => readFileSync(file, "utf8")).join("\n");

  assert.match(combined, /requireAdminRole\(\["admin", "asesor"\]\)/);
  assert.match(combined, /requireAdminRole\(\["admin", "marketing"\]\)/);
  assert.match(combined, /requireAdminRole\(\["admin", "operaciones"\]\)/);
  assert.match(combined, /requireAdminRole\(\["admin", "finanzas"\]\)/);
  assert.match(combined, /requireAdminRole\(\["admin", "marketing", "asesor"\]\)/);
  assert.match(combined, /requireAdminRole\(\["admin"\]\)/);
  assert.doesNotMatch(combined, /service-role|SUPABASE_SECRET_KEY|createServiceRoleClient|@\/lib\/supabase\/service/);
});

test("admin lead follow-up actions stay role gated and auditable", () => {
  const actions = readFileSync("app/admin/(protected)/leads/[id]/actions.ts", "utf8");
  const page = readFileSync("app/admin/(protected)/leads/[id]/page.tsx", "utf8");

  assert.match(actions, /export async function registerFollowUpAction/);
  assert.match(actions, /requireAdminRole\(\["admin", "asesor"\]\)/);
  assert.match(actions, /from\("lead_notes"\)\.insert/);
  assert.match(actions, /"follow_up_registered"/);
  assert.match(actions, /Number\.isNaN\(parsed\.getTime\(\)\)/);
  assert.match(page, /name="followUpBody"/);
  assert.match(page, /name="followUpAt"/);
});

test("WhatsApp template renderer fills known variables and removes missing ones", () => {
  const variables = leadTemplateVariables({ contactName: "Ada", destination: "Riviera Maya", travelersCount: 3, advisorName: null });
  const rendered = renderWhatsAppTemplate("Hola {{ name }}, viaje: {{destination}} / {{travelers}} / {{advisor}} / {{missing}}", variables);

  assert.equal(rendered, "Hola Ada, viaje: Riviera Maya / 3 / AC Travel /");
});

test("next config defines baseline security headers", () => {
  const source = readFileSync("next.config.ts", "utf8");

  assert.match(source, /X-Frame-Options/);
  assert.match(source, /DENY/);
  assert.match(source, /X-Content-Type-Options/);
  assert.match(source, /nosniff/);
  assert.match(source, /Referrer-Policy/);
  assert.match(source, /strict-origin-when-cross-origin/);
  assert.match(source, /Permissions-Policy/);
  assert.match(source, /camera=\(\), microphone=\(\), geolocation=\(\)/);
  assert.match(source, /source: "\/es\/:path\*"/);
  assert.match(source, /source: "\/en\/:path\*"/);
  assert.match(source, /Content-Language/);
  assert.match(source, /value: "es"/);
  assert.match(source, /value: "en"/);
});
