import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPABILITY_KEYS,
  CAPABILITY_GRANTS,
  canCapability,
} from "@/lib/admin/capabilities";
import { ROLE_LABELS, ROLE_NAMES, isRoleName, normalizeRoleNames } from "@/lib/supabase/roles";
import { normalizeActiveRoles } from "@/lib/admin/role-normalization";

const matrix: Record<string, string[]> = {
  "discount:approve": ["admin", "manager"],
  "handoff:accept": ["admin", "manager", "operaciones"],
  "payment:verify": ["admin", "manager", "finanzas"],
  "refund:approve": ["admin", "manager", "finanzas"],
  "traveler:sensitive-read": ["admin", "manager", "operaciones"],
  "identity:merge": ["admin"],
  "content:publish": ["admin", "marketing"],
  "incident:escalate": ["admin", "manager", "operaciones"],
};

test("recognizes manager and renders Gerencia", () => {
  assert.equal(isRoleName("manager"), true);
  assert.equal(ROLE_LABELS.manager, "Gerencia");
  assert.ok(ROLE_NAMES.includes("manager"));
});

test("matches the exact eight-capability matrix", () => {
  assert.deepEqual([...CAPABILITY_KEYS], Object.keys(matrix));
  for (const [capability, grantedRoles] of Object.entries(matrix)) {
    for (const role of ["admin", "manager", "asesor", "operaciones", "finanzas", "marketing"]) {
      assert.equal(canCapability([role], capability), grantedRoles.includes(role), `${role} ${capability}`);
    }
  }
  assert.deepEqual(CAPABILITY_GRANTS.manager, ["discount:approve", "handoff:accept", "payment:verify", "refund:approve", "traveler:sensitive-read", "incident:escalate"]);
});

test("fails closed for unknown, inactive, and combined roles", () => {
  assert.equal(canCapability(["unknown"], "discount:approve"), false);
  assert.equal(canCapability(["manager", "unknown"], "identity:merge"), false);
  assert.equal(canCapability(["manager", "asesor"], "content:publish"), false);
  assert.equal(canCapability(["manager", "asesor"], "discount:approve"), true);
  assert.equal(canCapability([], "discount:approve"), false);
  assert.equal(canCapability(["manager"], "not-a-capability"), false);
  assert.deepEqual(normalizeRoleNames(["manager", "unknown", "manager"]), ["manager"]);
  assert.deepEqual(normalizeActiveRoles(["manager", "unknown"], false), []);
  assert.deepEqual(normalizeActiveRoles(["manager", "unknown"], true), ["manager"]);
});
