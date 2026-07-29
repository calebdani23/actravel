import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { leadSearchInternals } from "@/lib/admin/leads";
import { quoteVersionInternals } from "@/lib/admin/quote-versions";

// Live Supabase/Postgres integration coverage for RLS, RPC concurrency, and migration constraints remains pending.

test("quote version status transitions only allow approved sales workflow moves", () => {
  assert.equal(quoteVersionInternals.isValidQuoteVersionTransition("draft", "sent"), true);
  assert.equal(quoteVersionInternals.isValidQuoteVersionTransition("draft", "accepted"), true);
  assert.equal(quoteVersionInternals.isValidQuoteVersionTransition("sent", "accepted"), true);
  assert.equal(quoteVersionInternals.isValidQuoteVersionTransition("sent", "rejected"), true);
  assert.equal(quoteVersionInternals.isValidQuoteVersionTransition("accepted", "rejected"), false);
  assert.equal(quoteVersionInternals.isValidQuoteVersionTransition("expired", "accepted"), false);
  assert.equal(quoteVersionInternals.canMarkQuoteVersionSent("draft"), true);
  assert.equal(quoteVersionInternals.canMarkQuoteVersionSent("sent"), false);
  assert.equal(quoteVersionInternals.canRejectQuoteVersion("sent"), true);
  assert.equal(quoteVersionInternals.canExpireQuoteVersion("accepted"), false);
});

test("quote version validation accepts MXN/USD and keeps amounts/vigencia safe", () => {
  const valid = quoteVersionInternals.createQuoteVersionSchema.safeParse({
    leadId: "c56a4180-65aa-42ec-a945-5fd21dec0538",
    title: "Opción familiar",
    summary: "Hotel y vuelos",
    currency: "MXN",
    totalAmount: "50000",
    depositAmount: "15000",
    validUntil: "2026-08-15",
    idempotencyKey: "quote_version_abc123",
    notes: "Incluye seguro",
    quoteRequestId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  });
  const invalidCurrency = quoteVersionInternals.createQuoteVersionSchema.safeParse({
    leadId: "c56a4180-65aa-42ec-a945-5fd21dec0538",
    title: "Opción",
    currency: "EUR",
  });
  const invalidDeposit = quoteVersionInternals.createQuoteVersionSchema.safeParse({
    leadId: "c56a4180-65aa-42ec-a945-5fd21dec0538",
    title: "Opción",
    currency: "USD",
    totalAmount: "1000",
    depositAmount: "1200",
  });
  const invalidDate = quoteVersionInternals.createQuoteVersionSchema.safeParse({
    leadId: "c56a4180-65aa-42ec-a945-5fd21dec0538",
    title: "Opción",
    currency: "USD",
    validUntil: "15/08/2026",
  });

  assert.equal(valid.success, true);
  assert.equal(invalidCurrency.success, false);
  assert.equal(invalidDeposit.success, false);
  assert.equal(invalidDate.success, false);
});

test("quote version submission keys are stable, prefixed, and schema-safe", () => {
  const generated = quoteVersionInternals.createQuoteVersionSubmissionKey();
  const invalidKey = quoteVersionInternals.createQuoteVersionSchema.safeParse({
    leadId: "c56a4180-65aa-42ec-a945-5fd21dec0538",
    title: "Opción",
    currency: "USD",
    idempotencyKey: "bad key with spaces",
  });

  assert.match(generated, /^quote_version_[a-z0-9_]+$/i);
  assert.equal(invalidKey.success, false);
});

test("quote version amount helpers preserve balance and Spanish-safe labels", () => {
  assert.equal(quoteVersionInternals.quoteVersionStatusLabel("accepted"), "Aceptada");
  assert.equal(quoteVersionInternals.formatQuoteVersionAmount(2500, "USD"), "USD 2,500.00");
  assert.equal(quoteVersionInternals.quoteVersionBalance(50000, 15000), 35000);
  assert.equal(quoteVersionInternals.quoteVersionBalance(50000, null), 50000);
  assert.equal(
    quoteVersionInternals.quoteVersionConcurrencyMessage(),
    "La cotización cambió en otra sesión. Actualiza la página y vuelve a intentarlo.",
  );
});

test("quote version history builder keeps accepted option first and creator display safe", () => {
  const creatorNames = new Map([["user-1", "Ada"]]);
  const history = leadSearchInternals.buildQuoteVersionHistory([
    {
      accepted_at: null,
      created_at: "2026-07-21T10:00:00.000Z",
      created_by: null,
      currency: "MXN",
      deposit_amount: 1000,
      expired_at: null,
      id: "version-2",
      notes: null,
      quote_request_id: null,
      rejected_at: null,
      sent_at: null,
      status: "draft",
      summary: null,
      title: "Alternativa B",
      total_amount: 5000,
      updated_at: "2026-07-21T10:00:00.000Z",
      valid_until: null,
      version_number: 2,
    },
    {
      accepted_at: "2026-07-22T10:00:00.000Z",
      created_at: "2026-07-20T10:00:00.000Z",
      created_by: "user-1",
      currency: "MXN",
      deposit_amount: 1000,
      expired_at: null,
      id: "version-1",
      notes: null,
      quote_request_id: null,
      rejected_at: null,
      sent_at: "2026-07-20T12:00:00.000Z",
      status: "accepted",
      summary: null,
      title: "Alternativa A",
      total_amount: 4000,
      updated_at: "2026-07-22T10:00:00.000Z",
      valid_until: null,
      version_number: 1,
    },
  ], creatorNames);

  assert.equal(history[0]?.status, "accepted");
  assert.equal(history[0]?.createdByName, "Ada");
  assert.equal(history[1]?.createdByName, null);
});

test("quote version creation keeps idempotent retries stable and lead detail keeps request history distinct", () => {
  const actionSource = readFileSync("app/admin/(protected)/leads/[id]/quote-version-actions.ts", "utf8");
  const formSource = readFileSync("components/admin/leads/quote-version-forms.tsx", "utf8");
  const leadDetailSource = readFileSync("app/admin/(protected)/leads/[id]/page.tsx", "utf8");

  assert.match(actionSource, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/);
  assert.match(actionSource, /quote_versions_unique_per_lead_version/);
  assert.match(actionSource, /loadQuoteVersionByIdempotencyKey/);
  assert.match(actionSource, /idempotency_key: input\.idempotencyKey \?\? null/);
  assert.match(actionSource, /isUniqueIdempotencyError/);
  assert.match(formSource, /name="idempotencyKey"/);
  assert.match(formSource, /createQuoteVersionSubmissionKey/);
  assert.match(actionSource, /crm_accept_quote_version/);
  assert.match(leadDetailSource, /title="Cotizaciones comerciales"/);
  assert.match(leadDetailSource, /Solicitudes de viaje recibidas del cliente; no representan versiones de una cotización comercial de AC Travel\./);
  assert.match(leadDetailSource, /Con solicitud del cliente vinculada/);
  assert.doesNotMatch(leadDetailSource, /fake send email|provider_message_id|quote_request_id/i);
});

test("quote version acceptance contract rejects sibling active alternatives without destructive deletion", () => {
  const migrationSource = [
    readFileSync("db/migrations/0034_quote_versions.sql", "utf8"),
    readFileSync("db/migrations/0035_quote_version_integrity.sql", "utf8"),
  ].join("\n");

  assert.match(migrationSource, /where lead_id = p_lead_id/);
  assert.match(migrationSource, /and id <> target_version\.id/);
  assert.match(migrationSource, /and status in \('draft', 'sent', 'accepted'\)/);
  assert.match(migrationSource, /perform 1\s+from public\.quote_versions qv\s+where qv\.lead_id = p_lead_id\s+for update;/i);
  assert.match(migrationSource, /update public\.quote_versions\s+set status = 'rejected'[\s\S]*update public\.quote_versions\s+set status = 'accepted'/i);
  assert.match(migrationSource, /set status = 'rejected'/);
  assert.match(migrationSource, /quote_versions_one_accepted_per_lead_idx/);
  assert.doesNotMatch(migrationSource, /delete from public\.quote_versions/i);
});

test("quote version integrity migration enforces lead-contact-request scope, immutable relationships, and coherent timestamps", () => {
  const migrationSource = [
    readFileSync("db/migrations/0035_quote_version_integrity.sql", "utf8"),
    readFileSync("db/migrations/0036_quote_version_hardening_followup.sql", "utf8"),
  ].join("\n");

  assert.match(migrationSource, /new\.contact_id is distinct from lead_contact_id/i);
  assert.match(migrationSource, /request_row\.lead_id is distinct from new\.lead_id/i);
  assert.match(migrationSource, /request_row\.contact_id is distinct from new\.contact_id/i);
  assert.match(migrationSource, /Quote version relationships are immutable after creation/);
  assert.doesNotMatch(migrationSource, /current_setting\('app\.crm_quote_version_allow_relationship_update', true\)/i);
  assert.match(migrationSource, /elsif new\.status = 'accepted' then\s+new\.sent_at := coalesce\(new\.sent_at, previous_sent_at\);\s+new\.accepted_at := coalesce\(new\.accepted_at, previous_accepted_at, now\(\)\);\s+new\.rejected_at := null;\s+new\.expired_at := null;/i);
  assert.match(migrationSource, /elsif new\.status = 'rejected' then\s+new\.sent_at := coalesce\(new\.sent_at, previous_sent_at\);\s+new\.accepted_at := null;\s+new\.rejected_at := coalesce\(new\.rejected_at, previous_rejected_at, now\(\)\);\s+new\.expired_at := null;/i);
  assert.match(migrationSource, /elsif new\.status = 'expired' then\s+new\.sent_at := coalesce\(new\.sent_at, previous_sent_at\);\s+new\.accepted_at := null;\s+new\.rejected_at := null;\s+new\.expired_at := coalesce\(new\.expired_at, previous_expired_at, now\(\)\);/i);
  assert.match(migrationSource, /elsif new\.status = 'sent' then\s+new\.sent_at := coalesce\(new\.sent_at, previous_sent_at, now\(\)\);\s+new\.accepted_at := null;\s+new\.rejected_at := null;\s+new\.expired_at := null;/i);
  assert.match(migrationSource, /when status = 'draft' then sent_at is null and accepted_at is null and rejected_at is null and expired_at is null/i);
  assert.match(migrationSource, /when status = 'accepted' then accepted_at is not null and rejected_at is null and expired_at is null/i);
  assert.match(migrationSource, /changed_state := rejected_count > 0 or found;/i);
});

test("quote version migrations preserve history by blocking parent cascades and adding per-lead idempotency", () => {
  const migrationSource = [
    readFileSync("db/migrations/0034_quote_versions.sql", "utf8"),
    readFileSync("db/migrations/0036_quote_version_hardening_followup.sql", "utf8"),
  ].join("\n");

  assert.match(migrationSource, /lead_id uuid not null references public\.leads\(id\) on delete restrict/i);
  assert.match(migrationSource, /contact_id uuid not null references public\.contacts\(id\) on delete restrict/i);
  assert.match(migrationSource, /add constraint quote_versions_lead_id_fkey\s+foreign key \(lead_id\) references public\.leads\(id\) on delete restrict/i);
  assert.match(migrationSource, /add constraint quote_versions_contact_id_fkey\s+foreign key \(contact_id\) references public\.contacts\(id\) on delete restrict/i);
  assert.match(migrationSource, /add column if not exists idempotency_key text/i);
  assert.match(migrationSource, /create unique index if not exists quote_versions_lead_idempotency_key_idx/i);
  assert.doesNotMatch(migrationSource, /quote_versions\([^\n]*on delete cascade/i);
});

test("quote version workflow actions keep successful writes even if lead event logging fails", () => {
  const actionSource = readFileSync("app/admin/(protected)/leads/[id]/quote-version-actions.ts", "utf8");
  const formSource = readFileSync("components/admin/leads/quote-version-forms.tsx", "utf8");

  assert.match(actionSource, /async function insertLeadEventBestEffort/);
  assert.match(actionSource, /console\.warn\("\[quote-version\] lead event logging failed after successful write"/);
  assert.match(actionSource, /await insertLeadEventBestEffort\(parsed\.data\.leadId, session\.user\.id, "quote_version_created"/);
  assert.match(actionSource, /await insertLeadEventBestEffort\(leadId, session\.user\.id, "quote_version_sent"/);
  assert.match(actionSource, /await insertLeadEventBestEffort\(leadId, sessionUserId, nextStatus === "rejected" \? "quote_version_rejected" : "quote_version_expired"/);
  assert.doesNotMatch(formSource, /window\.confirm/);
  assert.match(formSource, /<OperationDialog[\s\S]*description=\{confirmMessage\}/i);
});

test("quote version action state lives outside the use server module", () => {
  const actionSource = readFileSync("app/admin/(protected)/leads/[id]/quote-version-actions.ts", "utf8");
  const stateSource = readFileSync("app/admin/(protected)/leads/[id]/quote-version-action-state.ts", "utf8");
  const formSource = readFileSync("components/admin/leads/quote-version-forms.tsx", "utf8");

  assert.doesNotMatch(actionSource, /export const initialQuoteVersionActionState/);
  assert.doesNotMatch(actionSource, /export type QuoteVersionActionState/);
  assert.doesNotMatch(actionSource, /quote-version-actions";[\s\S]*initialQuoteVersionActionState/);
  assert.match(stateSource, /export type QuoteVersionActionState = \{/);
  assert.match(stateSource, /export const initialQuoteVersionActionState: QuoteVersionActionState = \{/);
  assert.match(stateSource, /fieldErrors: \{\}/);
  assert.match(formSource, /from "@\/app\/admin\/\(protected\)\/leads\/\[id\]\/quote-version-action-state"/);
});

test("lead detail passes direct server action references and client forms avoid action maps", () => {
  const leadDetailSource = readFileSync("app/admin/(protected)/leads/[id]/page.tsx", "utf8");
  const formSource = readFileSync("components/admin/leads/quote-version-forms.tsx", "utf8");

  assert.match(leadDetailSource, /import \{ acceptQuoteVersionAction, expireQuoteVersionAction, markQuoteVersionSentAction, rejectQuoteVersionAction \} from "\.\/quote-version-actions";/);
  assert.match(leadDetailSource, /<QuoteVersionActionForm action=\{markQuoteVersionSentAction\}/);
  assert.match(leadDetailSource, /<QuoteVersionActionForm action=\{acceptQuoteVersionAction\}/);
  assert.match(leadDetailSource, /<QuoteVersionActionForm action=\{rejectQuoteVersionAction\}/);
  assert.match(leadDetailSource, /<QuoteVersionActionForm action=\{expireQuoteVersionAction\}/);
  assert.doesNotMatch(leadDetailSource, /quoteVersionActionForms/);
  assert.match(formSource, /import \{[\s\S]*createQuoteVersionAction,[\s\S]*\} from "@\/app\/admin\/\(protected\)\/leads\/\[id\]\/quote-version-actions";/);
  assert.doesNotMatch(formSource, /export const quoteVersionActionForms/);
  assert.doesNotMatch(formSource, /acceptQuoteVersionAction|expireQuoteVersionAction|markQuoteVersionSentAction|rejectQuoteVersionAction/);
});

test("quote version non-accept transitions use compare-and-set guards and stable conflict messaging", () => {
  const actionSource = readFileSync("app/admin/(protected)/leads/[id]/quote-version-actions.ts", "utf8");

  assert.match(actionSource, /select\("id, lead_id, contact_id, quote_request_id, version_number, title, currency, total_amount, deposit_amount, status, sent_at, updated_at"\)/);
  assert.match(actionSource, /\.eq\("status", currentStatus\)/);
  assert.match(actionSource, /\.eq\("updated_at", current\.updated_at\)/);
  assert.match(actionSource, /\.select\("id"\)\s*\.maybeSingle\(\)/);
  assert.match(actionSource, /if \(!data\) throw new Error\("quote_version_status_conflict"\);/);
  assert.match(actionSource, /quoteVersionConcurrencyMessage\(\)/);
  assert.match(actionSource, /message: quoteVersionActionMessage\("send", error\)/);
  assert.match(actionSource, /message: quoteVersionActionMessage\("reject", error\)/);
  assert.match(actionSource, /message: quoteVersionActionMessage\("expire", error\)/);
  assert.match(actionSource, /crm_accept_quote_version/);
});
