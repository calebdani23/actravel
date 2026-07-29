import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const FUNCTION_SIGNATURE = String.raw`public\.crm_resolve_opportunity_lead\(\s*uuid,\s*uuid,\s*uuid,\s*text,\s*text,\s*text,\s*uuid,\s*uuid,\s*date,\s*date,\s*integer,\s*numeric,\s*numeric,\s*text,\s*smallint,\s*jsonb\s*\)`;

test("crm opportunity resolver migrations revoke PUBLIC/anon and re-grant only authenticated plus service_role", () => {
  const initialMigration = readFileSync("db/migrations/0031_crm_opportunity_resolution_rpc.sql", "utf8");
  const followupMigration = readFileSync("db/migrations/0033_crm_opportunity_resolution_rpc_revoke_public.sql", "utf8");

  assert.match(initialMigration, new RegExp(`revoke all on function ${FUNCTION_SIGNATURE} from public;`, "i"));
  assert.match(initialMigration, new RegExp(`revoke all on function ${FUNCTION_SIGNATURE} from anon;`, "i"));
  assert.match(initialMigration, new RegExp(`grant execute on function ${FUNCTION_SIGNATURE} to authenticated;`, "i"));
  assert.match(initialMigration, new RegExp(`grant execute on function ${FUNCTION_SIGNATURE} to service_role;`, "i"));
  assert.doesNotMatch(initialMigration, new RegExp(`grant execute on function ${FUNCTION_SIGNATURE} to anon;`, "i"));
  assert.doesNotMatch(initialMigration, new RegExp(`grant execute on function ${FUNCTION_SIGNATURE} to public;`, "i"));

  assert.match(followupMigration, /already-deployed environments/i);
  assert.match(followupMigration, /auth\.uid\(\) is null for anonymous callers/i);
  assert.match(followupMigration, new RegExp(`revoke all on function ${FUNCTION_SIGNATURE} from public;`, "i"));
  assert.match(followupMigration, new RegExp(`revoke all on function ${FUNCTION_SIGNATURE} from anon;`, "i"));
  assert.match(followupMigration, new RegExp(`grant execute on function ${FUNCTION_SIGNATURE} to authenticated;`, "i"));
  assert.match(followupMigration, new RegExp(`grant execute on function ${FUNCTION_SIGNATURE} to service_role;`, "i"));
  assert.doesNotMatch(followupMigration, new RegExp(`grant execute on function ${FUNCTION_SIGNATURE} to anon;`, "i"));
  assert.doesNotMatch(followupMigration, new RegExp(`grant execute on function ${FUNCTION_SIGNATURE} to public;`, "i"));
});

test("resolver call paths still require only authenticated session clients or service-role server clients", () => {
  const manualLeadAction = readFileSync("app/admin/(protected)/leads/new/actions.ts", "utf8");
  const quoteRequestService = readFileSync("lib/leads/quote-request-service.ts", "utf8");
  const whatsappInboundService = readFileSync("lib/leads/whatsapp-inbound-service.ts", "utf8");
  const adminClient = readFileSync("lib/supabase/admin.ts", "utf8");
  const sessionClient = readFileSync("lib/supabase/server.ts", "utf8");

  assert.match(manualLeadAction, /const supabase = await createClient\(\);/);
  assert.match(quoteRequestService, /const supabase = createSupabaseAdminClient\(\);/);
  assert.match(whatsappInboundService, /createSupabaseClient: createSupabaseAdminClient/);
  assert.match(adminClient, /SUPABASE_SECRET_KEY/);
  assert.match(sessionClient, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);

  // Source-contract coverage only. A live Supabase integration test is still needed
  // to verify anonymous invocation is rejected while authenticated/service_role calls succeed.
});

test("0045 requires advisor visibility before resolver mutation", () => {
  const migration = readFileSync("db/migrations/0045_crm_resolver_soft_delete_review.sql", "utf8");
  assert.match(migration, /actor_advisor and not actor_admin then[\s\S]*?if not exists \(select 1 from public\.leads l where l\.contact_id=p_contact_id and l\.assigned_to=actor_id and l\.deleted_at is null\)/i);
  assert.match(migration, /raise insufficient_privilege using message='Advisors may only resolve visible contacts'/i);
  assert.match(migration, /if not exists[\s\S]*?raise insufficient_privilege[\s\S]*?if p_assigned_to is not null/i);
  assert.match(migration, /actor_id is not null and actor_advisor and not actor_admin/);
});
