# Week 03 delivery follow-up

The publication hook identified a test-harness ownership defect after local
Week 03 closure: a failed Docker startup could remove a container owned by a
different test because cleanup used only its name.

`withPostgresContainer` now applies a unique per-invocation label and removes
only container IDs carrying that label. This also covers startup timeouts after
Docker has created the container. Legacy `psql` callers retain their target name.

The collision and ambiguous-timeout tests failed before the fix and passed
afterward. Independent injected-engine probes verified overlapping invocation
isolation and unchanged legacy SQL results. A local PostgreSQL run passed all
10 tests in the ownership and historical-approval suites with zero skips;
TypeScript passed. The overlap probe was also retained as a regression test.

This is test-harness maintenance, not a migration or product-policy change.
The sealed Week 03 archives remain unchanged. Remote state remains unknown.

Risk: items 3 and 4 — shared test-helper compatibility and concurrent cleanup.

The publication hook also identified a malformed owner-tag path in the shared
historical classifier. Owner facts now validate their closed tag domain and
canonical data shape before access; active roles must be an actual dense array.
A new malformed-owner regression failed before the correction and passed after
it. Existing first-contact and quote classification cases remain the safety net.
Risk: items 2 and 3 — owner eligibility validation shared by both classifiers.

Targeted publication review also reproduced two pre-existing quote-classifier
precedence errors. Independently provable occupancy now outranks missing sent
evidence; established source ambiguity prevents planning a new suppression even
when an exact response also exists. Both regressions failed before the fix, with
input hashes unchanged, and preserve manual review rather than inventing writes.
