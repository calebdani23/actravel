import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { customerQuotePage, customerQuoteDetail, customerQuotePdf, type QuoteDependencies } from "../lib/customer/quotes";

const id = "d0000000-0000-4000-8000-000000000001", document = "d0000000-0000-4000-8000-000000000002";
const bytes = new TextEncoder().encode("%PDF-1.7\nTEST ONLY\n%%EOF");
const sha = createHash("sha256").update(bytes).digest("hex");
const pdf = { versionId: id, documentId: document, bucket: "quote-pdfs", path: `contacts/${id}/opportunities/${id}/quotes/${id}/versions/${id}/${document}.pdf`, sha256: sha, byteSize: bytes.length };
function fixture(result: unknown, overrides: Partial<QuoteDependencies> = {}) {
  const calls: unknown[][] = [];
  const dependencies: QuoteDependencies = {
    identity: async () => ({ accountId: id, displayName: "Customer" }),
    rpc: async (...args) => { calls.push(["rpc", ...args]); return { data: result, error: null }; },
    download: async (...args) => { calls.push(["download", ...args]); return new Blob([bytes]); },
    ...overrides,
  };
  return { calls, dependencies };
}

test("quote reads authenticate first, decode closed results, and never expose provider details", async () => {
  const denied = fixture(null, { identity: async () => null });
  assert.equal((await customerQuotePage({}, denied.dependencies)).ok, false);
  assert.deepEqual(denied.calls, []);
  const valid = fixture({ ok: true, items: [], next: null });
  assert.deepEqual(await customerQuotePage({}, valid.dependencies), { ok: true, items: [], next: null });
  assert.deepEqual(valid.calls, [["rpc", "read_customer_quotes", { p_before: null, p_after: null, p_limit: 20 }]]);
  const extra = fixture({ ok: true, items: [], next: null, notes: "PRIVATE" });
  assert.equal((await customerQuotePage({}, extra.dependencies)).ok, false);
  const failure = fixture(null, { rpc: async () => { throw new Error("SECRET PROVIDER VALUE"); } });
  assert.deepEqual(await customerQuoteDetail(id, {}, failure.dependencies), { ok: false, code: "PERSISTENCE_FAILURE" });
});

test("PDF bytes require authorized metadata, a canonical path, exact size, and content hash", async () => {
  const valid = fixture({ ok: true, pdf });
  const result = await customerQuotePdf(id, valid.dependencies);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(new Uint8Array(result.bytes), bytes);
  assert.deepEqual(valid.calls.at(-1), ["download", pdf.bucket, pdf.path]);
  for (const value of [
    { ok: false, code: "NOT_AVAILABLE" },
    { ok: true, pdf: { ...pdf, versionId: document } },
    { ok: true, pdf: { ...pdf, bucket: "payment-proofs" } },
    { ok: true, pdf: { ...pdf, path: "../private.pdf" } },
  ]) {
    const invalid = fixture(value);
    assert.equal((await customerQuotePdf(id, invalid.dependencies)).ok, false);
    assert.equal(invalid.calls.some(call => call[0] === "download"), false);
  }
  for (const blob of [new Blob(["wrong"]), new Blob([new Uint8Array(bytes.length)])]) {
    const changed = fixture({ ok: true, pdf }, { download: async () => blob });
    assert.equal((await customerQuotePdf(id, changed.dependencies)).ok, false);
  }
});
