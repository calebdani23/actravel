import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  blockedContactDeletionItems,
  contactDeletionBlockedMessage,
  contactDeletionCountsFromJson,
  emptyContactDeletionCounts,
  blockedLeadDeletionItems,
  countMeaningfulLeadNotes,
  formatContactDeletionBlockerList,
  emptyLeadDeletionCounts,
  leadDeleteBlockerCountsFromJson,
  formatLeadDeletionBlockerList,
  isMeaningfulLeadNoteBody,
  leadDeletionBlockedMessage,
  leadDeletionCountsFromJson,
  safeLeadListQueryString,
  sanitizeLeadDeleteActionError,
} from "@/lib/admin/lead-delete";

test("lead deletion blocker helpers expose safe Spanish counts without raw IDs or SQL", () => {
  const counts = leadDeletionCountsFromJson({
    quoteVersions: 2,
    quoteRequests: 1,
    payments: 1,
    bookings: 0,
    documents: 3,
    leadNotes: 0,
    notificationLogs: 1,
    whatsappClicks: 0,
    whatsappInboundMessages: 0,
    sheetSyncLogs: 2,
    leadEvents: 4,
  });

  assert.deepEqual(formatLeadDeletionBlockerList(counts), [
    "2 cotizaciones comerciales",
    "1 solicitud de cotización",
    "1 pago",
    "3 documentos",
    "1 notificación operativa",
    "2 sincronizaciones operativas",
    "4 eventos comerciales",
  ]);
  assert.match(leadDeletionBlockedMessage(counts), /Recomendamos conservarla o archivarla/);
  assert.doesNotMatch(leadDeletionBlockedMessage(counts), /[0-9a-f]{8}-[0-9a-f-]{27}|select|delete|relation|postgres/i);
});

test("lead deletion helpers only block material dependencies and default missing counts to zero", () => {
  const counts = leadDeletionCountsFromJson({ payments: 1, bogus: 99 });
  const blockers = blockedLeadDeletionItems(counts);

  assert.equal(blockers.length, 1);
  assert.deepEqual(blockers[0], { key: "payments", count: 1, label: "1 pago" });
  assert.deepEqual(emptyLeadDeletionCounts().quoteVersions, 0);
});

test("contact deletion helpers expose safe Spanish blockers and preserve empty defaults", () => {
  const counts = contactDeletionCountsFromJson({
    otherLeads: 1,
    quoteRequests: 2,
    notifications: 99,
    notificationLogs: 1,
    whatsappInboundMessages: 3,
  });

  assert.deepEqual(formatContactDeletionBlockerList(counts), [
    "1 otra oportunidad",
    "2 solicitudes de cotización",
    "1 notificación operativa",
    "3 mensajes entrantes de WhatsApp",
  ]);
  assert.equal(blockedContactDeletionItems(emptyContactDeletionCounts()).length, 0);
  assert.match(contactDeletionBlockedMessage(counts), /Conservamos ambos registros para proteger el historial/);
  assert.doesNotMatch(contactDeletionBlockedMessage(counts), /contact-|lead-|delete|select|postgres/i);
});

test("lead delete RPC counts parser supports nested lead and contact blocker payloads", () => {
  const parsed = leadDeleteBlockerCountsFromJson({
    lead: { payments: 1, leadEvents: 2 },
    contact: { otherLeads: 1, documents: 3 },
  });

  assert.equal(parsed.lead.payments, 1);
  assert.equal(parsed.lead.leadEvents, 2);
  assert.equal(parsed.contact.otherLeads, 1);
  assert.equal(parsed.contact.documents, 3);
  assert.equal(parsed.contact.quoteVersions, 0);
});

test("lead deletion note helpers only count non-blank note bodies", () => {
  assert.equal(isMeaningfulLeadNoteBody("  "), false);
  assert.equal(isMeaningfulLeadNoteBody(" Seguimiento real "), true);
  assert.equal(
    countMeaningfulLeadNotes([{ body: "" }, { body: "   " }, { body: null }, { body: "Nota útil" }]),
    1,
  );
});

test("lead delete query preservation only keeps safe list query strings", () => {
  assert.equal(safeLeadListQueryString("?status=qualified&advisor=ada"), "?status=qualified&advisor=ada");
  assert.equal(safeLeadListQueryString("/admin/leads?status=qualified"), "");
  assert.equal(safeLeadListQueryString("https://evil.example"), "");
});

test("lead delete error sanitization hides backend internals", () => {
  assert.equal(sanitizeLeadDeleteActionError(new Error("Lead not found")), "La oportunidad ya no está disponible.");
  assert.equal(
    sanitizeLeadDeleteActionError(new Error("relation leads does not exist for id 123e4567-e89b-12d3-a456-426614174000")),
    "No se pudo eliminar la oportunidad. Intenta nuevamente.",
  );
});

test("admin lead deletion stays admin-only across UI, server action, migration, and generated types", () => {
  const actions = readFileSync("app/admin/(protected)/leads/[id]/actions.ts", "utf8");
  const page = readFileSync("app/admin/(protected)/leads/[id]/page.tsx", "utf8");
  const form = readFileSync("components/admin/leads/lead-delete-form.tsx", "utf8");
  const actionState = readFileSync("app/admin/(protected)/leads/[id]/lead-delete-action-state.ts", "utf8");
  const migration = readFileSync("db/migrations/0039_admin_lead_delete_guardrails.sql", "utf8");
  const followupMigration = readFileSync("db/migrations/0040_drop_direct_lead_delete_policy.sql", "utf8");
  const orphanCleanupMigration = readFileSync("db/migrations/0041_admin_orphan_contact_cleanup.sql", "utf8");
  const databaseTypes = readFileSync("lib/supabase/database.types.ts", "utf8");

  assert.match(actions, /export async function deleteLeadAction/);
  assert.match(actions, /requireAdminRole\(\["admin"\]\)/);
  assert.match(actions, /rpc\("crm_delete_lead_guarded"/);
  assert.match(actions, /p_delete_orphan_contact: deleteOrphanContact/);
  assert.match(actions, /p_confirmation: TEST_DATA_PURGE_CONFIRMATION/);
  assert.match(actions, /contactDeletionBlockedMessage/);
  assert.match(actions, /contactBlockers\.map\(\(item\) => `Contacto: \$\{item\}`\)/);
  assert.match(actions, /let redirectTarget: string \| null = null;/);
  assert.match(actions, /redirectTarget = `\/admin\/leads\$\{returnToQuery\}`;/);
  assert.match(actions, /if \(redirectTarget\) redirect\(redirectTarget\);/);

  assert.match(page, /hasAnyRole\(session\.roles, \["admin"\]\)/);
  assert.match(page, /LeadDeleteForm/);
  assert.match(page, /solo puede eliminarse de forma opcional si queda totalmente huérfano/i);
  assert.match(page, /preservar o archivar la oportunidad/i);

  assert.match(form, /useActionState\(deleteLeadAction, initialLeadDeleteActionState\)/);
  assert.match(form, /Eliminar también el contacto si queda huérfano/);
  assert.match(form, /Solo disponible cuando no existen otras oportunidades ni historial material relacionado\./);
  assert.match(form, /aria-describedby/);
  assert.match(form, /disabled=\{pending\}/);
  assert.doesNotMatch(form, /window\.confirm|window\.alert/);
  assert.match(actionState, /LeadDeleteActionState/);
  assert.match(actionState, /contactDeleteRequested: boolean/);

  assert.match(migration, /drop policy if exists "lead write scoped" on public\.leads;/);
  assert.match(migration, /create policy "lead insert scoped"/);
  assert.match(migration, /create policy "lead update scoped"/);
  assert.match(migration, /drop policy if exists "lead delete admin only" on public\.leads;/);
  assert.doesNotMatch(migration, /create policy "lead delete admin only"/);
  assert.doesNotMatch(migration, /create policy "lead write scoped"[\s\S]*for all/i);
  assert.match(migration, /create table if not exists public\.admin_lead_deletion_audit/);
  assert.match(migration, /create or replace function public\.crm_delete_lead_guarded/);
  assert.match(migration, /insert into public\.admin_lead_deletion_audit[\s\S]*delete from public\.leads/i);
  assert.match(migration, /nullif\(trim\(body\), ''\) is not null/);
  assert.match(migration, /quote_versions/);
  assert.match(migration, /quote_requests/);
  assert.match(migration, /payments/);
  assert.match(migration, /bookings/);
  assert.match(migration, /documents/);
  assert.match(migration, /notification_logs/);
  assert.match(migration, /whatsapp_clicks/);
  assert.match(migration, /whatsapp_inbound_messages/);
  assert.match(migration, /sheet_sync_logs/);
  assert.match(migration, /event_type <> 'manual_lead_created'/);
  assert.match(migration, /revoke all on function public\.crm_delete_lead_guarded\(uuid\) from public/);
  assert.doesNotMatch(migration, /delete from public\.contacts/i);
  assert.match(followupMigration, /drop policy if exists "lead delete admin only" on public\.leads;/);
  assert.match(orphanCleanupMigration, /drop function if exists public\.crm_delete_lead_guarded\(uuid\);/);
  assert.match(orphanCleanupMigration, /create or replace function public\.crm_delete_lead_guarded\([\s\S]*p_delete_orphan_contact boolean default false/i);
  assert.match(orphanCleanupMigration, /returns table\([\s\S]*contact_deleted boolean/i);
  assert.match(orphanCleanupMigration, /other_lead_count/);
  assert.match(orphanCleanupMigration, /contact_quote_version_count/);
  assert.match(orphanCleanupMigration, /contact_quote_request_count/);
  assert.match(orphanCleanupMigration, /contact_booking_count/);
  assert.match(orphanCleanupMigration, /contact_payment_count/);
  assert.match(orphanCleanupMigration, /contact_document_count/);
  assert.match(orphanCleanupMigration, /contact_notification_count/);
  assert.match(orphanCleanupMigration, /contact_whatsapp_click_count/);
  assert.match(orphanCleanupMigration, /contact_whatsapp_inbound_count/);
  assert.match(orphanCleanupMigration, /if p_delete_orphan_contact and contact_reasons <> '\[\]'::jsonb then/);
  assert.match(orphanCleanupMigration, /insert into public\.admin_lead_deletion_audit[\s\S]*contact_deleted[\s\S]*delete from public\.leads[\s\S]*delete from public\.contacts/i);
  assert.match(orphanCleanupMigration, /contactSnapshot/);
  assert.match(orphanCleanupMigration, /deleteOrphanContactRequested/);
  assert.match(orphanCleanupMigration, /revoke all on function public\.crm_delete_lead_guarded\(uuid, boolean\) from public/);

  const auditTableSection = migration.slice(
    migration.indexOf("create table if not exists public.admin_lead_deletion_audit"),
    migration.indexOf("create index if not exists admin_lead_deletion_audit_deleted_at_idx"),
  );
  assert.doesNotMatch(auditTableSection, /references public\.leads\(id\)/i);

  assert.match(databaseTypes, /admin_lead_deletion_audit/);
  assert.match(databaseTypes, /crm_delete_lead_guarded/);
  assert.match(databaseTypes, /contact_deleted: boolean/);
  assert.match(databaseTypes, /p_delete_orphan_contact: boolean/);
  assert.match(databaseTypes, /p_confirmation: string/);
  assert.match(databaseTypes, /contact_blocker_counts: Json/);
});
