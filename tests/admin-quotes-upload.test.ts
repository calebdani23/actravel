import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { QUOTE_PDF_MAX_SIZE_BYTES, validateQuotePdfInBrowser } from "@/lib/admin/quote-pdf-client";
import { quotePdfSha256 } from "@/lib/admin/quote-pdf";
import { quotePdfTusEndpoint } from "@/lib/admin/quote-pdf-tus";

const actions = readFileSync("app/admin/(protected)/quotes/actions.ts", "utf8");
const tus = readFileSync("lib/admin/quote-pdf-tus.ts", "utf8");
const editor = readFileSync("components/admin/quotes/quote-editor-form.tsx", "utf8");
const upload = readFileSync("components/admin/quotes/quote-pdf-upload.tsx", "utf8");

test("browser validation enforces extension, MIME, magic, SHA-256 and the exact 20 MiB boundary", async () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\nstandalone quote");
  const valid = new File([bytes], "AC-Travel.pdf", { type: "application/pdf" });
  const metadata = await validateQuotePdfInBrowser(valid);
  assert.deepEqual(metadata, { byteSize: bytes.byteLength, mimeType: "application/pdf", sha256: quotePdfSha256(bytes) });
  await assert.rejects(validateQuotePdfInBrowser(new File([bytes], "AC-Travel.txt", { type: "application/pdf" })), /extensión \.pdf/);
  await assert.rejects(validateQuotePdfInBrowser(new File([bytes], "AC-Travel.pdf", { type: "text/plain" })), /application\/pdf/);
  await assert.rejects(validateQuotePdfInBrowser(new File(["not pdf"], "AC-Travel.pdf", { type: "application/pdf" })), /firma PDF válida/);
  const maximum = new Uint8Array(QUOTE_PDF_MAX_SIZE_BYTES);
  maximum.set(new TextEncoder().encode("%PDF-"));
  assert.equal((await validateQuotePdfInBrowser(new File([maximum], "maximum.pdf", { type: "application/pdf" }))).byteSize, QUOTE_PDF_MAX_SIZE_BYTES);
  await assert.rejects(validateQuotePdfInBrowser(new File([new Uint8Array(QUOTE_PDF_MAX_SIZE_BYTES + 1)], "large.pdf", { type: "application/pdf" })), /20 MB/);
});

test("TUS endpoint uses direct hosted Storage and API-host fallback for local or custom environments", () => {
  assert.equal(quotePdfTusEndpoint("https://project-ref.supabase.co"), "https://project-ref.storage.supabase.co/storage/v1/upload/resumable");
  assert.equal(quotePdfTusEndpoint("http://127.0.0.1:54321"), "http://127.0.0.1:54321/storage/v1/upload/resumable");
});

test("TUS uploader forwards only public browser auth and exact reserved metadata", () => {
  assert.match(tus, /supabase\.auth\.getSession\(\)/);
  assert.match(tus, /authorization: `Bearer \$\{session\.access_token\}`/);
  assert.match(tus, /apikey: publishableKey/);
  assert.match(tus, /"x-upsert": "false"/);
  assert.match(tus, /bucketName: input\.bucket/);
  assert.match(tus, /objectName: input\.path/);
  assert.match(tus, /contentType: QUOTE_PDF_MIME_TYPE/);
  assert.match(tus, /chunkSize: TUS_CHUNK_SIZE_BYTES/);
  assert.match(tus, /6 \* 1024 \* 1024/);
  assert.match(tus, /retryDelays: \[0, 3000, 5000, 10000, 20000\]/);
  assert.match(tus, /findPreviousUploads\(\)/);
  assert.match(tus, /resumeFromPreviousUpload/);
  assert.match(tus, /fingerprint: \(\) => Promise\.resolve\(`ac-travel-quote-pdf:/);
  assert.match(tus, /upload\.abort\(false\)/);
  assert.doesNotMatch(tus, /SUPABASE_SECRET_KEY|service_role|sha256: input|metadata:[\s\S]*path: input/);
});

test("no PDF bytes or user-supplied path/checksum cross a Server Action", () => {
  assert.doesNotMatch(actions, /instanceof File|file\.arrayBuffer|formData\.get\("pdf"\)|storage\.from\([^)]*\)\.upload/);
  assert.match(actions, /beginQuoteRegistrationAction\(input: BeginQuoteRegistrationInput\)/);
  assert.match(actions, /beginQuotePdfUploadAction\(input: BeginQuotePdfUploadInput\)/);
  assert.match(actions, /finalizeQuoteRegistrationAction\(intentId: string\)/);
  assert.match(actions, /finalizeQuotePdfUploadAction\(intentId: string\)/);
  assert.doesNotMatch(actions, /finalizeQuoteRegistrationAction\([^)]*(?:path|bucket|sha|size)/);
  assert.doesNotMatch(actions, /finalizeQuotePdfUploadAction\([^)]*(?:path|bucket|sha|size)/);
});

test("both clients use the same TUS helper and retry finalize without re-uploading", () => {
  for (const source of [editor, upload]) {
    assert.match(source, /validateQuotePdfInBrowser\(file\)/);
    assert.match(source, /uploadQuotePdfWithTus\(\{/);
    assert.match(source, /phase === "uploaded"/);
    assert.match(source, /quotePdfTusErrorStatus\([^)]*\) === 409/);
    assert.match(source, /removeFailedQuotePdfObject/);
  }
});

test("trusted server finalization downloads exact intent objects and computes official checksum", () => {
  assert.match(actions, /admin\.storage\.from\(intent\.bucket\)\.download\(intent\.path\)/);
  assert.match(actions, /validateDownloadedQuotePdf\(download\.data, intent\.expectedSizeBytes\)/);
  assert.match(actions, /p_verified_sha256: metadata\.sha256/);
  assert.match(actions, /p_sha256: metadata\.sha256/);
  assert.doesNotMatch(actions, /p_(?:verified_sha256|sha256): (?:input|registration|uploadRow)/);
});
