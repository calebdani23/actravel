import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync("app/admin/(protected)/quotes/actions.ts", "utf8");
const actionState = readFileSync("app/admin/(protected)/quotes/action-state.ts", "utf8");
const editor = readFileSync("components/admin/quotes/quote-editor-form.tsx", "utf8");
const loaders = readFileSync("lib/admin/quotes.ts", "utf8");
const validation = readFileSync("lib/admin/quote-validation.ts", "utf8");

test("standalone quote actions expose only async Server Actions and keep serializable saga state separate", () => {
  assert.match(actions, /^"use server";/);
  const exports = [...actions.matchAll(/export\s+(async\s+)?(?:function|const|type|interface|class)\s+(\w+)/g)];
  assert.ok(exports.length >= 15);
  for (const item of exports) assert.equal(item[1], "async ", `${item[2]} must be an async Server Action`);
  assert.doesNotMatch(actionState, /["']use server["']/);
  assert.match(actionState, /export type QuotePdfIntentDescriptor/);
  assert.match(actionState, /export type BeginQuoteRegistrationInput/);
});

test("initial and version PDF actions are admin or advisor scoped metadata boundaries", () => {
  for (const name of [
    "beginQuoteRegistrationAction",
    "finalizeQuoteRegistrationAction",
    "failQuoteRegistrationAction",
    "addQuoteVersionAction",
    "beginQuotePdfUploadAction",
    "finalizeQuotePdfUploadAction",
    "failQuotePdfUploadAction",
    "markQuoteReadyAction",
    "markQuoteSentAction",
    "acceptQuoteAction",
    "rejectQuoteAction",
    "expireQuoteAction",
    "cancelQuoteAction",
    "softDeleteQuoteAction",
    "restoreQuoteAction",
  ]) assert.match(actions, new RegExp(`export async function ${name}`));
  assert.match(actions, /async function runWorkflowAction[\s\S]*requireAdminRole\(\["admin", "asesor"\]\)/);
  assert.doesNotMatch(actions, /"operaciones"|"finanzas"|"marketing"/);
});

test("initial registration verifies scope then reserves metadata and never creates a quote directly", () => {
  const begin = actions.slice(actions.indexOf("export async function beginQuoteRegistrationAction"), actions.indexOf("export async function finalizeQuoteRegistrationAction"));
  assert.match(begin, /beginQuoteRegistrationSchema\.safeParse\(input\)/);
  assert.match(begin, /verifyQuoteCreateScope\(selection\.data\.contactId, quote\.data\.opportunityId, quote\.data\.originatingRequestId\)/);
  assert.ok(begin.indexOf("verifyQuoteCreateScope") < begin.indexOf('rpc("crm_begin_quote_registration"'));
  assert.match(begin, /p_expected_size_bytes: quote\.data\.expectedSizeBytes/);
  assert.match(begin, /p_advisory_sha256: quote\.data\.advisorySha256/);
  assert.doesNotMatch(begin, /crm_create_quote|File|FormData/);
  assert.match(loaders, /opportunity\.data\.contact_id !== contactId/);
});

test("trusted finalizers accept only intent IDs and derive download scope before service-only RPCs", () => {
  const registration = actions.slice(actions.indexOf("export async function finalizeQuoteRegistrationAction"), actions.indexOf("export async function failQuoteRegistrationAction"));
  assert.match(registration, /finalizeQuoteRegistrationAction\(intentId: string\)/);
  assert.match(registration, /rpc\("crm_quote_registration_intent", \{ p_intent_id: parsed\.data \}\)/);
  assert.match(registration, /admin\.storage\.from\(intent\.bucket\)\.download\(intent\.path\)/);
  assert.match(registration, /validateDownloadedQuotePdf\(download\.data, intent\.expectedSizeBytes\)/);
  assert.match(registration, /admin\.rpc\("crm_register_quote_with_pdf"/);
  assert.doesNotMatch(registration, /p_(?:path|bucket|sha256|verified_size_bytes): input/);

  const version = actions.slice(actions.indexOf("export async function finalizeQuotePdfUploadAction"), actions.indexOf("export async function failQuotePdfUploadAction"));
  assert.match(version, /finalizeQuotePdfUploadAction\(intentId: string\)/);
  assert.match(version, /from\("quote_upload_intents"\)[\s\S]*\.eq\("id", parsed\.data\)/);
  assert.match(version, /download\(intent\.path\)/);
  assert.match(version, /admin\.rpc\("crm_finalize_quote_pdf_upload"/);
});

test("transient finalize failures preserve pending state and only deterministic failures call bounded fail RPCs", () => {
  assert.match(actions, /function deterministicTrustedPdfError/);
  assert.doesNotMatch(actions, /return \/\^trusted_pdf_\//);
  assert.match(actions, /if \(deterministicTrustedPdfError\(error\)\)[\s\S]*markRegistrationFailure/);
  assert.match(actions, /if \(deterministicTrustedPdfError\(error\)\)[\s\S]*markVersionUploadFailure/);
  assert.match(actions, /PDF y el registro pendientes se conservaron para reintentar/);
  assert.match(actions, /PDF pendiente se conservó para reintentar/);
  assert.doesNotMatch(actions, /storage\.from\([^)]*\)\.upload|formData\.get\("pdf"\)|instanceof File/);
});

test("legacy link and dormant direct writers are absent from active application code", () => {
  assert.doesNotMatch(actions, /crm_create_quote|crm_link_legacy_quote_document|crm_accept_quote_version|linkLegacyQuoteDocumentAction/);
  assert.doesNotMatch(loaders, /getLegacyQuoteDocumentOptions|legacy_pdf_candidate/);
  assert.doesNotMatch(validation, /quoteLegacyLinkConfirmation|linkLegacyQuoteDocumentSchema/);
  assert.equal(existsSync("app/admin/(protected)/leads/[id]/quote-version-actions.ts"), false);
  assert.equal(existsSync("app/admin/(protected)/leads/[id]/quote-version-action-state.ts"), false);
  assert.equal(existsSync("components/admin/leads/quote-version-forms.tsx"), false);
});

test("successful initial registration redirects client-side only after trusted finalization", () => {
  assert.match(editor, /const result = await finalizeQuoteRegistrationAction\(target\.intentId\)/);
  assert.match(editor, /if \(result\.ok && result\.quoteId\)/);
  assert.match(editor, /router\.push\(`\/admin\/quotes\/\$\{result\.quoteId\}\?created=1`\)/);
  assert.doesNotMatch(actions, /redirect\(/);
  for (const route of ['revalidatePath("/admin/quotes")', 'revalidatePath("/admin/dashboard")', 'revalidatePath("/admin/operations/documents")']) assert.match(actions, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
