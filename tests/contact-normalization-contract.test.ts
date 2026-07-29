import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CONTACT_NORMALIZATION_PARITY_CASES, CRM_NORMALIZATION_SQL_ASCII_TRANSLATE } from "@/lib/leads/contact-normalization";

test("contact normalization migration codifies the shared runtime parity contract and trigger", () => {
  const migrationSource = readFileSync("db/migrations/0032_contact_normalization_trigger.sql", "utf8");

  assert.match(migrationSource, /create or replace function public\.crm_normalize_identity_ascii/i);
  assert.match(migrationSource, new RegExp(CRM_NORMALIZATION_SQL_ASCII_TRANSLATE.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(migrationSource, /create or replace function public\.crm_apply_contact_normalization/i);
  assert.match(migrationSource, /create trigger set_contacts_normalized_identity/i);
  assert.match(migrationSource, /before insert or update on public\.contacts/i);
  assert.match(migrationSource, /update public\.contacts\s+set normalized_email = public\.crm_normalize_email\(email\),\s+normalized_phone = public\.crm_normalize_phone\(phone\)/i);
  assert.match(migrationSource, /gmail dot\/plus aliases/i);
  assert.match(CONTACT_NORMALIZATION_PARITY_CASES.supportedScope, /full-width ASCII folding/i);
});
