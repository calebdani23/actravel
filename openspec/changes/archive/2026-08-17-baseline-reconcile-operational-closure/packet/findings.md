# Exclusive Findings

Each named finding appears exactly once, with exactly one allowed classification and a distinct disposition. `reviewed_at: unavailable` is explicit; required unreviewed gates remain BLOCKED.

| Finding | Classification | Distinct disposition | Evidence refs | Owner | Authorizer | Review status | Reviewer role | reviewed_at | Limitations |
|---|---|---|---|---|---|---|---|---|---|
| `0051` | remote-only/untracked | Hold pending authoritative linkage | `prov-ledger-20260817-210521`, `protected-snapshot.md` | unassigned | read-only task scope | unreviewed / BLOCKED | unassigned | unavailable | Local file absent; ledger row alone does not authorize replay. |
| `drop_public_rate_limits_write_policy` | remote-only/untracked | Request provider statement provenance | `prov-ledger-20260817-210521`, `prov-policy-20260817-210521` | unassigned | read-only task scope | unreviewed / BLOCKED | unassigned | unavailable | Final policy state is not migration provenance. |
| `0020` | ambiguous/manual-review | Obtain owner decision linking local SQL to remote history | `protected-snapshot.md`, `prov-ledger-20260817-210521`, `prov-catalog-20260817-210521` | unassigned | read-only task scope | unreviewed / BLOCKED | unassigned | unavailable | Existing columns corroborate behavior only. |
| `0044` | ambiguous/manual-review | Review stored statement against local body | `protected-snapshot.md`, `prov-ledger-20260817-210521` | unassigned | read-only task scope | unreviewed / BLOCKED | unassigned | unavailable | Named ledger row does not prove local body execution. |
| `0045` | ambiguous/manual-review | Review stored statement against local body | `protected-snapshot.md`, `prov-ledger-20260817-210521` | unassigned | read-only task scope | unreviewed / BLOCKED | unassigned | unavailable | Same provenance limitation as 0044. |
| `0046` | ambiguous/manual-review | Require independent migration linkage | `protected-snapshot.md`, `prov-ledger-20260817-210521` | unassigned | read-only task scope | unreviewed / BLOCKED | unassigned | unavailable | Final state and ledger name are insufficient. |
| `0047` | ambiguous/manual-review | Require independent migration linkage | `protected-snapshot.md`, `prov-ledger-20260817-210521` | unassigned | read-only task scope | unreviewed / BLOCKED | unassigned | unavailable | Final state and ledger name are insufficient. |
| `0048` | ambiguous/manual-review | Require independent migration linkage | `protected-snapshot.md`, `prov-ledger-20260817-210521` | unassigned | read-only task scope | unreviewed / BLOCKED | unassigned | unavailable | Final state and ledger name are insufficient. |
| `0049` | ambiguous/manual-review | Require independent migration linkage | `protected-snapshot.md`, `prov-ledger-20260817-210521` | unassigned | read-only task scope | unreviewed / BLOCKED | unassigned | unavailable | Final state and ledger name are insufficient. |
| `0057/0060` | ambiguous/manual-review | Reconcile absent 0057 with reviewed 0060 cutover | `prov-ledger-20260817-210521`, `protected-snapshot.md`, `type-diff.md` | unassigned | read-only task scope | unreviewed / BLOCKED | unassigned | unavailable | 0060 may explain behavior but cannot erase history discrepancy. |

No catalog, archived packet, Docker state, local test, or generated type is used as migration provenance. The sole final gate remains `BLOCKED`; `0061+` remains unsafe.
