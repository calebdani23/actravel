import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  metaLeadEventId: undefined,
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
  const actionForm = readFileSync("components/admin/logs/log-action-form.tsx", "utf8");

  assert.match(actions, /requireAdminRole\(\["admin", "marketing"\]\)/);
  assert.match(actions, /retryNotificationLog\(logId\(formData\), session\.user\.id\)/);
  assert.match(actions, /setNotificationIncidentStatus\(logId\(formData\), incidentStatus\(formData\), session\.user\.id\)/);
  assert.equal(actions.indexOf("await requireAdminRole") < actions.indexOf("retryNotificationLog(logId(formData), session.user.id)"), true);
  assert.match(actions, /sanitizeLogActionError\("retry", error\)/);
  assert.match(actionForm, /name="logId"/);
  assert.match(actionForm, /name="incidentStatus"/);
  assert.match(actionForm, /useActionState\(action, initialLogActionState\)/);
  assert.match(actionForm, /AlertBanner/);
  assert.match(page, /const canRetry = status === "failed" \|\| status === "queued"/);
});

test("admin proxy refreshes Supabase sessions and keeps role checks out of redirects", () => {
  const source = readFileSync("proxy.ts", "utf8");
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

test("admin app keeps role allowlists and confines the service client to a server-only action", () => {
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
    "app/admin/(protected)/quotes/actions.ts",
    "app/admin/(protected)/data-quality/page.tsx",
  ];
  const combined = files.map((file) => readFileSync(file, "utf8")).join("\n");
  const quoteActions = readFileSync("app/admin/(protected)/quotes/actions.ts", "utf8");
  const adminClient = readFileSync("lib/supabase/admin.ts", "utf8");

  assert.match(combined, /requireAdminRole\(\["admin", "asesor"\]\)/);
  assert.match(combined, /requireAdminRole\(\["admin", "marketing"\]\)/);
  assert.match(combined, /requireAdminRole\(\["admin", "operaciones"\]\)/);
  assert.match(combined, /requireAdminRole\(\["admin", "finanzas"\]\)/);
  assert.match(combined, /requireAdminRole\(\["admin", "marketing", "asesor"\]\)/);
  assert.match(combined, /requireAdminRole\(\["admin"\]\)/);
  assert.match(quoteActions, /^"use server";[\s\S]*createSupabaseAdminClient/);
  assert.match(adminClient, /import "server-only"/);
  assert.doesNotMatch(quoteActions, /SUPABASE_SECRET_KEY|formData\.get\("(?:serviceRoleKey|supabaseSecretKey)"\)/);
  assert.doesNotMatch(combined, /service-role|SUPABASE_SECRET_KEY|createServiceRoleClient|@\/lib\/supabase\/service/);
});

test("standalone quote actions reject operations and finance mutation at both route and RPC boundaries", () => {
  const actions = readFileSync("app/admin/(protected)/quotes/actions.ts", "utf8");
  const rpcMigration = readFileSync("db/migrations/0055_quote_transactional_rpc_contracts.sql", "utf8");

  assert.match(actions, /requireAdminRole\(\["admin", "asesor"\]\)/);
  assert.doesNotMatch(actions, /"operaciones"|"finanzas"/);
  assert.match(rpcMigration, /public\.has_role\('asesor'\)[\s\S]*assigned_to/);
  assert.doesNotMatch(rpcMigration, /has_role\('(operaciones|finanzas)'\)/);
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
  assert.equal(existsSync("app/admin/(protected)/leads/[id]/quote-version-actions.ts"), false);
  assert.equal(existsSync("components/admin/leads/quote-version-forms.tsx"), false);
});

test("lead deletion has no direct authenticated DELETE policy exposure", () => {
  const baseRls = readFileSync("db/migrations/0008_rls.sql", "utf8");
  const guardrails = readFileSync("db/migrations/0039_admin_lead_delete_guardrails.sql", "utf8");
  const followup = readFileSync("db/migrations/0040_drop_direct_lead_delete_policy.sql", "utf8");
  const orphanCleanup = readFileSync("db/migrations/0041_admin_orphan_contact_cleanup.sql", "utf8");

  assert.match(baseRls, /create policy "lead write scoped" on public\.leads for all to authenticated/i);
  assert.match(guardrails, /drop policy if exists "lead write scoped" on public\.leads;/);
  assert.match(guardrails, /create policy "lead insert scoped"/);
  assert.match(guardrails, /create policy "lead update scoped"/);
  assert.doesNotMatch(guardrails, /for delete\s+to authenticated/i);
  assert.doesNotMatch(guardrails, /create policy "lead delete admin only"/i);
  assert.match(followup, /drop policy if exists "lead delete admin only" on public\.leads;/);
  assert.match(baseRls, /create policy "crm contact write" on public\.contacts for all to authenticated/i);
  assert.match(orphanCleanup, /drop policy if exists "crm contact write" on public\.contacts;/);
  assert.match(orphanCleanup, /create policy "crm contact insert"[\s\S]*for insert/i);
  assert.match(orphanCleanup, /create policy "crm contact update"[\s\S]*for update/i);
  assert.doesNotMatch(orphanCleanup, /on public\.contacts[\s\S]*for delete\s+to authenticated/i);
  assert.doesNotMatch(orphanCleanup, /create policy "crm contact write"[\s\S]*for all/i);
});

test("WhatsApp template renderer fills known variables and removes missing ones", () => {
  const variables = leadTemplateVariables({ contactName: "Ada", destination: "Riviera Maya", travelersCount: 3, advisorName: null });
  const rendered = renderWhatsAppTemplate("Hola {{ name }}, viaje: {{destination}} / {{travelers}} / {{advisor}} / {{missing}}", variables);

  assert.equal(rendered, "Hola Ada, viaje: Riviera Maya / 3 / AC Travel /");
});

test("quote PDFs bypass Server Action bodies and retain the 20 MB browser/server limit", () => {
  const config = readFileSync("next.config.ts", "utf8");
  const quotePdf = readFileSync("lib/admin/quote-pdf-client.ts", "utf8");
  const quoteUpload = readFileSync("components/admin/quotes/quote-pdf-upload.tsx", "utf8");
  const actions = readFileSync("app/admin/(protected)/quotes/actions.ts", "utf8");

  assert.doesNotMatch(config, /bodySizeLimit|serverActions/);
  assert.match(quotePdf, /QUOTE_PDF_MAX_SIZE_BYTES = 20 \* 1024 \* 1024/);
  assert.match(quotePdf, /file\.size > QUOTE_PDF_MAX_SIZE_BYTES/);
  assert.match(quotePdf, /límite de 20 MB/);
  assert.match(quoteUpload, /Solo PDF, máximo 20 MB/);
  assert.doesNotMatch(actions, /File|formData\.get\("pdf"\)|\.upload\([^)]*file/);
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
