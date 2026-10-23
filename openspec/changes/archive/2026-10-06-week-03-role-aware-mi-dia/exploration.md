## Exploration: Week 03 Role-Aware Mi día

### Current State

This exploration uses local `main@50c82a05d5516320f514be43714e032484ac6eda` plus the pre-existing mixed Week 03 worktree. It performed no implementation, test execution, database operation, remote access, rollout, or closure work.

The canonical behavior already fixes most policy and MUST NOT be reopened:

- Active work is `pending|in_progress`; Task visibility and action authority are owner/Admin/Manager based. Admin sees all, an active owner sees own work, Manager sees active non-Admin-owned work, and Admin-owned work is Admin-only. Multirole sessions receive the union already encoded by `task_actor_can_manage` and Task RLS.
- Week 03 queue kinds are exactly `follow_up|first_contact|quote_follow_up`; `manual` is not admitted by this change. Due order is `due_at ASC,id ASC`; overdue is strictly `due_at < referenceTime`, so equality is not overdue.
- Human mutations use only `performTaskAction`/`task_action`. Pending work may start, complete, or cancel; first-contact completion uses `first_contact_completed`, other admitted kinds use `work_completed`, and cancellation uses the closed audited reasons. No direct Task update or legacy transition is allowed.
- `follow_up` remains Task-backed while `lead_events` remains history. First-contact and quote-follow-up Tasks already carry deterministic automation provenance. Historical readiness is an input capability, not a Mi día read or rollout gate.

Today the Dashboard reads every visible active `follow_up` Task in 1,000-row offset pages, sorts by due/id, and renders only the first eight. It excludes native automation kinds, has no Task actions, no user-facing pagination, and mixes the queue with generic metrics. `listTasks()` is unbounded and has only due ordering. CRM compatibility reads intentionally remain `follow_up`-only.

The Manager seam is material: Task RLS permits team work, but Manager-only navigation permits only Dashboard/Account and existing profile/CRM RLS does not expose other owners or CRM contexts. A direct joined PostgREST query therefore cannot provide a useful Manager owner/context label without either a narrow Mi día projection or an impermissible broad CRM grant.

**External research need:** None. The unresolved items are AC Travel UX/access decisions. Existing repository contracts already settle the database, action, role, automation, calendar, and Next.js patterns needed for planning.

### Affected Areas

- `db/migrations/0089_mi_dia_read_contract.sql` — proposed additive, bounded read projection/index; no edits to `0061`–`0088`.
- `lib/supabase/database.types.ts` — exact manual RPC return/argument types; no linked remote generation.
- `lib/admin/mi-dia.ts` — proposed server-only auth-first cursor decoder, strict result decoder, bucket mapping, and safe navigation policy.
- `lib/admin/task-actions.ts` — consumed unchanged as the sole audited mutation boundary.
- `lib/admin/dashboard.ts` — legacy follow-up queue must stop being the Mi día source; non-Task operational metrics remain preserved.
- `lib/admin/page-compositions.ts` — separate Mi día authorization/read failure from unrelated Manager dashboard/data-quality fallback.
- `app/admin/(protected)/dashboard/page.tsx` — make the work queue primary while preserving out-of-scope dashboard content.
- `app/admin/(protected)/dashboard/actions.ts` and `action-state.ts` — proposed safe form parsing, audited action invocation, feedback, and revalidation.
- `app/admin/(protected)/dashboard/loading.tsx` and `error.tsx` — proposed route-specific loading and retryable safe error states.
- `components/admin/tasks/mi-dia-task-list.tsx` — proposed accessible cards, action controls, empty state, and next-page navigation.
- `components/admin/admin-nav.ts` — role-aware Home label/link presentation without changing `/admin/dashboard`.
- `app/admin/(protected)/leads/[id]/page.tsx`, `app/admin/(protected)/contacts/[id]/page.tsx`, and `app/admin/(protected)/quotes/[id]/page.tsx` — navigation targets and preservation references; no CRM read-contract expansion.
- `tests/mi-dia-read-contract.test.ts`, `tests/mi-dia-read-runtime.test.ts`, `tests/mi-dia-adapter.test.ts`, `tests/mi-dia-actions.test.ts`, and `tests/mi-dia-page.test.tsx` — proposed focused contract, RLS, cursor, adapter, action, and state proof.
- `tests/follow-up-task-dashboard-cutover.test.ts`, `tests/admin-navigation.test.ts`, `tests/admin-route-boundaries.test.ts`, and `e2e/manager-capability.spec.ts` — exact existing tests to evolve.
- `tests/tasks-rls.test.ts`, `tests/task-actions-adapter.test.ts`, `tests/task-action-*.test.ts`, `tests/task-source-*.test.ts`, and `tests/crm-contact-*-task-read-runtime.test.ts` — mandatory unchanged-behavior regression families.

### Approaches

1. **Dedicated bounded Mi día read contract** — Add one typed page RPC that returns only authorized active Task rows plus minimal owner/context labels; consume it through a strict server adapter and the existing audited action boundary.
   - Pros: Exact supported-role parity, useful Manager rows without broad CRM grants, one failure boundary, limit-plus-one keyset pagination, closed kinds/shape, and strong runtime proof.
   - Cons: Requires additive SQL/types and careful proof that supported-actor RPC visibility exactly equals Task RLS; minimal context disclosure must be approved.
   - Effort: High

2. **Direct RLS PostgREST Task query** — Query `tasks` from `lib/admin/mi-dia.ts`, order by due/id, and enrich only relations independently visible to the caller.
   - Pros: Smallest change and literal Task RLS enforcement; no new RPC.
   - Cons: Manager rows cannot reliably show owner/context, joined RLS can silently remove enrichment, count/page failures can split, and the UI contract becomes coupled to provider query shapes.
   - Effort: Medium

3. **Extend the existing Dashboard fetch-all queue** — Include all three kinds, fetch all pages, then group/slice in TypeScript.
   - Pros: Reuses current code and requires no new SQL boundary.
   - Cons: No user cursor contract, increasing read cost, unstable page semantics under mutation, no Manager-safe enrichment, and continued coupling to the generic Dashboard.
   - Effort: Low initially, but unsuitable

### Recommendation

Use **Approach 1**. Keep `/admin/dashboard` as the stable Home route, place Mi día before decorative metrics, and preserve existing non-Task Dashboard sections for roles outside this bounded queue. Do not broaden general profile, Contact, Opportunity, or Quote RLS. The new read boundary must authenticate an active `admin|manager|asesor`, require expected-actor equality, select only rows satisfying the exact Task authorization helper, and prove its Task-ID set equals direct-RLS-visible active work only for supported Admin, Manager, and Asesor actors.

Return minimal owner/context display only for an already-authorized Task. Admin may receive direct `/admin/leads/{leadId}` or `/admin/quotes/{quoteId}` navigation under existing Admin access. An Asesor-capable session may receive a Lead link only when the exact current `crm_advisor_can_access_live_opportunity(leadId)` check passes, and a Quote link only when the exact current `crm_can_read_quote(quoteId)` check passes; Task ownership or Manager team visibility never grants a link. Stale, missing, purged, or otherwise inaccessible contexts and their `navigationHref` remain `null`. Add no profile or CRM grant or policy.

Use fixed page size 20, clamp the database contract to 1–50, fetch `limit+1`, and keyset on the exact `(due_at,id)` pair. A cursor carries the first-page `referenceTime` plus `afterDueAt/afterId`; unchanged data therefore yields stable pages with no offset drift. Classification precedence is `overdue` when `dueAt < referenceTime`, `today` when equality-or-later is before the next chosen local midnight, otherwise `upcoming`. Bucket labels never alter canonical due/id order.

Loading uses a Dashboard-specific skeleton; zero rows is a role-aware success empty state; unsupported staff roles perform no Dashboard Mi día read and retain the existing Dashboard; auth denial occurs before reads; query/malformed-result failure renders one retryable safe error with no event fallback or partial queue. Separately from supported-role Task-ID parity, direct read and action coverage must submit self-owned active admitted Task IDs for Operations, Finance, Marketing, and unknown/other unsupported-only actors and prove exact `AUTH_ROLE_UNSUPPORTED` before any Task lookup, CRM route-authority lookup, or canonical action invocation. Action feedback is inline, provider text is suppressed, and success revalidates Dashboard plus the authorized context route.

**Result Contract.** Planning should formalize:

- Read input: exactly `{referenceTime,limit,afterDueAt,afterId}` internally, with cursor fields all-null or all-present, canonical UTC timestamps/UUID, and server-established first-page time.
- Read success: exactly `{ok:true,referenceTime,todayStart,tomorrowStart,scope,counts,items,pageInfo}` where `scope=self|team|all`, `counts={overdue,today,upcoming,total}`, and `pageInfo={hasMore,nextCursor}`.
- Item: exactly `{taskId,ownerId,ownerLabel,kind,status,description,dueAt,bucket,leadId,quoteId,navigationHref}`; kind/status are closed, one context matches kind, and `navigationHref` is nullable and policy-derived, never caller-supplied.
- Read failure: exact code-only `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_ROLE_UNSUPPORTED|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|PERSISTENCE_FAILURE`; no provider text, PII, partial items, or event fallback.
- Action input/result: reuse the exact canonical Task action contract and immutable receipt result after the Mi día wrapper's auth-first supported-role check; wrapper-only `AUTH_ROLE_UNSUPPORTED` occurs before Task lookup/action and does not alter the canonical action failure union. UI request IDs persist across retry; `already_at_target` is success; conflict/forbidden/invalid-transition/provider failures map to safe Spanish feedback without optimistic status mutation.

**User-confirmed decisions (no open decisions):**

1. Use `America/Mexico_City` for the Mi día calendar boundary. UTC due/overdue semantics remain unchanged.
2. Permit the narrow projection to disclose owner display name and a safe context label to a Manager already authorized for that Task, while retaining no general CRM/profile grant and no inaccessible deep link.
3. Keep Operations, Finance, and Marketing on the existing operational Dashboard with no Mi día read/action. This change must not silently remove their current Dashboard.

**Bounded delivery forecast:** five native slices, each including tests/types/docs and capped at 400 changed lines: (1) read RPC/index and RLS runtime proof, 340–395; (2) strict adapter/cursor/bucket contract, 280–350; (3) queue page/loading/empty/pagination states, 330–395; (4) audited action forms and retry/result mapping, 300–380; (5) role-aware navigation/route error/E2E/regression/routing evidence, 280–360. Split by complete behavior if any estimate exceeds 400; never compress proof or separate tests from behavior.

### Risks

- A Manager projection that bypasses or merely approximates `task_actor_can_manage` could expose Admin-owned or otherwise hidden work.
- Broad profile/CRM policy changes would exceed scope; Asesor links can still disclose route existence or end in denial unless gated by the exact current `crm_advisor_can_access_live_opportunity` or `crm_can_read_quote` check, with stale or inaccessible context kept null.
- Offset pagination, due-only cursors, or a refreshed reference time can duplicate/reclassify rows; Task rescheduling means guarantees must be stated for unchanged data, not historical snapshots.
- Completing first-contact with a generic outcome is rejected by the existing database trigger; UI mapping must be kind-aware and server-validated.
- Fetching action receipts into the page is unnecessary and could increase disclosure; receipt persistence should be proven through the existing action result/tests, not a new timeline.
- The worktree is already mixed and migrations `0068`–`0088` remain local/unapplied; `0089` is a local planning allocation only and authorizes no rollout.

### Ready for Proposal

**Yes.** The architecture, exact existing invariants, affected paths, result envelope, state model, and ≤400-line slicing are clear. The user confirmed `America/Mexico_City`, narrow Manager owner/context disclosure without CRM expansion, and existing Dashboard preservation for Operations/Finance/Marketing. No open decisions remain, and the orchestrator may proceed to proposal. Remote rollout, notifications, new SLA/automation/bootstrap policy, and final Week 03 closure reconciliation remain explicitly excluded.
