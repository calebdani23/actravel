import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("account forms clear controlled values only after successful submissions", () => {
  const passwordForm = readFileSync("components/admin/account/password-change-form.tsx", "utf8");
  const emailForm = readFileSync("components/admin/account/email-change-form.tsx", "utf8");

  assert.match(passwordForm, /useEffect\(/);
  assert.match(passwordForm, /if \(!state\.ok\) return;/);
  assert.match(passwordForm, /formRef\.current\?\.reset\(\)/);
  assert.match(passwordForm, /ref=\{formRef\}/);

  assert.match(emailForm, /useEffect\(/);
  assert.match(emailForm, /if \(!state\.ok\) return;/);
  assert.match(emailForm, /formRef\.current\?\.reset\(\)/);
  assert.match(emailForm, /ref=\{formRef\}/);
});
