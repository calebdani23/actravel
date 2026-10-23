# Proposal: Week 03 Role-Aware Mi día

## Intent

Turn the stable `/admin/dashboard` home into a bounded, role-aware operational queue for active Week 03 Tasks without reopening canonical Task authorization, automation, action-audit, cutover, or historical-bootstrap policy. Admin, Manager, and Asesor sessions need actionable work ordered by due time; Operations, Finance, and Marketing must retain the existing Dashboard unchanged.

## Scope

### In Scope
- Add dedicated additive migration `0089_mi_dia_read_contract.sql` with exactly one tightly constrained `SECURITY DEFINER` typed read RPC for active `follow_up|first_contact|quote_follow_up` Tasks.
- Enforce current-actor and exact `task_actor_can_manage` Task-ID parity only for supported Admin, Manager, and Asesor actors; reject Operations, Finance, Marketing, and unknown roles as `AUTH_ROLE_UNSUPPORTED` even for self-owned Tasks, without changing canonical Task RLS. Expose minimal owner/context display only through that already-authorized projection; do not add broad profile/CRM grants or broaden Contact, Opportunity, Quote, or Task policy.
- Add a strict server-only Mi día adapter with auth-first access, exact input/result decoding, fixed-time bucket classification, and `(due_at,id)` keyset pagination.
- Make Mi día primary on `/admin/dashboard` for active Admin, Manager, and Asesor sessions while preserving existing non-Task Dashboard content and the complete existing Dashboard for Operations, Finance, and Marketing.
- Reuse `performTaskAction`/`task_action` unchanged for start, kind-aware completion, and cancellation; add safe form parsing, retry-stable request IDs, inline feedback, and authorized revalidation.
- Add accessible loading, empty, retryable error, paginated success, action-pending, action-success, and safe action-failure states, with role-aware navigation and the route-level error boundary owned by S5.
- Plan focused SQL/RLS, adapter, action, component, route, navigation, E2E, and unchanged-behavior regression proof.
- Deliver through five automatically chained native slices, each capped at 400 changed lines and containing its own behavior, types, tests, and evidence.

### Out of Scope
- New Task, role, Manager-capability, SLA, automation, bootstrap, lifecycle, action, or CRM authorization policy.
- New Task kinds, direct Task updates, legacy transitions, action receipt timelines, reassignment, rescheduling, bulk actions, or final closure workflows.
- Notifications, reminders, escalations, background jobs, analytics, or new remote/external integrations.
- Broad profile/CRM reads, Manager deep-link grants, event fallback, dual-read behavior, or changes to historical `lead_events`.
- Remote inspection or mutation, migration rollout, production-readiness claims, and final Week 03 closure reconciliation.

## Capabilities

### New Capabilities
- `role-aware-mi-dia`: bounded authorized Task-page reads, Mexico City day buckets, strict server adaptation, role-aware Dashboard presentation, safe navigation, audited actions, complete UI states, and verification.

### Modified Capabilities
- `follow-up-task-application-cutover`: replace the legacy Dashboard's fetch-all, follow-up-only queue requirement with the bounded Mi día source while preserving Task-backed CRM reads, historical event reads, and non-follow-up Dashboard behavior.

## Approach

Add exactly one `SECURITY DEFINER` `0089` page RPC, owned by `postgres`, with a fixed empty `search_path`. The RPC independently authenticates the current active actor, requires `auth.uid()` to equal the expected actor, admits only `admin|manager|asesor`, and filters every projected Task through `task_actor_can_manage`; exact Task-ID parity with direct Task RLS is claimed only for those supported actors. Operations, Finance, Marketing, and unknown roles return `AUTH_ROLE_UNSUPPORTED` before any Task projection regardless of self-ownership and are not included in the parity claim; this read-contract restriction does not change canonical Task RLS. Revoke all function privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`, then grant `EXECUTE` to `authenticated` only. The projection may derive only the narrow Manager owner/context display for a Task already authorized by those checks; it creates no broad profile/CRM grant or table policy. An Asesor receives `navigationHref` only after separate current Lead/Quote route-authority validation through the existing CRM access helpers and policies; otherwise it is `null`. Other deep links are likewise derived server-side only when the current session independently has access to the target route; Task visibility alone never grants a link.

Use server-established `referenceTime` and `America/Mexico_City` calendar boundaries. UTC due timestamps and the canonical overdue predicate remain unchanged: `dueAt < referenceTime` is overdue and equality is not. Preserve `due_at ASC,id ASC`, use a fixed application page size of 20, clamp the database limit to 1–50, fetch `limit+1`, and carry the first-page reference time with the exact keyset cursor. Page stability is guaranteed for unchanged data, not as a historical snapshot across Task mutations.

Keep `/admin/dashboard` as the route. Admin receives all authorized work, Manager receives the existing team scope, and Asesor receives self scope under canonical multirole union behavior. Operations, Finance, and Marketing perform no Mi día read or action and continue to receive their current Dashboard and navigation presentation. Mi día failures remain isolated from unrelated Dashboard metrics and Manager data-quality fallbacks.

Actions continue through the canonical `performTaskAction` boundary only. The UI maps first-contact completion to `first_contact_completed`, other admitted completion to `work_completed`, and cancellation to the existing closed reasons. `already_at_target` is success; conflicts, forbidden requests, invalid transitions, and persistence failures produce safe Spanish feedback without optimistic mutation or provider text.

The five auto-chained slices are: (1) `0089`, manual types, supported-actor SQL/RLS Task-ID parity, unsupported-role rejection, and grant proof; (2) strict adapter, cursor, and bucket contract; (3) Dashboard queue plus local loading/empty/read-failure/pagination states; (4) audited action forms and result mapping; and (5) role-aware navigation, the route-level error boundary, E2E/regression/routing evidence, and documentation. A slice that would exceed 400 changed lines must split by complete behavior rather than compress proof or separate tests from behavior.

## Confirmed Decisions

- Mi día calendar boundaries use `America/Mexico_City`; canonical UTC due values and strict overdue semantics remain unchanged.
- Managers may receive only the narrow owner/context display for Tasks already authorized by the current-actor and `task_actor_can_manage` checks; no general profile/CRM grant or inaccessible deep link is allowed.
- Exact RPC/direct-Task-RLS Task-ID parity applies only to supported Admin, Manager, and Asesor actors. Operations, Finance, Marketing, and unknown roles fail the Mi día read with `AUTH_ROLE_UNSUPPORTED`, including for self-owned Tasks, without changing canonical Task RLS.
- Asesor `navigationHref` requires independent current Lead/Quote route authority through existing CRM access helpers and policies; absent that authority, it is `null` even when the Task itself is visible.
- Operations, Finance, and Marketing retain the existing Dashboard and perform no Mi día read or action.
- `0089` uses the single constrained `SECURITY DEFINER` RPC and closed grant sequence above; role-aware navigation and the route-level error boundary remain S5-owned. No decisions remain open.

## Result Contract

- Read input is exactly `{referenceTime,limit,afterDueAt,afterId}` internally. Cursor fields are all null or all present; timestamps are canonical UTC, IDs are canonical lowercase UUIDs, and the server establishes first-page time.
- Read success is exactly `{ok:true,referenceTime,todayStart,tomorrowStart,scope,counts,items,pageInfo}` where `scope=self|team|all`, `counts={overdue,today,upcoming,total}`, and `pageInfo={hasMore,nextCursor}`.
- Each item is exactly `{taskId,ownerId,ownerLabel,kind,status,description,dueAt,bucket,leadId,quoteId,navigationHref}`. Kind and status are closed, context matches the Task kind, narrow Manager owner/context display comes only from the authorized projection, and `navigationHref` is nullable and policy-derived, never caller-supplied. In particular, Asesor links require an independent current Lead/Quote route-authority decision through existing CRM access helpers and policies; otherwise they are `null`.
- Bucket precedence is `overdue` when `dueAt < referenceTime`, `today` when equality-or-later is before the next `America/Mexico_City` midnight, and `upcoming` otherwise. Buckets never alter canonical due/id order.
- Read failure is code-only `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_ROLE_UNSUPPORTED|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|PERSISTENCE_FAILURE`, with no provider text, PII, partial items, or event fallback.
- Action input and result reuse the exact canonical Task action and immutable receipt contracts. Request IDs persist across retry; `already_at_target` is success; no new mutation result or receipt-read contract is introduced.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `db/migrations/0089_mi_dia_read_contract.sql` | New | Single constrained `SECURITY DEFINER` page RPC with supported-actor Task-ID parity, unsupported-role rejection, closed grants, and supporting index only. |
| `lib/supabase/database.types.ts` | Modified | Exact manual `0089` argument and return types; no remote generation. |
| `lib/admin/mi-dia.ts` | New | Auth-first cursor validation, strict decoding, bucket mapping, and safe navigation. |
| `lib/admin/task-actions.ts` | Reused | Sole audited mutation boundary; behavior remains unchanged. |
| `lib/admin/dashboard.ts`, `lib/admin/page-compositions.ts` | Modified | Retire the legacy queue as Mi día source and isolate queue failure from preserved content. |
| `app/admin/(protected)/dashboard/` | Modified | Role-aware page and loading in S3, server actions/state in S4, and route-level error boundary in S5. |
| `components/admin/tasks/mi-dia-task-list.tsx` | New | Accessible cards, pagination, action controls, feedback, and empty state. |
| `components/admin/admin-nav.ts` | Modified | S5-owned role-aware Home label while retaining `/admin/dashboard`. |
| `tests/mi-dia-*.test.*` | New | Read contract/runtime, adapter, actions, page, and state proof. |
| Existing Task/dashboard/navigation/route/E2E suites | Modified | Role matrix and unchanged canonical behavior regression proof. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Privileged Manager projection leaks Admin-owned work or broad CRM/profile data | High | Constrain the sole definer RPC with owner `postgres`, empty `search_path`, current-actor equality, per-row `task_actor_can_manage`, closed grants, allow-listed fields, and exact supported-actor Task-ID parity proof against RLS. |
| Task-visible rows expose inaccessible CRM routes | Med | For Asesor, validate current Lead/Quote route authority independently through existing CRM access helpers and policies; return `navigationHref: null` without that authority. Apply the same independent-authority rule to all links; nullable non-linking context is valid. |
| Cursor pages duplicate, skip, or reclassify work | Med | Freeze first-page reference time, keyset on `(due_at,id)`, use limit-plus-one, and state the unchanged-data guarantee explicitly. |
| First-contact actions use an invalid generic outcome | Med | Map completion by closed Task kind and keep server/database validation authoritative. |
| Mi día regressions remove non-Sales Dashboard access or content | Med | Branch before the Mi día read and preserve role-specific route/navigation/page regression coverage. |
| Local `0089` is mistaken for remote readiness or Week 03 closure | High | Keep all evidence local/disposable and retain explicit remote, rollout, and closure exclusions. |

## Rollback Plan

Revert Dashboard callers, navigation, components, and actions first so `/admin/dashboard` returns to its existing queue and role behavior. Then remove the Mi día adapter and manual `0089` types. If `0089` remains local and unapplied, remove only that migration; if it has been applied under a separately authorized rollout, use a new forward migration to revoke/drop only the Mi día RPC and index after callers are reverted. Never edit `0061`–`0088`, delete Tasks or receipts, restore legacy transitions, rewrite events, or perform an unauthorized remote operation.

## Dependencies

- `tasks-foundation` for Task shape, active states, ordering, and `task_actor_can_manage` authorization.
- `task-action-audit` for the sole human mutation and immutable receipt contract.
- `task-automation-foundation` and `task-source-automation` for native Task kinds, due rules, and completion semantics.
- `follow-up-task-read-contracts` and `follow-up-task-application-cutover` for Task-backed reads, history separation, and Dashboard preservation.
- `task-automation-historical-classification`, `task-automation-historical-preview`, `task-automation-historical-approval`, and `task-automation-historical-apply` as consumed local readiness capabilities, not runtime Mi día policy or rollout gates.
- `manager-capability-authorization` for stable Manager role and multirole semantics; its generic capability catalog is not expanded.

## Success Criteria

- [ ] The sole `0089` read RPC is `SECURITY DEFINER`, owned by `postgres`, uses a fixed empty `search_path`, enforces current-actor equality and per-row `task_actor_can_manage`, and returns a Task-ID set exactly equal to direct-RLS-visible active admitted work for supported Admin, Manager, and Asesor actors, including supported multirole and Admin-owned cases.
- [ ] Direct RPC coverage separately proves Operations, Finance, Marketing, and unknown-role actors each receive `AUTH_ROLE_UNSUPPORTED` when invoking Mi día against a self-owned active admitted Task, without changing canonical Task RLS or extending the Task-ID parity claim to those actors; inactive actors remain covered by the existing auth failure contract.
- [ ] Function privileges are revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role` before `EXECUTE` is granted to `authenticated` only, with no broad profile/CRM grant or new table policy.
- [ ] Pages are closed, strictly decoded, ordered by `(due_at,id)`, limited to 20 in the app, and stable for unchanged data with one carried reference time.
- [ ] Day buckets use `America/Mexico_City`; UTC due values and strict overdue equality behavior remain unchanged.
- [ ] Manager owner/context labels remain narrow and available only through the authorized projection, with no broad profile/CRM grant or unauthorized deep link; Asesor `navigationHref` is present only after independent current Lead/Quote route-authority validation through existing CRM access helpers and policies and is otherwise `null`.
- [ ] `/admin/dashboard` provides complete Mi día states and canonical audited actions for Admin/Manager/Asesor, while Operations/Finance/Marketing retain the existing Dashboard without a Mi día read.
- [ ] Existing Task action, automation, cutover, CRM history/read, navigation, and route-boundary regression families remain passing with no event fallback or direct Task mutation; role-aware navigation and the route-level error boundary are delivered in S5.
- [ ] Five native slices auto-chain in dependency order, each stays at or below 400 changed lines, and no slice separates proof from its behavior.
- [ ] Verification makes no remote parity, rollout, production-readiness, notification, automation-policy, or Week 03 closure claim.
