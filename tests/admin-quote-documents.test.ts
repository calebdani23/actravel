import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const page = read("app/admin/(protected)/operations/documents/page.tsx");
const actions = read("app/admin/(protected)/operations/actions.ts");
const errors = read("lib/admin/operation-action-errors.ts");
const operations = read("lib/admin/operations.ts");
const view = read("lib/admin/operations-view.ts");
const quoteActions = read("app/admin/(protected)/quotes/actions.ts");
const pdfMigration = read("db/migrations/0054_quote_pdf_documents_and_uploads.sql");

test("Documents projects canonical quote PDFs as private read-only records", () => {
  assert.match(page, /requireAdminRole\(\["admin", "operaciones"\]\)/);
  assert.match(operations, /quote_version:quote_versions!documents_quote_version_id_fkey\(id, quote_id\)/);
  assert.match(operations, /createSignedUrl\(path, 60 \* 10/);
  assert.match(view, /if \(document\.quote_version_id\) return "Cotización"/);
  assert.match(view, /filters\.relation === "quote"/);
  assert.match(page, /<option value="quote">Cotización<\/option>/);
  assert.match(page, /document\.quote_version \? <Button[\s\S]*Abrir cotización/);
  assert.match(page, /filteredDocuments\.filter\(\(document\) => !document\.quote_version_id\)/);
  assert.match(page, /PDF de cotización permanecen inmutables/);
});

test("generic document Server Actions reject quote-linked update and delete before storage mutation", () => {
  assert.match(actions, /select\("id, bucket, path, quote_version_id"\)/);
  assert.equal((actions.match(/document-quote-linked/g) ?? []).length, 2);
  const updateGuard = actions.indexOf("existing?.quoteVersionId");
  const upload = actions.indexOf("uploadPrivateFile", actions.indexOf("export async function upsertDocumentAction"));
  assert.ok(updateGuard >= 0 && updateGuard < upload);
  const deleteStart = actions.indexOf("export async function deleteDocumentAction");
  const deleteGuard = actions.indexOf("existing.quoteVersionId", deleteStart);
  const tableDelete = actions.indexOf('.from("documents").delete()', deleteStart);
  assert.ok(deleteGuard >= 0 && deleteGuard < tableDelete);
  assert.match(errors, /document-quote-linked/);
  assert.match(errors, /PDF de cotizaciones se administran únicamente desde Cotizaciones/);
});

test("canonical PDF mutation remains confined to quote RPC actions and storage policy", () => {
  assert.match(quoteActions, /crm_begin_quote_pdf_upload/);
  assert.match(quoteActions, /crm_finalize_quote_pdf_upload/);
  assert.match(quoteActions, /crm_fail_quote_pdf_upload/);
  assert.match(quoteActions, /revalidateQuotePaths\(\{ \.\.\.scope, documents: true \}\)/);
  assert.match(pdfMigration, /quote pdf scoped read/);
  assert.match(pdfMigration, /quote pdf intent upload/);
  assert.match(pdfMigration, /document_type = 'quote'/);
  assert.doesNotMatch(actions, /^\s*quote_version_id:\s*text\(formData/m);
});
