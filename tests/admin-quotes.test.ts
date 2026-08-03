import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ADMIN_NAV_ITEMS } from "@/components/admin/admin-nav";
import type { RoleName } from "@/lib/supabase/roles";

const read = (path: string) => readFileSync(path, "utf8");
const portfolio = read("app/admin/(protected)/quotes/page.tsx");
const createPage = read("app/admin/(protected)/quotes/new/page.tsx");
const detail = read("app/admin/(protected)/quotes/[id]/page.tsx");
const quoteActions = read("app/admin/(protected)/quotes/actions.ts");
const contactDetail = read("app/admin/(protected)/contacts/[id]/page.tsx");
const opportunityDetail = read("app/admin/(protected)/leads/[id]/page.tsx");
const bookings = read("app/admin/(protected)/operations/bookings/page.tsx");
const payments = read("app/admin/(protected)/payments/page.tsx");
const operationActions = read("app/admin/(protected)/operations/actions.ts");
const shell = read("components/admin/admin-shell-client.tsx");
const migration = read("db/migrations/0057_quote_rpc_cutover.sql");
const cutover = read("db/migrations/0060_quote_pdf_creation_cutover.sql");

function filesBelow(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? filesBelow(child) : [child];
  });
}

test("Commercial navigation has exact quote order and role matrix", () => {
  const commercial = ADMIN_NAV_ITEMS.filter((item) => item.group === "Comercial");
  assert.deepEqual(commercial.map((item) => item.label), ["Prospectos", "Pagos", "Reservas", "Cotizaciones", "Documentos"]);
  const visible = (role: RoleName) => commercial.filter((item) => (item.roles as readonly RoleName[]).includes(role)).map((item) => item.label);
  assert.deepEqual(visible("admin"), ["Prospectos", "Pagos", "Reservas", "Cotizaciones", "Documentos"]);
  assert.deepEqual(visible("asesor"), ["Prospectos", "Cotizaciones"]);
  assert.deepEqual(visible("operaciones"), ["Reservas", "Cotizaciones", "Documentos"]);
  assert.deepEqual(visible("finanzas"), ["Pagos", "Cotizaciones"]);
  assert.deepEqual(visible("marketing"), []);
  assert.match(shell, /pathname === "\/admin\/quotes"/);
  assert.match(shell, /pathname === "\/admin\/quotes\/new"/);
  assert.match(shell, /\^\\\/admin\\\/quotes\\\/\[\^\/\]\+\$/);
});

test("standalone quote routes enforce read and mutation roles", () => {
  assert.match(portfolio, /requireAdminRole\(\["admin", "asesor", "operaciones", "finanzas"\]\)/);
  assert.match(detail, /requireAdminRole\(\["admin", "asesor", "operaciones", "finanzas"\]\)/);
  assert.match(createPage, /requireAdminRole\(\["admin", "asesor"\]\)/);
  for (const source of [portfolio, detail]) assert.match(source, /canMutate/);
  assert.match(detail, /canMutate && currentVersion/);
  assert.match(detail, /<QuoteLifecyclePanel canMutate=\{false\}/);
  assert.match(detail, /currentVersion\?\.status === "draft"/);
  assert.doesNotMatch(`${portfolio}\n${detail}`, /hasRole\('marketing'\)|"marketing"\]/);
});

test("portfolio and detail expose bounded filters, responsive views, and independent keyset cursors", () => {
  for (const filter of ["q", "status", "advisor", "currency", "validity", "pdf", "view", "contactId", "opportunityId"]) {
    assert.match(portfolio, new RegExp(`"${filter}"`));
  }
  for (const view of ["drafts", "ready", "sent", "accepted", "expiring", "missing_pdf"]) assert.match(portfolio, new RegExp(`"${view}"`));
  assert.match(portfolio, /afterUpdatedAt/);
  assert.match(portfolio, /afterId/);
  assert.match(portfolio, /lg:hidden/);
  assert.match(portfolio, /hidden overflow-x-auto lg:block/);
  assert.match(portfolio, /<caption className="sr-only"/);
  assert.match(portfolio, /Versión actual/);
  assert.match(portfolio, /Versión aceptada/);
  for (const cursor of ["versionAfterNumber", "versionAfterId", "requestAfterCreatedAt", "requestAfterId", "eventAfterCreatedAt", "eventAfterId"]) {
    assert.match(detail, new RegExp(cursor));
  }
  assert.match(detail, /pageHref\(id, query,/);
  assert.match(detail, /PDF canónico/);
  assert.match(detail, /payloads internos/);
});

test("new quote route is progressive, accessible, and preserves request separation", () => {
  const form = read("components/admin/quotes/quote-editor-form.tsx");
  assert.match(createPage, /<Suspense fallback=\{<QuoteFormFallback \/>\}>/);
  assert.match(createPage, /contactId/);
  assert.match(createPage, /opportunityId/);
  assert.match(createPage, /requestId/);
  assert.match(createPage, /El PDF inicial es obligatorio/);
  assert.match(form, /aria-describedby="quote-create-status quote-create-help quote-create-progress"/);
  assert.match(form, /<legend className="sr-only">Contenido comercial/);
  assert.match(form, /Solicitud de origen \(opcional\)/);
  assert.match(form, /Crear cotización con PDF/);
  assert.match(form, /name="pdf"[\s\S]*required/);
});

test("CRM pages link to standalone quotes and no rendered page imports the legacy writers", () => {
  assert.match(contactDetail, /getOpportunityQuoteNavigation/);
  assert.match(contactDetail, /\/admin\/quotes\/new\?contactId=/);
  assert.match(contactDetail, /\/admin\/quotes\/\$\{quoteId\}/);
  assert.match(opportunityDetail, /Ver portafolio de la oportunidad/);
  assert.match(opportunityDetail, /Nueva cotización/);
  assert.match(opportunityDetail, /Solicitudes del cliente/);
  assert.doesNotMatch(opportunityDetail, /QuoteVersionCreateDialog|QuoteVersionActionForm|quote-version-actions/);

  const renderedSources = filesBelow("app").filter((path) => path.endsWith(".tsx")).map(read).join("\n");
  assert.doesNotMatch(renderedSources, /from\("quote_versions"\)\.(insert|update|delete|upsert)/);
  assert.doesNotMatch(renderedSources, /quote-version-actions/);
});

test("accepted quote handoff prefills traceable operations without auto-creation", () => {
  for (const source of [bookings, payments]) {
    assert.match(source, /getAcceptedQuoteHandoffByVersion/);
    assert.match(source, /acceptedQuoteVersionId/);
    assert.match(source, /name="accepted_quote_version_id"/);
    assert.match(source, /name="quote_id"/);
    assert.match(source, /!options\.contacts\.some\(\(contact\) => contact\.id === handoff\.contact\.id\)/);
    assert.match(source, /!options\.leads\.some\(\(lead\) => lead\.id === handoff\.opportunity\.id\)/);
    assert.match(source, /no se crea ning/i);
    assert.match(source, /\/admin\/quotes\/\$\{/);
  }
  assert.match(operationActions, /accepted_quote_version_id: text\(formData, "accepted_quote_version_id"\)/);
  assert.match(operationActions, /requireAdminRole\(\["admin", "operaciones"\]\)/);
  assert.match(operationActions, /requireAdminRole\(\["admin", "finanzas"\]\)/);
  assert.doesNotMatch(`${bookings}\n${payments}\n${operationActions}`, /crm_accept_quote/);
  assert.doesNotMatch(quoteActions, /from\("(quotes|quote_versions|quote_request_quote_links)"\)\.(insert|update|delete|upsert)/);
});

test("0057 historical cutover is superseded by 0060 compatibility removal", () => {
  assert.match(migration, /drop policy if exists "quote versions insert scoped"/i);
  assert.match(migration, /drop policy if exists "quote versions update scoped"/i);
  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger[\s\S]*public\.quote_versions[\s\S]*from authenticated/i);
  assert.match(migration, /grant select on table public\.quote_versions to authenticated/i);
  assert.match(migration, /create or replace function public\.crm_accept_quote_version/i);
  assert.match(migration, /from public\.crm_accept_quote\(/i);
  assert.doesNotMatch(migration, /update public\.quote_versions|insert into public\.quote_versions|delete from public\.quote_versions/i);
  assert.match(migration, /revoke all on function public\.crm_accept_quote_version\(uuid, uuid\)[\s\S]*public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.crm_accept_quote_version\(uuid, uuid\)[\s\S]*to authenticated/i);
  assert.match(cutover, /drop function public\.crm_accept_quote_version\(uuid, uuid\)/i);
  assert.match(cutover, /drop function public\.crm_create_quote/i);
  assert.match(cutover, /drop function public\.crm_link_legacy_quote_document/i);
});
