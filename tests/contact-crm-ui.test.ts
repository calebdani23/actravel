import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("contact-first CRM exposes canonical aggregation, separate currencies, and required filters", () => {
  const layer = read("lib/admin/contacts.ts");
  const page = read("app/admin/(protected)/leads/page.tsx");
  for (const field of ["openOpportunityCount", "totalOpportunityCount", "featuredOpportunityCount", "requestCount", "overdueCount", "duplicateRisk", "pipelineMxn", "pipelineUsd"]) assert.match(layer, new RegExp(field));
  for (const filter of ["lifecycle", "blocked", "advisor", "open", "overdue", "duplicate", "destination", "source", "deleted"]) assert.match(page, new RegExp(filter));
  assert.match(page, /Contactos CRM/);
  assert.match(page, /Móvil|mobile|lg:hidden/);
  assert.match(page, /Múltiples solicitudes/);
});

test("Contact 360 groups RPC-backed opportunities and operational context without removing lead compatibility", () => {
  const detail = read("app/admin/(protected)/contacts/[id]/page.tsx");
  const leadDetail = read("app/admin/(protected)/leads/[id]/page.tsx");
  for (const section of ["Oportunidades", "Solicitud del cliente", "Cotización comercial", "Contexto operativo", "Actividad reciente"]) assert.match(detail, new RegExp(section));
  assert.match(detail, /SelectableRow/);
  assert.match(detail, /Cargar más oportunidades/);
  assert.match(detail, /acceptedQuote \?\? opportunity\.latestQuote/);
  assert.match(leadDetail, /admin\/contacts\/\$\{lead\.contact_id\}/);
  assert.match(leadDetail, /Purga permanente/);
  assert.match(leadDetail, /Eliminar del CRM/);
});

test("Contact 360 exposes granular section diagnostics instead of a generic CRM error", () => {
  const layer = read("lib/admin/contacts.ts");
  const detail = read("app/admin/(protected)/contacts/[id]/page.tsx");
  for (const section of ["summary", "opportunities", "payments", "bookings", "documents", "activity"]) assert.match(layer, new RegExp(`${section}:`));
  assert.match(layer, /logReadError\("contact-360"/);
  assert.match(layer, /warnings: Contact360Warning\[\]/);
  assert.doesNotMatch(detail, /title="Carga incompleta"/);
  assert.doesNotMatch(detail, /error\.message|error\}/);
});

test("CRM selection stays inside a client context without Server Component render props", () => {
  const selection = read("components/admin/contacts/contact-selection.tsx");
  const toolbar = read("components/admin/contacts/bulk-toolbar.tsx");
  const leads = read("app/admin/(protected)/leads/page.tsx");
  const detail = read("app/admin/(protected)/contacts/[id]/page.tsx");

  assert.match(selection, /createContext<SelectionContextValue \| null>\(null\)/);
  assert.match(selection, /children: ReactNode/);
  assert.match(selection, /<ContactSelectionScope key=\{JSON\.stringify\(props\.ids\)\} \{\.\.\.props\} \/>/);
  assert.doesNotMatch(selection, /children:\s*\([^)]*selected/);
  assert.doesNotMatch(selection, /children\(/);
  for (const contextMember of ["selected", "toggle", "selectPage", "clear"]) assert.match(selection, new RegExp(`${contextMember}:`));
  assert.match(selection, /checked=\{selection\.selected\.includes\(id\)\}/);
  assert.match(selection, /selection\.toggle\(id, event\.target\.checked\)/);
  assert.match(selection, /SelectableRow must be rendered inside ContactSelection/);

  assert.equal((toolbar.match(/useContactSelectionContext\(\)/g) ?? []).length, 2);
  assert.equal((toolbar.match(/selectedProp \?\? selection\?\.selected \?\? \[\]/g) ?? []).length, 2);
  assert.match(detail, /<ContactBulkToolbar[^>]*selected=\{\[contact\.id\]\}/);
  assert.doesNotMatch(leads, /<ContactBulkToolbar[^>]*\bselected=/);
  assert.doesNotMatch(detail, /<OpportunityBulkToolbar[^>]*\bselected=/);

  for (const serverPage of [leads, detail]) {
    assert.doesNotMatch(serverPage, /<ContactSelection[^>]*>\s*\{\s*\([^)]*\)\s*=>/);
    assert.doesNotMatch(serverPage, /\{\s*\(\s*selected\s*,\s*setSelected\s*\)\s*=>/);
    assert.doesNotMatch(serverPage, /selected\.includes|setSelected/);
    assert.match(serverPage, /<ContactSelection[\s\S]*<SelectableRow/);
  }
});

test("CRM bulk actions use server actions, server validation, typed confirmation, and OperationDialog", () => {
  const actions = read("app/admin/(protected)/contacts/actions.ts");
  const toolbar = read("components/admin/contacts/bulk-toolbar.tsx");
  assert.match(actions, /requireAdminRole\(\["admin"\]\)/);
  assert.doesNotMatch(actions, /slice\(0, 100\)/);
  assert.match(actions, /ELIMINAR/);
  assert.match(actions, /supabase\.rpc/);
  assert.match(toolbar, /useActionState/);
  assert.match(toolbar, /OperationDialog/);
  assert.doesNotMatch(toolbar, /window\.confirm/);
});
