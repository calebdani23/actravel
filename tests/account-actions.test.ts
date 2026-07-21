import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { accountActionErrorInternals } from "@/lib/admin/account-action-errors";

test("account password failures always return a stable Spanish-safe message", () => {
  const rawProviderError = new Error("AuthApiError: Password should be at least 6 characters. provider=gotrue trace_id=abc123");

  const state = accountActionErrorInternals.buildPasswordFailureState(rawProviderError);

  assert.deepEqual(state.fieldErrors, {});
  assert.equal(state.ok, false);
  assert.equal(state.message, "No se pudo actualizar la contraseña. Inténtalo nuevamente.");
  assert.doesNotMatch(state.message ?? "", /AuthApiError|provider|trace_id|6 characters/i);
});

test("account email failures keep the known duplicate-email message but hide raw provider text otherwise", () => {
  const duplicateState = accountActionErrorInternals.buildEmailFailureState(
    new Error("Ese correo no se puede usar. Intenta con otro o contacta a una persona administradora."),
    "taken@example.com",
  );
  const rawProviderState = accountActionErrorInternals.buildEmailFailureState(
    new Error("AuthApiError: Error sending confirmation mail via provider smtp.internal.local for user already pending"),
    "new.admin@example.com",
  );

  assert.equal(duplicateState.message, "Ese correo no se puede usar. Intenta con otro o contacta a una persona administradora.");
  assert.deepEqual(duplicateState.values, { email: "taken@example.com", confirm_email: "taken@example.com" });
  assert.equal(rawProviderState.message, "No se pudo actualizar el correo electrónico. Inténtalo nuevamente.");
  assert.deepEqual(rawProviderState.values, { email: "new.admin@example.com", confirm_email: "new.admin@example.com" });
  assert.doesNotMatch(rawProviderState.message ?? "", /AuthApiError|smtp\.internal\.local|provider|pending/i);
});

test("account actions use safe failure-state builders instead of returning raw backend messages", () => {
  const source = readFileSync("app/admin/(protected)/account/actions.ts", "utf8");

  assert.match(source, /return buildPasswordFailureState\(error\);/);
  assert.match(source, /return buildEmailFailureState\(error, parsed\.data\.email\);/);
  assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
});
