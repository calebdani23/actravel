import assert from "node:assert/strict";
import test from "node:test";
import { requestCustomerCode, verifyCustomerCode, decodeCustomerIdentity, type PortalAuthDependencies } from "../lib/customer/portal";
import { isProtectedAdminPath, isProtectedCustomerPath } from "../proxy";

test("portal session routing preserves staff paths and never treats other URLs as customer routes", () => {
  assert.equal(isProtectedCustomerPath("/mis-viajes"), true);
  assert.equal(isProtectedCustomerPath("/mis-viajes/private"), true);
  assert.equal(isProtectedCustomerPath("/mis-viajes/acceso"), false);
  assert.equal(isProtectedCustomerPath("/mis-viajes-forged"), false);
  assert.equal(isProtectedAdminPath("/admin/dashboard"), true);
  assert.equal(isProtectedAdminPath("/admin/login"), false);
  assert.equal(isProtectedAdminPath("/mis-viajes"), false);
});

function fixture(overrides: Partial<PortalAuthDependencies> = {}) {
  const calls: unknown[][] = [];
  const deps: PortalAuthDependencies = {
    resolve: async (...args) => { calls.push(["resolve", ...args]); return args[0]; },
    send: async (...args) => { calls.push(["send", ...args]); },
    verify: async (...args) => { calls.push(["verify", ...args]); },
    redeem: async token => { calls.push(["redeem", token]); return true; },
    identity: async () => ({ accountId: "c0000000-0000-4000-8000-000000000002", displayName: "Customer" }),
    clear: async () => { calls.push(["clear"]); },
    ...overrides,
  };
  return { deps, calls };
}

test("OTP requests are nonenumerating, invitation-gated, and disable signup for returning users", async () => {
  const token = "a".repeat(64), f = fixture();
  assert.deepEqual(await requestCustomerCode({ email: " A@portal.test ", invitationToken: token }, f.deps), { ok: true });
  assert.deepEqual(f.calls, [["resolve", "a@portal.test", token, true], ["send", "a@portal.test", true]]);
  const returning = fixture();
  await requestCustomerCode({ email: "a@portal.test", invitationToken: null }, returning.deps);
  assert.deepEqual(returning.calls.at(-1), ["send", "a@portal.test", false]);
  const absent = fixture({ resolve: async () => null });
  assert.deepEqual(await requestCustomerCode({ email: "absent@portal.test", invitationToken: null }, absent.deps), { ok: true });
  assert.equal(absent.calls.length, 0);
  const failure = fixture({ send: async () => { throw new Error("secret provider detail"); } });
  assert.deepEqual(await requestCustomerCode({ email: "a@portal.test", invitationToken: token }, failure.deps), { ok: true });
  const malformed = fixture();
  await requestCustomerCode({ email: "a@portal.test", invitationToken: "forged" }, malformed.deps);
  assert.equal(malformed.calls.length, 0);
});

test("verification proves email before atomic redemption and rejects unlinked/inactive sessions", async () => {
  const token = "a".repeat(64), f = fixture();
  assert.deepEqual(await verifyCustomerCode({ email: "a@portal.test", code: "123456", invitationToken: token }, f.deps), { ok: true });
  assert.deepEqual(f.calls, [["resolve", "a@portal.test", token, false], ["verify", "a@portal.test", "123456"], ["redeem", token]]);
  const denied = fixture({ redeem: async () => false });
  assert.deepEqual(await verifyCustomerCode({ email: "a@portal.test", code: "123456", invitationToken: token }, denied.deps), { ok: false });
  assert.deepEqual(denied.calls.at(-1), ["clear"]);
  const inactive = fixture({ identity: async () => null });
  assert.equal((await verifyCustomerCode({ email: "a@portal.test", code: "123456", invitationToken: null }, inactive.deps)).ok, false);
  const bad = fixture();
  assert.equal((await verifyCustomerCode({ email: "a@portal.test", code: "x", invitationToken: null }, bad.deps)).ok, false);
  assert.equal(bad.calls.length, 0);
});

test("customer identity is minimal, closed, and bound to the verified current user", () => {
  const user = "c0000000-0000-4000-8000-000000000002";
  const data = { ok: true, accountId: user, displayName: "Customer" };
  assert.deepEqual(decodeCustomerIdentity(data, user), { accountId: user, displayName: "Customer" });
  assert.equal(decodeCustomerIdentity(data, "c0000000-0000-4000-8000-000000000003"), null);
  assert.equal(decodeCustomerIdentity({ ...data, notes: "internal" }, user), null);
  assert.equal(decodeCustomerIdentity({ ok: false, code: "ACCESS_DENIED" }, user), null);
});

test("malformed invitation domains and provider failures never skip authorization or expose details", async () => {
  const input = { email: "a@portal.test", code: "123456", invitationToken: "a".repeat(64) };
  for (const token of ["x", "a".repeat(63), "a".repeat(65), "A".repeat(64), 1, {}, []]) {
    const f = fixture();
    assert.deepEqual(await requestCustomerCode({ ...input, invitationToken: token }, f.deps), { ok: true });
    assert.deepEqual(await verifyCustomerCode({ ...input, invitationToken: token }, f.deps), { ok: false });
    assert.deepEqual(f.calls, []);
  }
  for (const phase of ["resolve", "verify", "redeem", "identity"] as const) {
    const f = fixture({ [phase]: async () => { throw new Error("PRIVATE PROVIDER DATA"); } });
    assert.deepEqual(await verifyCustomerCode(input, f.deps), { ok: false });
    assert.equal(f.calls.some(call => call[0] === "clear"), phase === "redeem" || phase === "identity");
  }
});
