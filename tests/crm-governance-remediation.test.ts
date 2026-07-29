import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("tombstone RLS is admin-reachable but advisor-scoped away", () => {
  const sql = read("db/migrations/0046_crm_governance_remediation.sql");
  assert.match(sql, /public\.is_admin\(\) and/);
  assert.match(sql, /public\.has_role\('asesor'\) and deleted_at is null/);
  assert.match(sql, /crm_bulk_archive_opportunities/);
  assert.match(sql, /crm_contact_aggregate_page/);
  assert.match(sql, /p_limit integer/);
  assert.match(sql, /count\(\*\) over\(\)/);
});

test("contact aggregation has no silent fixed caps or page-wide hydration fan-out", () => {
  const source = read("lib/admin/contacts.ts");
  const listSource = source.split("export async function getContact360")[0];
  assert.doesNotMatch(source, /\.limit\((500|1000|2000|3000)\)/);
  assert.match(listSource, /crm_contact_aggregate_page/);
  assert.match(listSource, /totalCount/);
  assert.doesNotMatch(listSource, /\.from\("(leads|quote_requests|contacts)"\)/);
  assert.doesNotMatch(source, /leadsByContact|requestsByLead|quoteVersionsResult/);
  assert.match(source, /crm_contact_360_summary/);
  assert.match(source, /crm_contact_opportunity_page/);
});

test("governance controls expose restore, unblock, archive, unarchive, unfeature, and live status options", () => {
  const actions = read("app/admin/(protected)/contacts/actions.ts");
  const toolbar = read("components/admin/contacts/bulk-toolbar.tsx");
  const detail = read("app/admin/(protected)/contacts/[id]/page.tsx");
  for (const name of ["restoreContacts", "unblockContacts", "archiveOpportunities", "unarchiveOpportunities", "unfeatureOpportunities", "updateOpportunityStatus"]) assert.match(actions, new RegExp(name));
  for (const label of ["Restaurar", "Desbloquear", "Archivar", "Desarchivar", "Quitar destacada", "Cambiar estado"]) assert.match(toolbar, new RegExp(label));
  assert.match(detail, /getLeadStatuses/);
  assert.match(detail, /statuses=\{statuses\}/);
});

test("bulk RPC service-role grants are explicitly removed and purge copy is test-data-only", () => {
  const sql = read("db/migrations/0046_crm_governance_remediation.sql") + read("db/migrations/0047_crm_archive_restore_controls.sql");
  assert.match(sql, /revoke all on function public\.crm_bulk_mutate[\s\S]*service_role/i);
  const detail = read("app/admin/(protected)/leads/[id]/page.tsx");
  assert.match(detail, /Purga permanente de datos de prueba/);
  assert.match(detail, /preflight confirma que no existe historial material/);
  assert.match(detail, /canDeleteLead && deletionSummary && deletionSummary\.isTestData && !deletionSummary\.error && !deletionSummary\.blocked/);
});
