import assert from "node:assert/strict";
import test from "node:test";

import { normalizeManualLeadInput, parseManualLeadFormData } from "@/lib/validations/manual-lead";

test("manual lead parsing requires name plus one contact method", () => {
  const formData = new FormData();
  formData.set("name", "Ada Lovelace");
  const result = parseManualLeadFormData(formData, { user: { id: "advisor-1" }, roles: ["asesor"] });
  assert.equal(result.success, false);
});

test("advisor manual leads are always self-assigned", () => {
  const normalized = normalizeManualLeadInput({ name: "Ada", phone: "+52 1 998 845 3455", source: "manual_asesor", assignedTo: "someone-else" } as never, { user: { id: "advisor-1" }, roles: ["asesor"] });
  assert.equal(normalized.assignedTo, "advisor-1");
});

test("admin manual leads may remain unassigned or choose a source", () => {
  const normalized = normalizeManualLeadInput({ name: "Ada", email: "ada@example.com", source: "referral", assignedTo: "" } as never, { user: { id: "admin-1" }, roles: ["admin"] });
  assert.equal(normalized.assignedTo, null);
  assert.equal(normalized.source, "referral");
  assert.equal(normalized.email, "ada@example.com");
});
