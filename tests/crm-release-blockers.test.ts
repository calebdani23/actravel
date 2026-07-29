import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveContactIdentity } from "@/lib/leads/lead-intake-core";

const read = (path: string) => readFileSync(path, "utf8");

test("identity resolution never treats a deleted contact as a match", () => {
  const deleted = { id: "deleted", deleted_at: "2026-01-01T00:00:00.000Z", normalized_email: "ada@example.com", normalized_phone: null } as Parameters<typeof resolveContactIdentity>[0]["candidates"][number];
  const result = resolveContactIdentity({ candidates: [deleted], normalizedEmail: "ada@example.com", normalizedWhatsapp: "" });
  assert.equal(result.existingContactId, null);
  assert.equal(result.shouldCreateNewContact, true);
  assert.deepEqual(result.matchedContactIds, []);
});

test("release UI keeps soft delete, restore, and test-data purge contracts distinct", () => {
  const detail = read("app/admin/(protected)/leads/[id]/page.tsx");
  const actions = read("app/admin/(protected)/leads/[id]/actions.ts");
  const form = read("components/admin/leads/lead-delete-form.tsx");
  assert.match(detail, /softDeleteOpportunityAction/);
  assert.match(detail, /restoreOpportunityAction/);
  assert.match(detail, /Purga permanente de datos de prueba/);
  assert.match(actions, /TEST_DATA_PURGE_CONFIRMATION/);
  assert.match(actions, /p_confirmation: TEST_DATA_PURGE_CONFIRMATION/);
  assert.match(form, /name="confirmation"/);
  assert.match(form, /PURGAR DATOS DE PRUEBA/);
});

test("bulk CRM toolbars are explicitly admin-gated while advisor server gates remain", () => {
  const leads = read("app/admin/(protected)/leads/page.tsx");
  const contact = read("app/admin/(protected)/contacts/[id]/page.tsx");
  const toolbar = read("components/admin/contacts/bulk-toolbar.tsx");
  assert.match(leads, /isAdmin = session\.roles\.includes\("admin"\)/);
  assert.match(leads, /ContactBulkToolbar isAdmin=\{isAdmin\}/);
  assert.match(contact, /OpportunityBulkToolbar isAdmin=\{isAdmin\}/);
  assert.match(toolbar, /if \(!isAdmin \|\| !selected\.length\) return null/);
  assert.match(read("app/admin/(protected)/contacts/actions.ts"), /requireAdminRole\(\["admin"\]\)/);
});

test("authoritative aggregate excludes deleted opportunities from follow-up/activity and includes inbound WhatsApp", () => {
  const sql = read("db/migrations/0049_crm_contact_aggregate_filters.sql");
  assert.match(sql, /e\.event_type = 'follow_up_registered' and l\.deleted_at is null/);
  assert.match(sql, /whatsapp_inbound_messages/);
  assert.match(sql, /where l\.deleted_at is null/);
});
