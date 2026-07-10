import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCreateStaffFormData,
  parseDeleteStaffFormData,
  parseEmailChangeFormData,
  parsePasswordChangeFormData,
  parseUpdateStaffFormData,
} from "@/lib/validations/staff";

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

test("staff create parser normalizes safe fields and redacts passwords from errors", () => {
  const invalid = parseCreateStaffFormData(formData({
    email: " BAD ",
    full_name: " ",
    role: "marketing",
    initial_password: "weak",
    confirm_initial_password: "different",
  }));

  assert.equal(invalid.success, false);
  if (invalid.success) return;
  assert.deepEqual(Object.keys(invalid.values).sort(), ["email", "full_name", "is_active", "role"]);
  assert.equal(invalid.values.email, "bad");
  assert.equal("initial_password" in invalid.values, false);
  assert.equal("confirm_initial_password" in invalid.values, false);

  const valid = parseCreateStaffFormData(formData({
    email: " ADA@Example.COM ",
    full_name: " Ada Lovelace ",
    role: "admin",
    is_active: "on",
    initial_password: "Str0ng!Password",
    confirm_initial_password: "Str0ng!Password",
  }));

  assert.equal(valid.success, true);
  if (!valid.success) return;
  assert.deepEqual(valid.data, {
    email: "ada@example.com",
    full_name: "Ada Lovelace",
    role: "admin",
    is_active: true,
    initial_password: "Str0ng!Password",
  });
});

test("staff update parser validates managed roles and booleans", () => {
  const invalid = parseUpdateStaffFormData(formData({
    profile_id: "bad-id",
    full_name: "A",
    role: "finanzas",
  }));

  assert.equal(invalid.success, false);

  const valid = parseUpdateStaffFormData(formData({
    profile_id: "550e8400-e29b-41d4-a716-446655440000",
    full_name: " Grace Hopper ",
    role: "asesor",
  }));

  assert.equal(valid.success, true);
  if (!valid.success) return;
  assert.deepEqual(valid.data, {
    profile_id: "550e8400-e29b-41d4-a716-446655440000",
    full_name: "Grace Hopper",
    role: "asesor",
    is_active: false,
  });
});

test("password change parser requires strong confirmed password", () => {
  const invalid = parsePasswordChangeFormData(formData({
    new_password: "short",
    confirm_new_password: "different",
  }));

  assert.equal(invalid.success, false);
  if (invalid.success) return;
  assert.equal(Object.keys(invalid.values).length, 0);

  const valid = parsePasswordChangeFormData(formData({
    new_password: "An0ther!StrongPwd",
    confirm_new_password: "An0ther!StrongPwd",
  }));

  assert.equal(valid.success, true);
  if (!valid.success) return;
  assert.equal(valid.data.password, "An0ther!StrongPwd");
});

test("email change parser normalizes email and confirmation", () => {
  const valid = parseEmailChangeFormData(formData({
    email: " NEW.Admin@Example.COM ",
    confirm_email: " new.admin@example.com ",
  }));

  assert.equal(valid.success, true);
  if (!valid.success) return;
  assert.deepEqual(valid.data, {
    email: "new.admin@example.com",
  });
});

test("email change parser rejects invalid email and mismatched confirmation", () => {
  const invalidEmail = parseEmailChangeFormData(formData({
    email: "not-an-email",
    confirm_email: "not-an-email",
  }));

  assert.equal(invalidEmail.success, false);
  if (invalidEmail.success) return;
  assert.equal(invalidEmail.values.email, "not-an-email");
  assert.equal(invalidEmail.values.confirm_email, "not-an-email");

  const mismatch = parseEmailChangeFormData(formData({
    email: "new.admin@example.com",
    confirm_email: "other.admin@example.com",
  }));

  assert.equal(mismatch.success, false);
  if (mismatch.success) return;
  assert.deepEqual(mismatch.fieldErrors.confirm_email, ["Emails must match"]);
});

test("staff delete parser only accepts a UUID profile id", () => {
  const invalid = parseDeleteStaffFormData(formData({
    profile_id: "not-a-uuid",
  }));

  assert.equal(invalid.success, false);

  const valid = parseDeleteStaffFormData(formData({
    profile_id: "550e8400-e29b-41d4-a716-446655440000",
  }));

  assert.equal(valid.success, true);
  if (!valid.success) return;
  assert.deepEqual(valid.data, {
    profile_id: "550e8400-e29b-41d4-a716-446655440000",
  });
});
