# Tasks design provenance

Archived 2026-08-25 after the maintainer-authorized planning restructure.

The bulky `design.blocked.md` body now lives under
`tmp/audit-evidence/week02-closure-provenance/` at its original repository-relative path.
It is bound by LF-normalized manifest aggregate SHA-256
`764a1cb3827368f0f5a1b38f681accee29bfbe9b2def3f592caf6acccda2604e` and summarized in
`openspec/changes/week-02-gate0-shadow-harness/provenance-manifest.json`.

The validator rejected the prior Tasks design because it bundled the general
Gate 0/shadow/type harness and framework ownership into the Tasks child,
coupling the review boundary and child sequence. It is superseded and
non-authoritative. The active Tasks spec remains in force for now and will be
reconciled during its spec phase to consume the Harness child.
