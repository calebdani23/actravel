import assert from "node:assert/strict";
import test from "node:test";

import { leadSearchInternals } from "@/lib/admin/leads";

test("lead search splits sanitized terms and keeps useful tokens", () => {
  assert.deepEqual(leadSearchInternals.splitSearchTerms("  Cancun, maria@example.com   "), ["Cancun", "maria@example.com"]);
  assert.deepEqual(leadSearchInternals.splitSearchTerms("a b 1234"), ["1234"]);
});

test("lead search clauses cover summary, source, ids, and related entities", () => {
  const search = leadSearchInternals.buildLeadSearchPlan("cancun lead-1234")!;
  const clauses = leadSearchInternals.buildLeadSearchClauses(search, {
    contactIds: ["contact-1"],
    destinationIds: ["dest-1"],
    leadIds: ["lead-1234"],
  });

  assert.match(clauses.join(","), /summary\.ilike\.%cancun%/i);
  assert.match(clauses.join(","), /source\.ilike\.%lead-1234%/i);
  assert.match(clauses.join(","), /contact_id\.in\.\(contact-1\)/);
  assert.match(clauses.join(","), /destination_id\.in\.\(dest-1\)/);
  assert.match(clauses.join(","), /id\.in\.\(lead-1234\)/);
});

test("lead search also inspects quote request campaign context payload", () => {
  const search = leadSearchInternals.buildLeadSearchPlan("summer sale")!;
  const clauses = leadSearchInternals.buildQuoteRequestSearchClauses(search);

  assert.match(clauses, /payload->>campaignContext\.ilike\.%summer%/i);
  assert.match(clauses, /payload->>campaignContext\.ilike\.%sale%/i);
});

test("lead search date helpers reject impossible dates and inverted ranges", () => {
  assert.equal(leadSearchInternals.validDate("2026-02-31"), undefined);
  assert.equal(leadSearchInternals.validDate("2026-02-28"), "2026-02-28");
  assert.deepEqual(leadSearchInternals.resolveCreatedAtRange({ from: "2026-06-10", to: "2026-06-09" }), {});
  assert.deepEqual(leadSearchInternals.resolveCreatedAtRange({ from: "2026-06-09", to: "2026-06-10" }), { from: "2026-06-09", to: "2026-06-10" });
});
