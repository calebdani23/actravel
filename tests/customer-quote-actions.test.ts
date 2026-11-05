import assert from "node:assert/strict";
import test from "node:test";
import { acceptCustomerQuote, requestCustomerQuoteChange, type CustomerQuoteActionDependencies } from "../lib/customer/quote-actions";

const id = "d0000000-0000-4000-8000-000000000001";
const receipt = "d0000000-0000-4000-8000-000000000002";
const at = "2026-11-05T12:00:00.000000Z";
const base = { requestId: id, quoteId: id, versionId: id, expectedLock: 3 };
const acceptance = { ...base, termsId: id, termsHash: "a".repeat(64), documentHash: "b".repeat(64), consent: true };
function fixture(data: unknown, overrides: Partial<CustomerQuoteActionDependencies> = {}) {
  const calls: unknown[][] = [];
  const deps: CustomerQuoteActionDependencies = {
    identity: async () => { calls.push(["auth"]); return { accountId: id, displayName: "Customer" }; },
    rpc: async (...args) => { calls.push(["rpc", ...args]); return { data, error: null }; },
    revalidate: (...args) => { calls.push(["revalidate", ...args]); },
    ...overrides,
  };
  return { calls, deps };
}

test("customer mutations authenticate before validating and never write on rejected input", async () => {
  for (const mutate of [acceptCustomerQuote, requestCustomerQuoteChange]) {
    const denied = fixture(null, { identity: async () => null });
    assert.deepEqual(await mutate(null, denied.deps), { ok: false, code: "ACCESS_DENIED" });
    assert.deepEqual(denied.calls, []);
  }
  for (const input of [null, { ...acceptance, consent: "true" }, { ...acceptance, consent: false },
    { ...acceptance, expectedLock: -1 }, { ...acceptance, expectedLock: 2147483648 },
    { ...acceptance, requestId: "invalid" }, { ...acceptance, termsHash: "invalid" },
    { ...acceptance, customerId: id }, { ...acceptance, price: 1 }]) {
    const f = fixture(null);
    assert.deepEqual(await acceptCustomerQuote(input, f.deps), { ok: false, code: "INVALID_INPUT" });
    assert.deepEqual(f.calls, [["auth"]]);
  }
});

test("acceptance sends only exact viewed identities, lock, hashes and literal consent; success refreshes relevant paths", async () => {
  const result = { ok: true, acceptanceId: receipt, acceptedAt: at };
  const f = fixture(result);
  assert.deepEqual(await acceptCustomerQuote(acceptance, f.deps), result);
  assert.deepEqual(f.calls.slice(0, 2), [["auth"], ["rpc", "accept_customer_quote", {
    p_request_id: id, p_quote_id: id, p_version_id: id, p_expected_lock: 3,
    p_terms_id: id, p_terms_hash: acceptance.termsHash, p_document_hash: acceptance.documentHash, p_consent: true,
  }]]);
  assert.deepEqual(f.calls.slice(2), [
    ["revalidate", "/mis-viajes/cotizaciones"], ["revalidate", `/mis-viajes/cotizaciones/${id}`],
    ["revalidate", "/admin/quotes"], ["revalidate", `/admin/quotes/${id}`],
    ["revalidate", "/admin/customer-quote-work"], ["revalidate", "/admin/dashboard"],
  ]);
});

test("change requests trim on the server and count Unicode codepoints rather than UTF-16 units", async () => {
  for (const body of [" x ", `\n${"🌎".repeat(2000)}\t`]) {
    const f = fixture({ ok: true, requestId: receipt });
    assert.deepEqual(await requestCustomerQuoteChange({ ...base, body }, f.deps), { ok: true, requestId: receipt });
    assert.deepEqual(f.calls[1], ["rpc", "request_customer_quote_change", {
      p_request_id: id, p_quote_id: id, p_version_id: id, p_expected_lock: 3, p_body: body.trim(),
    }]);
    assert.equal(f.calls.filter(call => call[0] === "revalidate").length, 6);
  }
  for (const body of ["", " \n\t", "🌎".repeat(2001), "x".repeat(2001), null, "a\u0000b", "\ud800"]) {
    const f = fixture(null);
    assert.deepEqual(await requestCustomerQuoteChange({ ...base, body }, f.deps), { ok: false, code: "INVALID_INPUT" });
    assert.deepEqual(f.calls, [["auth"]]);
  }
});

test("closed domain denials and malformed/provider failures never revalidate or leak provider text", async () => {
  for (const mutate of [acceptCustomerQuote, requestCustomerQuoteChange]) {
    const input = mutate === acceptCustomerQuote ? acceptance : { ...base, body: "Change dates" };
    for (const code of ["ACCESS_DENIED", "INVALID_INPUT", "NOT_AVAILABLE", "CONFLICT", "STALE_QUOTE",
      "ACCEPTED_PROPOSAL_EXISTS", "TERMS_REQUIRED", "TERMS_CHANGED", "RATE_LIMITED"]) {
      const f = fixture({ ok: false, code });
      assert.deepEqual(await mutate(input, f.deps), { ok: false, code });
      assert.equal(f.calls.length, 2);
    }
    for (const data of [null, { ok: true }, { ok: false, code: "SECRET" }, { ok: false, code: "NOT_AVAILABLE", detail: "SECRET" },
      { ok: true, acceptanceId: receipt, acceptedAt: "invalid" }, { ok: true, requestId: receipt, notes: "SECRET" }]) {
      const f = fixture(data);
      assert.deepEqual(await mutate(input, f.deps), { ok: false, code: "PERSISTENCE_FAILURE" });
      assert.equal(f.calls.length, 2);
    }
    for (const rpc of [async () => { throw new Error("SECRET"); }, async () => ({ data: null, error: "SECRET" })]) {
      const f = fixture(null, { rpc });
      assert.deepEqual(await mutate(input, f.deps), { ok: false, code: "PERSISTENCE_FAILURE" });
      assert.deepEqual(f.calls, [["auth"]]);
    }
  }
});
