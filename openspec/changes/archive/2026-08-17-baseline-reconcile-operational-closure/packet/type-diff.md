# Generated Type Preservation Evidence

Captured `2026-08-17T21:05:21Z` UTC after the exact provider guard. The MCP response's actual `types` string was extracted from `tool_0118a0922001FQm8tPVReAGFz3`, not the MCP/JSON envelope. Only CRLF/CR to LF normalization was applied. `npm run db:types` was not run and no tracked path was redirected.

| Artifact | Exact result |
|---|---|
| Ignored generated payload | `tmp/audit-evidence/baseline-reconcile-remote-types.ts`; `git check-ignore -v` matched `.gitignore:30:tmp/` |
| Fresh payload | 113159 bytes; SHA-256 `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637` |
| Tracked TypeScript pre/post | `lib/supabase/database.types.ts`; `3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436` / identical post hash |
| Diff | non-equal; 2238 unified-diff lines; patch SHA-256 `03b7b5f902b65a638080fcb624e3e17d60f574c4ed4f72e5c20b77e5d3cba2cc` |
| Interpretation | Fresh remote payload differs from tracked types; this reports drift, without attributing cause or proving migration provenance. |

The tracked file hash was rechecked after extraction and remained unchanged. The ignored payload and diff are runtime evidence only; no application, migration, DDL, DML, or type overwrite occurred.

**Review:** owner `unassigned`; authorizer `task-scoped read-only authorization`; review status `unreviewed`; reviewer role `unassigned`; reviewed_at `unavailable`; evidence refs `protected-snapshot.md`, `provider-evidence.md`, `validation.md`.
