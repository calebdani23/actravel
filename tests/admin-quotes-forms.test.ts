import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editor = readFileSync("components/admin/quotes/quote-editor-form.tsx", "utf8");
const upload = readFileSync("components/admin/quotes/quote-pdf-upload.tsx", "utf8");
const lifecycle = readFileSync("components/admin/quotes/quote-lifecycle-panel.tsx", "utf8");
const detail = readFileSync("app/admin/(protected)/quotes/[id]/page.tsx", "utf8");
const preview = readFileSync("components/admin/quotes/quote-pdf-preview.tsx", "utf8");
const timeline = readFileSync("components/admin/quotes/quote-version-timeline.tsx", "utf8");
const combined = [editor, upload, lifecycle, preview, timeline].join("\n");

test("quote create form retains Contacto to Oportunidad progression and prefills", () => {
  assert.match(editor, /initialContactId\?:/);
  assert.match(editor, /searchParams\.get\("contactId"\)/);
  assert.match(editor, /1\. Contacto[\s\S]*2\. Oportunidad[\s\S]*3\. Cotización/);
  assert.match(editor, /opportunities\.filter\(\(opportunity\) => opportunity\.contactId === contactId\)/);
  assert.match(editor, /requests\.filter\(\(request\) => request\.contactId === contactId && request\.opportunityId === opportunityId\)/);
});

test("initial quote requires PDF and runs validate, begin, direct TUS, finalize, redirect in order", () => {
  assert.match(editor, /name="pdf"[\s\S]*required/);
  assert.match(editor, /"Crear cotización con PDF"/);
  assert.doesNotMatch(editor, /Guardar borrador|El borrador puede guardarse sin PDF/);
  const validate = editor.indexOf("validateQuotePdfInBrowser(file)");
  const begin = editor.indexOf("beginQuoteRegistrationAction(nextInput)");
  const uploadTus = editor.indexOf("uploadQuotePdfWithTus({");
  const finalize = editor.indexOf("finalizeQuoteRegistrationAction(target.intentId)");
  const redirect = editor.indexOf("router.push(`/admin/quotes/${result.quoteId}?created=1`)");
  assert.ok(validate >= 0 && validate < begin && begin < uploadTus && finalize >= 0 && finalize < redirect);
  assert.doesNotMatch(editor, /createQuoteAction|crm_create_quote/);
});

test("initial registration snapshots every form value before pending can disable controls", () => {
  const submit = editor.slice(editor.indexOf("async function submitRegistration"), editor.indexOf("return (", editor.indexOf("async function submitRegistration")));
  const snapshot = submit.indexOf("const formData = new FormData(event.currentTarget)");
  const pending = submit.indexOf("setPending(true)");
  const validate = submit.indexOf("await validateQuotePdfInBrowser(file)");
  assert.ok(snapshot >= 0 && snapshot < pending && pending < validate);

  const capturedValues = submit.slice(snapshot, pending);
  for (const name of ["contactId", "opportunityId", "originatingRequestId", "title", "summary", "currency", "totalAmount", "depositAmount", "validUntil", "notes"]) {
    assert.match(capturedValues, new RegExp(`value\\("${name}"\\)`), `${name} must be captured before pending`);
  }
  assert.match(submit, /const nextInput: BeginQuoteRegistrationInput = reservedInput \?\? \{[\s\S]*\.\.\.formValues,/);
  assert.equal(submit.match(/new FormData\(/g)?.length, 1);
});

test("both PDF sagas preserve intent/file state, expose progress, cancellation, and safe retry", () => {
  for (const source of [editor, upload]) {
    assert.match(source, /QuotePdfIntentDescriptor/);
    assert.match(source, /uploadQuotePdfWithTus/);
    assert.match(source, /QuotePdfUploadCancelledError/);
    assert.match(source, /<progress[\s\S]*aria-label=/);
    assert.match(source, />Cancelar carga</);
    assert.match(source, /phase === "uploaded"[\s\S]*finaliz/);
    assert.match(source, /isDeterministicQuotePdfUploadError/);
  }
  assert.match(editor, /reservedInput/);
  assert.match(editor, /setIntent\(target\)/);
  assert.match(upload, /router\.refresh\(\)/);
});

test("later version form remains a draft flow but direct TUS PDF gates ready/send", () => {
  assert.match(editor, /useActionState\(addQuoteVersionAction, initialQuoteActionState\)/);
  assert.match(editor, /Crear nueva versión/);
  assert.match(editor, /La versión se guarda como borrador/);
  assert.match(detail, /no pueden quedar listas ni enviarse sin su PDF/);
  assert.match(upload, /beginQuotePdfUploadAction/);
  assert.match(upload, /finalizeQuotePdfUploadAction/);
});

test("legacy linking UI is gone while historical event labeling and preview remain", () => {
  assert.doesNotMatch(lifecycle, /legacy|Vincular PDF legado|quoteLegacyLinkConfirmation/i);
  assert.doesNotMatch(detail, /getLegacyQuoteDocumentOptions|legacyDocuments/);
  assert.match(detail, /legacy_quote_document_linked: "PDF legado vinculado"/);
  assert.match(preview, /<iframe[\s\S]*title=\{`Vista previa del PDF de \$\{title\}`\}/);
  assert.match(timeline, /currentVersionId/);
  assert.match(timeline, /acceptedVersionId/);
});

test("forms expose labels, described errors, status, and pending disable", () => {
  assert.match(combined, /aria-describedby=/);
  assert.match(combined, /role=\{state\.ok \? "status" : "alert"\}/);
  assert.match(editor, /accept="application\/pdf,\.pdf"/);
  assert.match(upload, /Solo PDF, máximo 20 MB/);
  assert.match(editor, /disabled=\{pending/);
});
