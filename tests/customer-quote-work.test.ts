import assert from "node:assert/strict";
import test from "node:test";
import { readCustomerQuoteWork, claimCustomerQuoteWork, manageCustomerQuoteWork, type QuoteWorkDependencies } from "../lib/admin/customer-quote-work";
import { getVisibleAdminNavItems, isAdminRouteAllowed } from "../components/admin/admin-nav";
import { requireAdminRole } from "../lib/admin/auth";
import type { RoleName } from "../lib/supabase/roles";

const id = "d0000000-0000-4000-8000-000000000001";
const at = "2026-11-05T12:00:00.000000Z";
const item = { eventId: id, quoteId: id, number: "TEST-1", versionNumber: 1, versionStatus: "accepted",
  kind: "acceptance_handoff", body: null, source: "customer", acceptanceId: id, dueAt: at,
  taskId: null, taskStatus: null, canManage: false, canClaim: true };
function fixture(data: unknown, overrides: Partial<QuoteWorkDependencies> = {}) {
  const calls: unknown[][] = [];
  const deps: QuoteWorkDependencies = {
    authorize: async roles => { calls.push(["auth", roles]); },
    rpc: async (...args) => { calls.push(["rpc", ...args]); return { data, error: null }; },
    revalidate: (...args) => { calls.push(["revalidate", ...args]); }, ...overrides,
  };
  return { calls, deps };
}

test("work reads require supported staff before validation or session-scoped RPC", async () => {
  const f = fixture({ ok: true, items: [item], next: { createdAt: at, eventId: id } });
  assert.deepEqual(await readCustomerQuoteWork({ before: at, after: id }, f.deps), { ok: true, items: [item], next: { createdAt: at, eventId: id } });
  assert.deepEqual(f.calls, [["auth", ["admin", "asesor", "operaciones"]], ["rpc", "read_portal_quote_work", { p_before: at, p_after: id }]]);
  const empty = fixture({ ok: true, items: [], next: null });
  assert.deepEqual(await readCustomerQuoteWork({}, empty.deps), { ok: true, items: [], next: null });
  assert.deepEqual(empty.calls[1], ["rpc", "read_portal_quote_work", { p_before: null, p_after: null }]);
  const denied = fixture(null, { authorize: async () => { throw new Error("DENIED"); } });
  await assert.rejects(() => readCustomerQuoteWork({ before: "invalid" }, denied.deps), /DENIED/);
  assert.deepEqual(denied.calls, []);
  for (const input of [{ before: at }, { after: id }, { before: "invalid", after: id }, { before: at, after: "invalid" }]) {
    const invalid = fixture(null);
    assert.deepEqual(await readCustomerQuoteWork(input, invalid.deps), { ok: false, code: "INVALID_INPUT" });
    assert.equal(invalid.calls.length, 1);
  }
});

test("work projection rejects private fields, invalid source and malformed task/receipt pairs", async () => {
  for (const row of [{ ...item, contact: "PRIVATE" }, { ...item, source: "unknown" },
    { ...item, taskId: id }, { ...item, canManage: true }, { ...item, source: "staff" }]) {
    const f = fixture({ ok: true, items: [row], next: null });
    assert.deepEqual(await readCustomerQuoteWork({}, f.deps), { ok: false, code: "PERSISTENCE_FAILURE" });
    assert.equal(f.calls.length, 2);
  }
});

test("Admin intake claim and audited management use only existing RPC contracts", async () => {
  const claim = fixture({ ok: true, taskId: id });
  assert.deepEqual(await claimCustomerQuoteWork(id, claim.deps), { ok: true, taskId: id });
  assert.deepEqual(claim.calls.slice(0, 2), [["auth", ["admin"]], ["rpc", "claim_portal_quote_work", { p_event_id: id }]]);
  for (const targetStatus of ["in_progress", "completed", "canceled"] as const) {
    const f = fixture({ ok: true, taskId: id, receiptId: id });
    const cancelReason = targetStatus === "canceled" ? "no_longer_needed" : null;
    assert.deepEqual(await manageCustomerQuoteWork({ eventId: id, requestId: id, targetStatus, cancelReason }, f.deps), { ok: true, taskId: id, receiptId: id });
    assert.deepEqual(f.calls.slice(0, 2), [["auth", ["admin", "asesor"]], ["rpc", "manage_portal_quote_work", {
      p_event_id: id, p_request_id: id, p_target_status: targetStatus, p_cancel_reason: cancelReason,
    }]]);
    assert.deepEqual(f.calls.slice(2), claim.calls.slice(2));
  }
  assert.deepEqual(claim.calls.slice(2), [
    ["revalidate", "/admin/customer-quote-work"], ["revalidate", "/admin/dashboard"],
    ["revalidate", "/admin/quotes", "layout"], ["revalidate", "/mis-viajes/cotizaciones", "layout"],
  ]);
});

test("staff denials, invalid cancel reasons and malformed responses have no refresh side effects", async () => {
  const base = { eventId: id, requestId: id, targetStatus: "canceled", cancelReason: "other" };
  for (const input of [{ ...base, cancelReason: "invented" }, { ...base, cancelReason: null },
    { ...base, targetStatus: "completed" }, { ...base, actorId: id }, { ...base, requestId: "invalid" }]) {
    const f = fixture(null);
    assert.deepEqual(await manageCustomerQuoteWork(input, f.deps), { ok: false, code: "INVALID_INPUT" });
    assert.deepEqual(f.calls, [["auth", ["admin", "asesor"]]]);
  }
  const denied = fixture(null, { authorize: async () => { throw new Error("DENIED"); } });
  await assert.rejects(() => claimCustomerQuoteWork("invalid", denied.deps), /DENIED/);
  await assert.rejects(() => manageCustomerQuoteWork(null, denied.deps), /DENIED/);
  assert.deepEqual(denied.calls, []);
  for (const code of ["ACCESS_DENIED", "NOT_AVAILABLE", "ACTION_UNAVAILABLE", "INVALID_INPUT"]) {
    const f = fixture({ ok: false, code });
    assert.deepEqual(await manageCustomerQuoteWork(base, f.deps), { ok: false, code });
    assert.equal(f.calls.length, 2);
  }
  for (const data of [null, { ok: true }, { ok: true, taskId: id, receiptId: id, private: "SECRET" }, { ok: false, code: "SECRET" }]) {
    const f = fixture(data);
    assert.deepEqual(await manageCustomerQuoteWork(base, f.deps), { ok: false, code: "PERSISTENCE_FAILURE" });
    assert.equal(f.calls.length, 2);
  }
});

test("work navigation is scoped and Manager-only routes remain unchanged", () => {
  for (const role of ["admin", "asesor", "operaciones"]) assert.ok(getVisibleAdminNavItems([role]).some(row => row.href === "/admin/customer-quote-work"));
  for (const role of ["manager", "finanzas", "marketing"]) assert.ok(!getVisibleAdminNavItems([role]).some(row => row.href === "/admin/customer-quote-work"));
  assert.deepEqual(getVisibleAdminNavItems(["manager"]).map(row => row.href), ["/admin/dashboard", "/admin/account"]);
  assert.equal(isAdminRouteAllowed(["manager"], "/admin/customer-quote-work"), false);
});

test("real role guard denies unsupported readers, non-Admin claim and Operations management before RPC", async () => {
  for (const role of ["manager", "finanzas", "marketing", "operaciones", "asesor"] as RoleName[]) {
    const f = fixture(null, { authorize: allowed => requireAdminRole(allowed, async () => ({
      user: { id }, profile: { id, full_name: "Test", is_active: true }, roles: [role],
    }), { redirect: () => { throw new Error("DENIED"); }, notFound: () => { throw new Error("DENIED"); } }) });
    await assert.rejects(() => claimCustomerQuoteWork(id, f.deps), /DENIED/);
    if (role !== "asesor") await assert.rejects(() => manageCustomerQuoteWork(null, f.deps), /DENIED/);
    if (role !== "asesor" && role !== "operaciones") await assert.rejects(() => readCustomerQuoteWork({}, f.deps), /DENIED/);
    assert.deepEqual(f.calls, []);
  }
});

test("claim and work reads reject malformed/provider failures without refresh or disclosure", async () => {
  const invalid = fixture(null);
  assert.deepEqual(await claimCustomerQuoteWork("invalid", invalid.deps), { ok: false, code: "INVALID_INPUT" });
  assert.deepEqual(invalid.calls, [["auth", ["admin"]]]);
  for (const rpc of [async () => { throw new Error("SECRET PROVIDER"); }, async () => ({ data: null, error: "SECRET PROVIDER" })]) {
    const f = fixture(null, { rpc });
    assert.deepEqual(await claimCustomerQuoteWork(id, f.deps), { ok: false, code: "PERSISTENCE_FAILURE" });
    assert.deepEqual(await readCustomerQuoteWork({}, f.deps), { ok: false, code: "PERSISTENCE_FAILURE" });
    assert.deepEqual(await manageCustomerQuoteWork({ eventId: id, requestId: id, targetStatus: "completed", cancelReason: null }, f.deps), { ok: false, code: "PERSISTENCE_FAILURE" });
    assert.ok(f.calls.every(call => call[0] === "auth"));
  }
  for (const data of [{ ok: true, taskId: "invalid" }, { ok: true, taskId: id, ownerId: id }]) {
    const f = fixture(data);
    assert.deepEqual(await claimCustomerQuoteWork(id, f.deps), { ok: false, code: "PERSISTENCE_FAILURE" });
    assert.equal(f.calls.length, 2);
  }
});
