# Design: Week 03 Role-Aware Mi día

## Technical Approach

Mi día remains on `/admin/dashboard` and consumes the current `tasks` table, `task_actor_can_manage(uuid)`, and `performTaskAction`/`task_action` contracts without changing their policy or lifecycle. Migration `0089_mi_dia_read_contract.sql` adds one read-only JSON page RPC and one partial ordering index. That bounded RPC derives an Asesor link only after the existing current Lead or Quote route-authority helper independently approves the exact context; Task visibility or ownership never substitutes for CRM authority. A server-only adapter authenticates before constructing the RPC client, validates an exact cursor, establishes the first-page time, strictly decodes the database result without upgrading a null link, and returns only the closed public result.

Dashboard composition branches immediately after route authorization. Active role unions containing `admin`, `manager`, or `asesor` start Mi día and call the preserved metrics reader with the legacy follow-up queue disabled. Unsupported-only Operations, Finance, and Marketing unions never construct a Mi día promise and execute the current Dashboard path unchanged. The Mi día promise is rendered under a local `Suspense` boundary so read failures and loading do not replace unrelated Dashboard content. Human mutations continue through the unchanged audited action boundary, but a Mi día-specific authorization wrapper first resolves authentication, active-profile state, and supported role union. Only a supported actor reaches exact form parsing, RLS-scoped Task context lookup, intent mapping, `performTaskAction`, or success revalidation.

This maps directly to `role-aware-mi-dia` and the `follow-up-task-application-cutover` delta: active kinds are `follow_up|first_contact|quote_follow_up`, active statuses are `pending|in_progress`, order is `due_at,id`, pages contain 20 items, counts cover the complete authorized set, and calendar boundaries use `America/Mexico_City`.

## Architecture Decisions

### Decision: Use one narrowly scoped `SECURITY DEFINER` JSON RPC

**Choice**: `public.read_mi_dia_page(text,uuid,integer,text,text)` is `STABLE SECURITY DEFINER SET search_path = ''`, owned by `postgres`, executable only by `authenticated`, and explicitly filters every Task through `public.task_actor_can_manage(t.owner_id)`. It projects only Task fields plus `pg_catalog.btrim(profiles.full_name)` for already-authorized rows.

**Alternatives considered**: A `SECURITY INVOKER` RPC; an invoker RPC plus a second privileged label helper/view; broader Manager SELECT policy on `profiles`; direct PostgREST joins.

**Rationale**: The proposal and specification both require the single definer boundary because current executable reality in `0008_rls.sql` permits profile SELECT only to self or Admin; an invoker RPC cannot return another owner's label to Manager. A second helper/view creates another callable disclosure boundary, and broader profile policy is expressly excluded. Exact current-actor authentication, active/supported-role checks, expected-actor equality, per-row helper parity, allow-listed output, fully qualified object references, fixed empty search path, closed grants, and disposable complete-set RLS equality tests constrain the privilege without changing Task authorization policy.

### Decision: Return the final closed page envelope from PostgreSQL and verify it again in TypeScript

**Choice**: The RPC returns camel-case JSON matching the public success/failure contract, including buckets, counts, cursor, and policy-derived navigation. `lib/admin/mi-dia.ts` accepts no provider-specific shape: it checks exact own data properties, closed values, canonical timestamps/UUIDs, scope, bucket math, order, uniqueness, count equations, navigation, and cursor coherence. It accepts `navigationHref=null` as the safe result for any item and never synthesizes a link from Task ownership; a non-null link must independently pass the adapter's exact role/owner/kind/context/path coherence checks.

**Alternatives considered**: Returning table rows and assembling counts/cursors in separate application queries; returning snake-case rows and trusting application derivation; direct Task pages plus independent profile reads.

**Rationale**: One statement gives counts and page rows from the same PostgreSQL statement snapshot and prevents split failures. Independent TypeScript verification ensures a malformed or unexpectedly broadened provider response cannot construct public success.

### Decision: Count the complete set and page it in one materialized authorized CTE

**Choice**: Each call materializes the complete active, admitted, helper-authorized Task set once. One aggregate computes all four counts without the cursor; one ordered branch applies the strict cursor and `effective_limit + 1`. The extra row only determines `hasMore`.

**Alternatives considered**: Exact-count query plus a second page query; counts from the current page; offset pagination; cached counts.

**Rationale**: The specification requires complete counts on every page. A single statement prevents count/page transaction drift within one call, while `(due_at,id)` keysets avoid offset drift. Across calls, stability remains explicitly limited to unchanged data and authorization.

### Decision: Use separate auth and read clients in the strict adapter

**Choice**: The adapter follows the existing historical-bootstrap auth pattern: an auth client resolves user, own profile activity, and exact roles; only after supported scope and request validation does it construct a separate read client and call `read_mi_dia_page`.

**Alternatives considered**: Relying only on protected-layout auth; using `requireAdminRole` and losing the distinction between unauthenticated and inactive; constructing the RPC client before cursor validation.

**Rationale**: This makes `AUTH_REQUIRED`, `AUTH_INACTIVE`, and `AUTH_ROLE_UNSUPPORTED` observable and testable, proves auth-first ordering, and guarantees invalid input cannot start a Mi día provider read. The RPC repeats all authorization decisions independently.

### Decision: Branch Dashboard data acquisition before Mi día setup

**Choice**: `composeDashboardPage` returns a discriminated `legacy` or `mi-dia` composition. The legacy branch invokes `getDashboardMetrics()` exactly as today. The Mi día branch invokes `getDashboardMetrics({ includeLegacyFollowUps:false })`, data quality, and a Mi día promise only after route authorization. Existing Manager fallback inspects only existing metric/data-quality failures; a closed Mi día failure resolves inside its section.

**Alternatives considered**: Always call Mi día and hide it for unsupported roles; keep the fetch-all queue running behind the new UI; let Mi día failure reject the whole composition.

**Rationale**: Branching is required to preserve unsupported-role behavior and to prove no Mi día work occurs. Disabling rather than hiding the old queue eliminates its 1,000-row paging cost for supported roles. A local promise/Suspense boundary gives real loading and failure isolation.

### Decision: Deny unsupported action actors before touching Task context

**Choice**: The action wrapper first calls the same strict Mi día actor authorization used by the read adapter. It returns `AUTH_REQUIRED` for no authenticated actor, `AUTH_INACTIVE` for a missing or inactive profile, and `AUTH_ROLE_UNSUPPORTED` for an active Operations-only, Finance-only, Marketing-only, any recognized unsupported-only union, or unknown-only role set. Every preliminary denial returns exactly `Tu sesión ya no permite actualizar esta tarea.` and occurs before form parsing can trigger a Task read, before the RLS-scoped lookup for `id,owner_id,task_kind,status,lead_id,quote_id`, before `performTaskAction`, and before any `revalidatePath`. For a supported actor, the exact five-field parser runs, the lookup must match the submitted admitted `taskKind`, the wrapper derives the optional authorized path, and only then does it call `performTaskAction` unchanged with the already-authorized session dependency.

**Alternatives considered**: Relying on `performTaskAction`'s broad `requireAdminRole()` call; authorizing after the Task lookup; trusting the hidden `taskKind`; accepting `navigationHref` from the form; adding `AUTH_ROLE_UNSUPPORTED` to the canonical Task action union; direct Task update.

**Rationale**: `performTaskAction` currently accepts any authenticated admin-shell role and therefore cannot by itself enforce Mi día role availability. Wrapper-first authorization prevents unsupported actors from using a forged form as a Task-existence oracle and guarantees zero canonical invocation, receipt mutation, or cache invalidation. The subsequent immutable/RLS-scoped preflight closes the kind/outcome seam without changing the canonical failure union or mutation behavior. No caller-controlled path reaches `revalidatePath`.

### Decision: Keep URLs simple and policy-derived

**Choice**: Next-page URLs use exactly `referenceTime`, `afterDueAt`, and `afterId` query parameters. No parameters means page one; any array, partial set, extra key, noncanonical timestamp, or noncanonical UUID is invalid. Item links are fixed-prefix paths built from typed UUIDs only.

**Alternatives considered**: Opaque signed cursor tokens; offset/page numbers; caller-supplied return or revalidation URLs.

**Rationale**: The cursor contains no secret and is always reauthorized. Separate canonical values are testable, bookmarkable, and cannot become an open redirect or arbitrary cache invalidation path.

## Data Flow

### Read

```text
/admin/dashboard
  -> requireAdminRoute('/admin/dashboard')
  -> resolveMiDiaScope(session.roles)
       -> null: existing metrics + existing Dashboard (no Mi día call)
       -> scope: metrics without legacy queue + data quality + Mi día promise
                    |
                    v
              auth client: user -> own active profile -> roles
                    |
              exact {cursor} validation / first-page reference time
                    |
                    v
              read client -> read_mi_dia_page(...)
                    |
              SQL auth + expected actor + task_actor_can_manage
                    |
              complete counts + due/id page + narrow labels/helper-gated links
                    |
                    v
              strict decoder -> Suspense section -> accessible list
```

### Action

```text
Task action form
  -> strict Mi día actor authorization
       -> unauthenticated: AUTH_REQUIRED + exact safe copy; stop
       -> missing/inactive profile: AUTH_INACTIVE + exact safe copy; stop
       -> Operations/Finance/Marketing/unknown-only: AUTH_ROLE_UNSUPPORTED + exact safe copy; stop
  -> exact five-key parser
  -> RLS Task context read
  -> verify taskKind and resolve current CRM route authority
  -> derive a fixed context path only when that authority succeeds
  -> map start/complete/cancel
  -> performTaskAction -> task_action -> immutable receipt
       -> failure: safe inline alert, same requestId, no revalidation
       -> success/replay/already_at_target:
            revalidatePath('/admin/dashboard')
            + revalidatePath(derived context path) when non-null
            -> authoritative page refresh (no optimistic mutation)
```

## `0089` DDL and RPC Contract

### Objects

```sql
create index tasks_mi_dia_active_due_id_idx
  on public.tasks (due_at asc, id asc)
  include (owner_id, task_kind, status, lead_id, quote_id)
  where task_kind in ('follow_up','first_contact','quote_follow_up')
    and status in ('pending','in_progress');

create or replace function public.read_mi_dia_page(
  p_reference_time_text text,
  p_expected_actor_id uuid,
  p_limit integer,
  p_after_due_at_text text,
  p_after_id_text text
) returns jsonb
language plpgsql stable security definer set search_path = '';
```

The exact and sole function identity is `public.read_mi_dia_page(text,uuid,integer,text,text)`. It is `STABLE SECURITY DEFINER`, owned by `postgres`, has no default argument or overload, and uses literal `SET search_path = ''`; every catalog, auth, extension, function, and table reference in its body is schema-qualified. Migration order is index, function, owner assignment, revoke-all from `PUBLIC`, `anon`, `authenticated`, and `service_role`, then the sole `EXECUTE` grant to `authenticated`. Because `0089` is transactional, the default creation privilege is revoked before commit. Rollback order is revoke, function, index. The migration performs no Task, receipt, origin, outcome, tombstone, event, profile, lead, or quote DML and creates no second disclosure helper, view, policy, or grant.

### Authorization and validation precedence

1. `auth.uid() IS NULL` or `auth.role() IS DISTINCT FROM 'authenticated'` -> `AUTH_REQUIRED`.
2. Missing or inactive actor profile -> `AUTH_INACTIVE`.
3. The active actor's role rows contain none of `admin|manager|asesor`, including Operations-only, Finance-only, Marketing-only, any unsupported recognized-role union, or unknown-only roles -> `AUTH_ROLE_UNSUPPORTED`.
4. Null or unequal `p_expected_actor_id` -> `AUTH_ACTOR_MISMATCH`.
5. Invalid reference time, null limit, unpaired cursor fields, invalid cursor timestamp/UUID, non-finite time, or failed canonical cast/format round-trip -> `INVALID_REQUEST`.
6. Invalid authorized-row label/context/time invariants -> `PERSISTENCE_FAILURE`.

Scope precedence is `admin -> all`, else `manager -> team`, else `asesor -> self`. Selection still calls `public.task_actor_can_manage(t.owner_id)` for every row; scope is descriptive and never substitutes for the helper.

Canonical timestamp is exactly `YYYY-MM-DDTHH:mm:ss.ffffffZ`; canonical UUID is lowercase RFC-4122 form with version/variant bits. Inputs are regex-checked, cast, finite-checked, and round-tripped with `pg_catalog.to_char(value AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`. `p_limit` must be an integer and is clamped to `1..50`; the application always sends `20`.

### Time math

```sql
reference_time := p_reference_time_text::timestamptz;
local_date := (reference_time at time zone 'America/Mexico_City')::date;
today_start := local_date::timestamp at time zone 'America/Mexico_City';
tomorrow_start := (local_date + 1)::timestamp at time zone 'America/Mexico_City';
```

For every row, `overdue` wins when `due_at < reference_time`; otherwise `today` wins when `due_at < tomorrow_start`; otherwise the bucket is `upcoming`. Equality with `reference_time` is not overdue. Equality with `tomorrow_start` is upcoming. The named zone is used for each local midnight; no fixed offset or browser timezone participates.

### Authorized CTE, labels, counts, and page

The materialized CTE includes only Tasks satisfying all three predicates below; the helper is evaluated for every candidate that can contribute either an item or a count:

```sql
t.task_kind in ('follow_up','first_contact','quote_follow_up')
and t.status in ('pending','in_progress')
and public.task_actor_can_manage(t.owner_id)
```

The page projection directly joins only `public.profiles` by `owner_id`; it does not join or project Contact, Lead, Opportunity, Quote, event, or receipt data. The only CRM access from the bounded function is the existing boolean route-authority helper call used to decide a nullable Asesor link. `ownerLabel` is `pg_catalog.btrim(profile.full_name)` and must be non-empty. Context display is only the closed kind label in the UI plus the persisted Task `description`; no CRM label is projected. Context invariants are:

- `follow_up|first_contact`: `quote_id` is null; `lead_id` may be a UUID or null after allowed purge.
- `quote_follow_up`: `lead_id` is null; `quote_id` may be a UUID or null after allowed purge.
- `due_at` is finite and microsecond-aligned; malformed authorized data fails the whole call rather than disappearing.

Counts aggregate the complete CTE before any keyset predicate and satisfy `total=overdue+today+upcoming`. The page predicate is exactly:

```sql
p_after_due_at is null
or t.due_at > p_after_due_at
or (t.due_at = p_after_due_at and t.id > p_after_id)
```

The page orders by `due_at ASC,id ASC`, fetches `effective_limit+1`, returns at most `effective_limit`, and sets `hasMore` only from the extra row. A non-null `nextCursor` uses the unchanged reference time and the last returned item's due time and Task ID.

### Manager-safe navigation

The RPC constructs only these nullable paths:

- Admin: `/admin/leads/{leadId}` for a present `follow_up|first_contact` context and `/admin/quotes/{quoteId}` for a present `quote_follow_up` context. Current Lead and Quote policy admit Admin, so a missing/purged context is the only null case for an otherwise coherent Admin item.
- Non-Admin actor whose recognized role union contains `asesor`: a self-owned `follow_up|first_contact` item links only when `public.crm_advisor_can_access_live_opportunity(t.lead_id)` is true. This is the helper used by the final `lead read scoped` policy and requires the exact Lead to remain assigned to `auth.uid()`, the Lead to be live, and its parent Contact to be live. A reassigned/stale Lead returns null even though the Task remains self-owned and actionable.
- Non-Admin actor whose recognized role union contains `asesor`: a self-owned `quote_follow_up` item links only when `public.crm_can_read_quote(t.quote_id)` is true. This is the predicate used by `quotes read scoped`; for Asesor it requires the exact Quote, associated Lead, and Contact to be live and the associated Lead to remain assigned to `auth.uid()`. An inaccessible/deleted Quote or stale Lead assignment returns null.
- Manager-only rows, another owner's Manager+Asesor team rows, missing/purged contexts, helper-false contexts, and unsupported combinations: null. A Manager+Asesor actor may link an own row only through the same Asesor helper check; Manager team visibility alone never authorizes a CRM route.

Both helpers already expose only a boolean to authenticated callers and already back current CRM policies. `0089` calls them under the current `auth.uid()`; it creates no replacement helper, policy, table privilege, reusable CRM projection, or broad grant. Path prefixes are constants and IDs are typed UUIDs. The adapter never converts null to a path. It accepts a non-null path only when authenticated-role precedence, `owner_id`, Task kind, matching context ID, and exact fixed-prefix path are coherent (Admin, or non-Admin Asesor self row); otherwise the whole payload is `PERSISTENCE_FAILURE`. The SQL helper result remains the dynamic current-route decision, while the adapter is an independent fail-closed shape/actor check rather than a second source of CRM data.

### RLS and grants

`0089` creates no table policy and grants no table/view/profile/CRM access. Existing Task SELECT RLS remains `USING (task_actor_can_manage(owner_id))`. The function privilege sequence is exactly:

```sql
alter function public.read_mi_dia_page(text,uuid,integer,text,text) owner to postgres;
revoke all on function public.read_mi_dia_page(text,uuid,integer,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.read_mi_dia_page(text,uuid,integer,text,text)
  to authenticated;
```

Runtime parity proof exhausts complete unchanged keyset pagination and compares the union of RPC Task IDs with direct RLS-visible Task IDs under identical active-kind/status predicates only for supported Admin, Manager, Asesor-owner/non-owner, Manager+Asesor, supported-plus-other-role, and Admin-owned cases. Equality is not inferred from one bounded page. Unsupported-role proof is separate and non-vacuous: each Operations-only, Finance-only, Marketing-only, other recognized unsupported-only, and unknown-only fixture owns an active admitted Task that direct Task RLS can see because `task_actor_can_manage` admits an active owner, yet the RPC must return `AUTH_ROLE_UNSUPPORTED` before the authorized Task CTE, lookup, or projection executes. Inactive and unauthenticated failures remain separate auth-precedence cases and carry no parity claim. The proof also verifies function metadata/ACLs, absence of overloads/defaults, exact helper-gated Lead/Quote links and null stale/inaccessible contexts, and that Manager still cannot directly read another owner's profile or inaccessible CRM rows.

## Result Contract

### TypeScript request/result

```ts
export type MiDiaScope = "self" | "team" | "all"
export type MiDiaBucket = "overdue" | "today" | "upcoming"
export type MiDiaKind = "follow_up" | "first_contact" | "quote_follow_up"
export type MiDiaStatus = "pending" | "in_progress"
export type MiDiaCursor = {
  referenceTime: string
  afterDueAt: string
  afterId: string
}
export type MiDiaPageRequest = { cursor: MiDiaCursor | null }
export type MiDiaCounts = {
  overdue: number
  today: number
  upcoming: number
  total: number
}
export type MiDiaItem = {
  taskId: string
  ownerId: string
  ownerLabel: string
  kind: MiDiaKind
  status: MiDiaStatus
  description: string
  dueAt: string
  bucket: MiDiaBucket
  leadId: string | null
  quoteId: string | null
  navigationHref: string | null
}
export type MiDiaSuccess = {
  ok: true
  referenceTime: string
  todayStart: string
  tomorrowStart: string
  scope: MiDiaScope
  counts: MiDiaCounts
  items: MiDiaItem[]
  pageInfo: { hasMore: boolean; nextCursor: MiDiaCursor | null }
}
export type MiDiaFailureCode =
  | "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_ROLE_UNSUPPORTED"
  | "AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST" | "PERSISTENCE_FAILURE"
export type MiDiaFailure = {
  ok: false
  error: { code: MiDiaFailureCode; message: MiDiaFailureCode }
}
export type MiDiaResult = MiDiaSuccess | MiDiaFailure
```

`readMiDiaPage(input: unknown, deps?: MiDiaDeps): Promise<MiDiaResult>` performs: auth client -> scope -> exact `{cursor}` validation -> first-page time/cursor carry -> read client -> exact RPC args -> strict result decode. A first-page `Date.toISOString()` value is converted from milliseconds to six fractional digits by appending `000`; later pages copy the issued value byte-for-byte.

The decoder additionally requires:

- exactly 8 success keys, 4 count keys, 2 page-info keys, 3 cursor keys, and 11 item keys; no accessors, proxies, symbols, sparse arrays, or extra keys;
- returned `referenceTime` equals the sent value and returned `scope` equals locally resolved scope;
- `todayStart`/`tomorrowStart` equal independently computed IANA-zone boundaries;
- 0–20 unique items in strict `dueAt,taskId` order and strictly after an input cursor;
- each bucket equals the canonical comparison; `navigationHref=null` is always accepted and never upgraded, while a non-null path must satisfy exact local role/owner/kind/context/fixed-prefix coherence; and complete counts are nonnegative safe integers whose sum equals total and are not lower than page bucket occurrences;
- `hasMore=true` implies 20 items and a cursor matching the last item; `hasMore=false` implies a null cursor.

Any provider error, thrown exception, malformed envelope, duplicate, ordering error, impossible equation, or navigation mismatch becomes only `PERSISTENCE_FAILURE`. No partial items, provider text, cache, second source, or `lead_events` fallback is returned.

### Manual database type

`lib/supabase/database.types.ts` adds only:

```ts
read_mi_dia_page: {
  Args: {
    p_reference_time_text: string
    p_expected_actor_id: string
    p_limit: number
    p_after_due_at_text: string | null
    p_after_id_text: string | null
  }
  Returns: Json
}
```

No linked type generation runs in this change.

### Action request/state

The exported Mi día actor authorizer returns an exact supported result containing the canonical actor ID, active profile, raw role names, recognized role union, and resolved `self|team|all` scope, or a closed failure. The action wrapper calls it before inspecting Task context or invoking mutation dependencies. Authorization precedence and observable action state are exact:

| Actor state | Wrapper code | Safe copy | Forbidden downstream calls |
|---|---|---|---|
| No authenticated user | `AUTH_REQUIRED` | `Tu sesión ya no permite actualizar esta tarea.` | Task lookup, CRM route authority, `performTaskAction`, receipt mutation, revalidation |
| Missing or inactive profile | `AUTH_INACTIVE` | `Tu sesión ya no permite actualizar esta tarea.` | Task lookup, CRM route authority, `performTaskAction`, receipt mutation, revalidation |
| Active Operations-only | `AUTH_ROLE_UNSUPPORTED` | `Tu sesión ya no permite actualizar esta tarea.` | Task lookup, CRM route authority, `performTaskAction`, receipt mutation, revalidation |
| Active Finance-only | `AUTH_ROLE_UNSUPPORTED` | `Tu sesión ya no permite actualizar esta tarea.` | Task lookup, CRM route authority, `performTaskAction`, receipt mutation, revalidation |
| Active Marketing-only | `AUTH_ROLE_UNSUPPORTED` | `Tu sesión ya no permite actualizar esta tarea.` | Task lookup, CRM route authority, `performTaskAction`, receipt mutation, revalidation |
| Active unknown-only, or any recognized unsupported-only union | `AUTH_ROLE_UNSUPPORTED` | `Tu sesión ya no permite actualizar esta tarea.` | Task lookup, CRM route authority, `performTaskAction`, receipt mutation, revalidation |

The tests use separate spies for actor authorization, Task-context lookup, CRM route-authority resolution, canonical action invocation, and revalidation. Each preliminary-denial row above supplies the exact ID of a self-owned active admitted Task through a lookup spy that would return it if called, then proves zero calls to that lookup and every later dependency. This makes unsupported-role denial non-vacuous while preserving the required authorization-before-lookup/action order. The canonical runtime suites remain responsible for proving that no receipt can exist without `task_action`. `AUTH_ROLE_UNSUPPORTED` belongs only to `MiDiaActionState` and is never added to `TaskActionDomainCode`, `TaskActionErrorCode`, `performTaskAction`, or the SQL `task_action` result.

The parsed server-action request is exactly:

```ts
type MiDiaActionRequest = {
  requestId: string
  taskId: string
  intent: "start" | "complete" | "cancel"
  taskKind: MiDiaKind
  cancelReason: "no_longer_needed" | "duplicate" | "source_invalidated" | "other" | null
}
```

After actor authorization succeeds, FormData must contain exactly one string value for each of those five keys. Start and complete require an empty raw cancellation value normalized to null; cancel requires one closed reason. Duplicate keys, `File` values, missing/extra keys, noncanonical IDs, unknown values, kind mismatch, or invalid reason combinations return code `INVALID_REQUEST` and copy `La solicitud no es válida.` before Task lookup or `performTaskAction`.

After the RLS-scoped Task lookup confirms the actual kind/context, the server-only context resolver applies the same link rules as the read RPC. Admin receives the fixed path for a present coherent context. A non-Admin Asesor self row calls `crm_advisor_can_access_live_opportunity` for a Lead context or `crm_can_read_quote` for a Quote context and returns a path only for `true`; Manager-only/team rows, stale Lead assignment, inaccessible Quote, helper error/false, and null context return `navigationHref=null`. This existing-helper use adds no policy or grant and a null result never blocks the Task action; it only suppresses contextual revalidation/navigation.

Mapping is exact:

| Intent | Canonical `performTaskAction` input |
|---|---|
| `start` | `targetStatus:'in_progress'`, reason/outcome/note null |
| `complete` + `first_contact` | `targetStatus:'completed'`, `completionOutcome:'first_contact_completed'`, reason/note null |
| `complete` + other admitted kind | `targetStatus:'completed'`, `completionOutcome:'work_completed'`, reason/note null |
| `cancel` | `targetStatus:'canceled'`, selected reason, outcome/note null |

Applied/replayed success uses `Tarea iniciada.`, `Tarea completada.`, or `Tarea cancelada.`; `already_at_target` uses `La tarea ya estaba actualizada.`. Failure copy is exact: `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_ROLE_UNSUPPORTED|AUTH_ACTOR_MISMATCH|TASK_FORBIDDEN` -> `Tu sesión ya no permite actualizar esta tarea.`; `INVALID_REQUEST` -> `La solicitud no es válida.`; `TASK_ACTION_IDEMPOTENCY_CONFLICT` -> `La solicitud ya se usó para otra acción.`; `TASK_INVALID_TRANSITION` -> `La tarea cambió y esta acción ya no está disponible.`; and `PERSISTENCE_FAILURE` -> `No pudimos actualizar la tarea. Intenta de nuevo.`. Receipt IDs/bodies and provider messages never enter action state.

Each rendered Task/action/reason combination receives a server-generated UUID before first submission. Failure state returns and reuses that UUID. Changing Task, intent, or cancellation reason replaces it; canonical success relies on revalidation/remount to allocate a new one. Status is never changed optimistically.

## Dashboard, Components, and Accessibility

### Composition and rendering

- `resolveMiDiaScope` is a pure shared helper used by the adapter, composition, and navigation.
- `getDashboardMetrics({includeLegacyFollowUps:false})` substitutes `Promise.resolve([])` for `fetchFollowUpTaskQueue`; every other query, DTO, error, and ordering remains unchanged.
- Legacy mode calls `getDashboardMetrics()` with its default `true` and renders the current page byte-for-behavior: four metric cards, legacy follow-up section, payments, funnel, bookings, recent activity, incidents, data quality, alerts, and existing Manager fallback.
- Mi día mode renders its section before non-Task cards, omits the old `Seguimientos vencidos` metric and `Seguimientos por atender` section, and retains payments, bookings, leads-today, funnel, activity, incidents, and data quality. Mi día counts replace the old queue/count presentation only inside Mi día.
- A closed Mi día failure renders inline while preserved data stays visible. Existing metric/data-quality failure remains the only trigger for the pre-existing Manager-only account redirect.

### UI states

`components/admin/tasks/mi-dia-task-list.tsx` renders one `<section aria-labelledby="mi-dia-heading">` with heading `Mi día`, scope text, a four-item count `<dl>`, and contiguous bucket sections. It partitions without sorting, so the original due/ID order is retained. Each non-empty bucket uses a labeled semantic list; empty buckets are omitted.

- Loading: `aria-busy=true`, text `Cargando Mi día`, skeleton only, no stale item/count/action.
- Empty: exact scope-aware copy and no action/pagination control.
- Read error: alert with exact safe copy and a focused native retry link to `/admin/dashboard`.
- Success: exact kind/status/bucket/count labels, textual overdue state, and `Siguiente` only for a non-null issued cursor.
- Due time: `<time dateTime={canonicalUtc}>` with visible `Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',dateStyle:'medium',timeStyle:'short'})` text followed by `hora de Ciudad de México`.
- Action pending: form `aria-busy`, current status retained, all controls disabled, pending text visible.
- Action success: `role=status`, `aria-live=polite`.
- Action failure: focusable `role=alert`, `aria-live=assertive`; an effect moves focus after each failed response.
- Kind, status, overdue, disabled, success, and failure meaning is textual and never color-only. Native buttons/selects and links retain visible focus styles and DOM order.

`app/admin/(protected)/dashboard/loading.tsx` is S3-owned and remains a safe route-wide Dashboard skeleton; the actual role-aware Mi día loading state is the local Suspense fallback. `app/admin/(protected)/dashboard/error.tsx` is created only in S5 together with navigation/routing evidence. It is a client boundary with safe Spanish copy, no `error.message`, an alert container focused on mount, and a `Reintentar` button calling `reset()`. S1–S4 neither create nor claim the route-level error boundary or role-aware navigation.

### Navigation (S5-owned)

`getVisibleAdminNavItems` clones the Home item with label `Mi día` when the recognized union includes Admin, Manager, or Asesor; otherwise it remains `Resumen`. Its href and group remain `/admin/dashboard` and `Resumen`. Existing Manager-only filtering and every other role-visible item are unchanged. `AdminShellClient` derives the dashboard route title from the active Home label rather than hard-coding `Resumen general`.

## Cache Revalidation

The server action calls no cache API until `performTaskAction` returns canonical success (`applied`, exact replay, or `already_at_target`). It then always calls:

```ts
revalidatePath("/admin/dashboard")
```

It additionally calls `revalidatePath(context.navigationHref)` only when the preceding RLS Task lookup plus current CRM helper decision derived a non-null fixed-prefix path for the current actor. No path is read from FormData or action state, and Task ownership alone cannot derive one. Failure, malformed input, kind mismatch, denied context lookup, helper false/error, thrown provider error, or invalid transition performs zero contextual revalidation. No cache tag, broad layout invalidation, router mutation, or optimistic cache write is introduced.

## File Changes

| File | Action | Description |
|---|---|---|
| `db/migrations/0089_mi_dia_read_contract.sql` | Create | Partial index, exact read RPC, auth, projection, counts, grants, rollback comment. |
| `lib/supabase/database.types.ts` | Modify | Manual exact RPC Args/Json return only. |
| `lib/admin/mi-dia-scope.ts` | Create | Pure recognized-role scope and item-link eligibility decision; shell navigation remains S5-owned. |
| `lib/admin/mi-dia.ts` | Create | Shared strict actor authorization, auth-first two-client read adapter, cursor/time helpers, strict decoder, post-authorization RLS action-context lookup, and existing-helper CRM route-authority resolution. |
| `lib/admin/dashboard.ts` | Modify | Optional legacy-queue acquisition; default preserves existing behavior. |
| `lib/admin/page-compositions.ts` | Modify | Auth-first legacy/Mi día branch, Mi día promise, isolated Manager fallback. |
| `app/admin/(protected)/dashboard/page.tsx` | Modify | Consume discriminated composition; Mi día first; retain legacy and non-Task sections. |
| `app/admin/(protected)/dashboard/loading.tsx` | Create | Safe route-level Dashboard loading shell. |
| `app/admin/(protected)/dashboard/error.tsx` | Create in S5 | Safe focused route error and reset; no earlier slice owns or claims it. |
| `app/admin/(protected)/dashboard/action-state.ts` | Create | Closed idle/success/failure state without receipt/provider data. |
| `app/admin/(protected)/dashboard/actions.ts` | Create | Wrapper-first actor denial, exact form parser, context verification, canonical mapping, safe copy, and success-only revalidation. |
| `components/admin/tasks/mi-dia-task-list.tsx` | Create | Read states, counts, lists, Mexico City times, cursor link. |
| `components/admin/tasks/mi-dia-task-actions.tsx` | Create | Retry-stable IDs, forms, busy controls, live/focus feedback. |
| `components/admin/admin-nav.ts` | Modify in S5 | Role-aware Home label with stable route/visibility. |
| `components/admin/admin-shell-client.tsx` | Modify in S5 | Dashboard route context follows visible Home label. |
| `tests/mi-dia-read-contract.test.ts` | Create | Static DDL/type/index/grant/no-broadening/preservation contract. |
| `tests/mi-dia-read-runtime.test.ts` | Create | Disposable PostgreSQL auth/RLS/label/count/time/keyset/grant/runtime proof. |
| `tests/mi-dia-adapter.test.ts` | Create | Auth sequencing, exact cursor/args, strict adversarial decoder, navigation. |
| `tests/mi-dia-page.test.tsx` | Create | Composition and rendered loading/empty/error/success/accessibility contracts. |
| `tests/mi-dia-actions.test.ts` | Create | Exact unsupported-role denials/order/copy, parser, kind mapping, outcomes, request identity, and revalidation. |
| `tests/follow-up-task-dashboard-cutover.test.ts` | Modify | Retire legacy queue for supported mode; prove legacy mode unchanged. |
| `tests/admin-navigation.test.ts` | Modify in S5 | Role/multirole `Mi día` versus `Resumen` matrix. |
| `tests/admin-route-boundaries.test.ts` | Modify in S3/S5 | S3 proves auth-before-read, unsupported no-read, and Manager fallback isolation; S5 alone adds route-error ownership/safety proof. |
| `app/e2e-manager-capability/page.tsx` | Modify in S5 | Local gated role/UI fixtures for Mi día and preserved roles. |
| `app/e2e-manager-capability/actions.ts` | Create in S5 | Gated fake server action for pending/success/failure accessibility evidence only. |
| `app/e2e-manager-capability/route-error-fixture.tsx` | Create in final S5 correction | Gated client fixture for real route-error focus, safe-copy, provider-opacity, and reset-callback evidence only. |
| `e2e/manager-capability.spec.ts` | Modify in S5 | Keyboard, focus, live regions, routing, labels, route error, and preserved-role browser evidence. |
| `openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256` | Create | Direct protected migration-byte manifest. |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | Create/Update | Per-slice RED/GREEN/runtime/line/rollback evidence. |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | Later update | SDD task checkboxes; each implementation slice updates atomically. |
| `docs/implementation/ACTIVE.md` | Modify per slice | Current local slice and evidence only; no closure/rollout claim. |
| `docs/DECISIONS.md`, `docs/PROGRESS.md` | Modify in S5 | Durable definer rationale and verified local state only. |

`lib/admin/task-actions.ts`, `0061`–`0088`, canonical automation/action/cutover code, CRM readers, and notification code are not modified.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Static contract | Exact `0089` signature, security mode, fixed search path, index, grants, no table policy/grant/DML, manual type, protected hashes | Node source/manifest assertions in `mi-dia-read-contract`. |
| Disposable PostgreSQL 16 | Auth precedence; supported-role-only helper/RLS parity; non-vacuous unsupported self-owned Task denial before lookup/projection; Admin-owned exclusion for Manager; narrow labels; exact Lead/Quote helper-gated links and null stale/inaccessible contexts; direct profile denial; active filters, counts, boundaries, keysets, limit clamp, grants | Existing `tests/helpers/postgres-runtime.ts`, serial opt-in container, migrations through `0089`, final cleanup assertion. |
| Adapter unit | Separate-client ordering, no read before auth/input, fixed time, URL cursor, exact args/result, adversarial objects/arrays, null-preserving navigation, and exact non-null role/owner/kind/context/path checks | Inject auth/read providers and fixed clock; no network/database. |
| Composition/component | Supported/unsupported branches, no legacy read, preserved legacy mode, isolated failures, all visual/semantic states | Node tests plus server static markup/source assertions. |
| Action unit/integration | Wrapper-first denials for unauthenticated, inactive, Operations-only, Finance-only, Marketing-only, and unknown-only actors; unsupported self-owned admitted Task fixtures; five-key parser; actual-kind tie; current Lead/Quote helper resolution; mappings; exact code/copy; stable IDs; no optimistic state; exact revalidation | Inject actor authorizer, RLS context reader that would return the self-owned Task, CRM helper resolver, `performTaskAction`, and `revalidatePath`; prove every preliminary denial makes zero lookup/action/downstream calls; prove stale/inaccessible contexts remain actionable with null contextual revalidation; retain canonical action suites and their unchanged failure union. |
| Browser | Keyboard order, pending disablement, focus after errors, polite/alert regions, time/list semantics, and S5-owned Home labels/route error/unsupported preservation | Existing gated `/e2e-manager-capability` fixture and Playwright Chromium in S5. |
| Regression | Task RLS/action/automation, follow-up cutover, CRM Task reads/history, navigation/routes, lint/type/build | Existing local suites with zero skips for enabled runtime families. |

## Threat Matrix

| Boundary | Status | Expected safe/failure behavior | Planned RED test |
|---|---|---|---|
| Application routing | Applicable — S5 ownership | Only `/admin/dashboard` is used; cursor keys are closed; item/revalidation paths use fixed admin prefixes plus canonical UUIDs; unsupported roles branch before Mi día; Asesor Lead/Quote links require the existing current CRM helper independently of Task ownership. Stale/inaccessible/helper-false contexts remain actionable but non-linking. Invalid/forged values fail without read, redirect, open navigation, or cache invalidation. Navigation labeling and `dashboard/error.tsx` are created and claimed only in S5. | Extra/partial/array cursor; forged context/path form keys; Manager team link; Asesor self-owned Task with stale Lead assignment; Asesor self-owned Task with inaccessible Quote; helper false/error null link; unsupported self-owned Task no-lookup/no-action; fixed-prefix assertions; safe route-error reset and `Mi día`/`Resumen` role matrix in S5 adapter/action/route/E2E tests. |
| Shell command construction | Applicable — per-slice accounting and disposable PostgreSQL | Snapshot/accounting commands consume a sealed NUL-delimited owned-path manifest, use argument arrays or quoted arguments with `--`, reject absolute/out-of-root/symlink/non-regular paths, never `eval`, and never interpolate application input. PostgreSQL tests retain `execFile`/`execFileSync`, fixed `postgres:16-alpine`, generated safe container names, and SQL over stdin/`-c`. Any malformed path, binary numstat, command error, or unexpected exit fails the slice closed. | Temporary-repository RED fixture includes tracked, staged, unstaged, untracked, absent-created, deleted, and space-containing owned paths plus rejected `../` and symlink entries; source assertion rejects `exec`, `shell:true`, and interpolation of cursor/database/image/path data into shell strings. |
| Subprocess lifecycle/process integration | Applicable — per-slice accounting and opt-in PostgreSQL | Snapshot directories are uniquely created beneath `/tmp/opencode`, sealed before work, retained through independent verification, then removed in `finally` with absence proof. Database skip occurs before spawn; readiness/commands are bounded; tests run with `--test-concurrency=1`; `finally` removes the unique container and proves absence after success or failure. | Injected snapshot, diff, verifier, spawn, readiness, and scenario failures still run the appropriate cleanup; final checks prove no baseline directory or PostgreSQL container remains. |
| VCS/PR automation | Applicable only to read-only local accounting | The protocol may use `git rev-parse`, `git status --porcelain=v2 -z`, `git ls-files --stage -z`, and `git diff --no-index --no-renames --numstat -z`. It must not use HEAD as the baseline and must not mutate the index/worktree, create/switch branches, commit, push, fetch, open a PR, inspect a remote, or transfer files. Existing mixed-worktree bytes are baseline, not slice changes. | In a temporary mixed-state repository, independently prove exact per-file counts across tracked/staged/unstaged/untracked/absent/deleted paths and unchanged index OIDs/status after accounting; reject any invocation outside the read-only allowlist. |
| Executable-file classification | N/A | No file is classified or selected for execution by extension/content. | None required. |
| Remote process/file transfer | N/A | Remote inspection, linked type generation, deployment, rollout, and transfer are excluded. | Source/command review contains no remote or linked operation. |

The shell, subprocess, and read-only VCS rows are mandatory accounting requirements for every slice. The PostgreSQL portions are additionally owned by S1/S4/S5 where those suites run. The application-routing row is owned by S5; S1, S2, and S4 may prove the nullable data/action link-authority preconditions they implement, but S1–S4 must not claim rendered routing, shell-navigation, or route-error delivery. These applicable rows must propagate unchanged into tasks and RED evidence.

## Preservation and Rollback

S1 records direct SHA-256 values for exactly `db/migrations/0061_*.sql` through `0088_*.sql` in `openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256`; every slice runs `sha256sum -c` before and after its behavior. The manifest test also rejects a missing/extra protected migration number. Existing action, automation, historical, cutover, CRM pending-work, and append-only-history suites prove behavior preservation. Regression execution does not reopen or modify those capabilities.

Rollback is reverse order and caller-first:

1. Remove/disable Mi día action forms, role-aware navigation, Dashboard composition, local loading/error UI, and E2E fixtures; restore the legacy Dashboard caller path.
2. Remove the adapter/scope/manual function type only after no caller remains.
3. If `0089` is still unapplied local work, remove only `0089` and its index/function. If a future separately authorized environment applied it, use a new forward migration to revoke authenticated execution, drop `read_mi_dia_page`, then drop `tasks_mi_dia_active_due_id_idx` after callers are gone.
4. Never edit `0061`–`0088`, restore `task_transition`, delete/modify Tasks or action receipts, alter automation origins/outcomes/tombstones, rewrite `lead_events`, broaden policy, or infer final Week 03 closure.

No data migration, feature flag, remote operation, rollout, notification, automation-policy change, or closure step is part of this design.

## Five Behavior-Complete Slices

All five slices auto-chain in dependency order as local delivery units. Each hard-stops at 400 changed text lines (`additions + deletions`) including behavior, tests, types, `apply-progress.md`, `tasks.md`, and the atomic `ACTIVE.md` update. The per-file allocations below are planning ceilings; S3 and S4 deliberately have no unallocated reserve, so any growth requires a complete-behavior split rather than compression. No allocation permits compressed assertions, unrelated statements combined onto long lines, omitted states, or deferred proof. If an exact measured slice would exceed a per-file ceiling or 400 total, work stops and the slice is split by complete behavior with proposal/design/tasks corrected before implementation continues.

### Mixed-worktree-safe per-slice baseline protocol

`git diff --numstat` against HEAD is forbidden for slice accounting because this repository already contains staged, unstaged, and untracked work. Every slice instead uses this exact filesystem-baseline protocol:

1. **Freeze ownership before editing.** Resolve and record the repository root with `git rev-parse --show-toplevel`. Materialize the slice's complete file list from its budget table as a sorted, duplicate-free, NUL-delimited manifest. Reject an empty entry, absolute path, `..`, path outside the root, symlink, directory, device, or any path not listed for that slice. No owned file may be added after baseline creation without discarding the baseline and restarting the slice.
2. **Create and seal the pre-slice snapshot.** Create a unique directory beneath `/tmp/opencode/actravel-mi-dia-<slice>-XXXXXX`, never inside the worktree. For every owned path, copy the current working-tree bytes to `before/<path>` when it is a regular file; otherwise record an explicit `absent` marker. `before-manifest.json` records, per path, `state=regular|absent`, byte length, SHA-256 or null, and the NUL-safe local Git classification from `git status --porcelain=v2 -z` plus stage entries from `git ls-files --stage -z`. Hash the manifest itself. Existing mixed-worktree content—whether tracked, staged, unstaged, or untracked—is therefore part of the baseline rather than charged to the slice.
3. **Implement only owned paths.** The author may modify only the frozen list. Protected migration hashes run before behavior and again before final accounting. A preliminary report may be written to `apply-progress.md`; because that file is owned and budgeted, the final snapshot is taken only after its per-file report, task checkbox, and `ACTIVE.md` update have reached their final bytes.
4. **Create the post-slice snapshot.** Revalidate the path manifest and copy/hash the final regular files into `after/<path>`, again writing explicit absent markers to `after-manifest.json`. Re-hash every `before/` copy and require equality with the sealed pre-slice manifest before counting. Fail closed if an owned path changed type, is a symlink/non-regular file, or if an unowned path is claimed by the slice.
5. **Count exact text changes.** Run `git diff --no-index --no-renames --numstat -z -- "$baseline/before" "$baseline/after"`; exit `0` and diff exit `1` are the only accepted statuses. Reject binary `-` counts, rename inference, parse ambiguity, a path outside the manifest, or a manifest path omitted from reconciliation. Normalize the two snapshot prefixes back to the owned relative path, record additions and deletions separately for every path—including zeroes and `absent -> regular` or `regular -> absent`—and hard-stop when their sum exceeds 400. Directory comparison makes tracked, staged, unstaged, untracked, newly created, and deleted files use the same byte snapshot and line-accounting rule.
6. **Verify independently before completion.** A second process/operator, not the slice author, starts from the sealed pre-slice manifest and copies, re-hashes, and current final files; reruns `git diff --no-index --no-renames --numstat -z`; recomputes per-file and total counts; checks the frozen path set against the slice budget table; confirms the reported `apply-progress.md` numbers and `<=400`; reruns both protected-hash checks; and proves that the accounting invocation itself left worktree bytes, `git status --porcelain=v2 -z`, and index stage OIDs unchanged between immediately-before and immediately-after captures. Any mismatch fails the slice and forbids chaining.
7. **Clean up without changing owned files.** After independent verification, remove only the unique `/tmp/opencode` baseline in a `finally` path and prove it is absent. No owned repository file may change after verification; if one does, the slice must be re-snapshotted and independently reverified. The execution receipt retains the baseline-manifest hash, before/after manifest hashes, per-file counts, exact total, verifier result, and cleanup result; the temporary copies themselves are never committed.

The independent fixture for this protocol must first fail under the old HEAD-relative command and pass under the snapshot method for pre-existing staged, unstaged, and untracked files, an absent-created file, and a deleted file. This accounting proof is process evidence only; it performs no application implementation or remote operation.

### S1 — Authorized `0089` page boundary (budget 399 lines)

**Paths**: `db/migrations/0089_mi_dia_read_contract.sql`, `lib/supabase/database.types.ts`, `tests/mi-dia-read-contract.test.ts`, `tests/mi-dia-read-runtime.test.ts`, `openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256`, `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`, `openspec/changes/week-03-role-aware-mi-dia/tasks.md`, `docs/implementation/ACTIVE.md`.

**Behavior/RED**: exact sole `STABLE SECURITY DEFINER` RPC identity, owner, empty search path, no defaults/overloads, revoke-all/sole grant order, fully qualified body, index/auth/scope/per-row helper checks, complete-pagination RLS Task-ID equality only for supported Admin/Manager/Asesor role cases, non-vacuous `AUTH_ROLE_UNSUPPORTED` before Task lookup/projection for every unsupported actor owning a direct-RLS-visible active admitted Task, labels, exact existing-helper Lead/Quote link authority with stale/inaccessible nulls, context, full counts, Mexico City boundaries, due/ID keyset, limit+1, direct profile denial, no DML/policy broadening, shell/process/read-only-VCS threat rows, and protected hashes.

| Owned file | Maximum additions + deletions |
|---|---:|
| `db/migrations/0089_mi_dia_read_contract.sql` | 180 |
| `lib/supabase/database.types.ts` | 10 |
| `tests/mi-dia-read-contract.test.ts` | 45 |
| `tests/mi-dia-read-runtime.test.ts` | 100 |
| `openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256` | 28 |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | 18 |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | 8 |
| `docs/implementation/ACTIVE.md` | 10 |
| **S1 hard maximum** | **399** |

**Commands**:

```bash
node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-contract.test.ts
RUN_MI_DIA_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-contract.test.ts tests/mi-dia-read-runtime.test.ts
npx tsc --noEmit
sha256sum -c openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256
```

**Runtime**: opt-in disposable PostgreSQL 16; fixed image, unique safe container, base through `0056`, migrations `0057`–`0089`, serial execution, bounded readiness, mandatory final absence. **Rollback**: revoke/drop unused local RPC/index and manual type; no operational row changes exist.

### S2 — Auth-first strict adapter and cursor contract (budget 390 lines)

**Paths**: `lib/admin/mi-dia-scope.ts`, `lib/admin/mi-dia.ts`, `tests/mi-dia-adapter.test.ts`, `tests/mi-dia-read-contract.test.ts`, `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`, `openspec/changes/week-03-role-aware-mi-dia/tasks.md`, `docs/implementation/ACTIVE.md`.

**Behavior/RED**: exact auth outcomes/order, recognized multirole scope, separate clients, first-page microsecond time, strict URL cursor, exact RPC args, named-zone boundary verification, hostile payload rejection, item/count/order/cursor equations, null-preserving navigation, exact non-null role/owner/kind/context/fixed-prefix checks, stale/inaccessible Asesor contexts remaining null, and provider redaction. The adapter never infers a link from Task ownership or replaces the RPC's current CRM helper decision.

| Owned file | Maximum additions + deletions |
|---|---:|
| `lib/admin/mi-dia-scope.ts` | 28 |
| `lib/admin/mi-dia.ts` | 190 |
| `tests/mi-dia-adapter.test.ts` | 130 |
| `tests/mi-dia-read-contract.test.ts` | 8 |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | 17 |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | 7 |
| `docs/implementation/ACTIVE.md` | 10 |
| **S2 hard maximum** | **390** |

**Commands**:

```bash
node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-adapter.test.ts tests/mi-dia-read-contract.test.ts
npx tsc --noEmit
sha256sum -c openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256
```

**Runtime**: N/A; injected auth/read clients and fixed clock only. S1 retains SQL integration proof. **Rollback**: remove adapter/scope and their tests while leaving the unused local RPC disabled or present.

### S3 — Read-only Dashboard queue and complete read states (budget 400 lines)

**Paths**: `lib/admin/dashboard.ts`, `lib/admin/page-compositions.ts`, `app/admin/(protected)/dashboard/page.tsx`, `app/admin/(protected)/dashboard/loading.tsx`, `components/admin/tasks/mi-dia-task-list.tsx`, `tests/mi-dia-page.test.tsx`, `tests/follow-up-task-dashboard-cutover.test.ts`, `tests/admin-route-boundaries.test.ts`, `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`, `openspec/changes/week-03-role-aware-mi-dia/tasks.md`, `docs/implementation/ACTIVE.md`.

**Behavior/RED**: supported composition stops legacy queue reads, unsupported composition performs zero Mi día work and remains unchanged, Manager existing fallback stays separate, and Mi día loading/empty/local read-error/success/count/bucket/time/list/pagination states render before non-Task content. S3 route tests cover auth-before-read and branch/fallback composition only; navigation labeling and the route-level `error.tsx` boundary remain exclusively S5-owned.

| Owned file | Maximum additions + deletions |
|---|---:|
| `lib/admin/dashboard.ts` | 35 |
| `lib/admin/page-compositions.ts` | 40 |
| `app/admin/(protected)/dashboard/page.tsx` | 60 |
| `app/admin/(protected)/dashboard/loading.tsx` | 18 |
| `components/admin/tasks/mi-dia-task-list.tsx` | 110 |
| `tests/mi-dia-page.test.tsx` | 65 |
| `tests/follow-up-task-dashboard-cutover.test.ts` | 18 |
| `tests/admin-route-boundaries.test.ts` | 12 |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | 20 |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | 10 |
| `docs/implementation/ACTIVE.md` | 12 |
| **S3 hard maximum** | **400** |

**Commands**:

```bash
node --import tsx --test --test-concurrency=1 tests/mi-dia-page.test.tsx
FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 node --conditions react-server --import tsx --test --test-concurrency=1 tests/follow-up-task-dashboard-cutover.test.ts tests/admin-route-boundaries.test.ts
npx tsc --noEmit
sha256sum -c openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256
```

**Runtime**: server/static component and injected composition only; no database or external boundary. **Rollback**: remove read UI and restore the default legacy composition call; S1/S2 can remain unused.

### S4 — Audited actions, retry identity, and authorized revalidation (budget 400 lines)

**Paths**: `app/admin/(protected)/dashboard/action-state.ts`, `app/admin/(protected)/dashboard/actions.ts`, `components/admin/tasks/mi-dia-task-actions.tsx`, `components/admin/tasks/mi-dia-task-list.tsx`, `lib/admin/mi-dia.ts`, `tests/mi-dia-actions.test.ts`, `tests/mi-dia-page.test.tsx`, `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`, `openspec/changes/week-03-role-aware-mi-dia/tasks.md`, `docs/implementation/ACTIVE.md`.

**Behavior/RED**: wrapper authorization precedes parsing-dependent Task lookup and all mutation/revalidation dependencies; unauthenticated, inactive, Operations-only, Finance-only, Marketing-only, and unknown-only actors return their exact wrapper code and exact shared safe copy with zero Task lookup, CRM helper resolution, `performTaskAction`, receipt mutation, or revalidation. Every unsupported-role case submits the exact ID of a self-owned active admitted Task that the injected lookup would return, proving the denial is non-vacuous and still precedes lookup/action. Supported actors then receive exact five-key parsing, actual Task-kind tie, existing-helper current Lead/Quote authority, null stale/inaccessible context handling, start/kind-aware completion/cancel mapping, complete canonical safe-copy mapping, replay/already-target success, request-ID retention/replacement, pending/no-optimistic state, focus/live feedback, Dashboard plus authorized-context revalidation, and zero failure revalidation. `AUTH_ROLE_UNSUPPORTED` remains absent from the canonical action union.

| Owned file | Maximum additions + deletions |
|---|---:|
| `app/admin/(protected)/dashboard/action-state.ts` | 28 |
| `app/admin/(protected)/dashboard/actions.ts` | 100 |
| `components/admin/tasks/mi-dia-task-actions.tsx` | 85 |
| `components/admin/tasks/mi-dia-task-list.tsx` | 20 |
| `lib/admin/mi-dia.ts` | 20 |
| `tests/mi-dia-actions.test.ts` | 85 |
| `tests/mi-dia-page.test.tsx` | 20 |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | 20 |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | 10 |
| `docs/implementation/ACTIVE.md` | 12 |
| **S4 hard maximum** | **400** |

**Commands**:

```bash
node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-actions.test.ts tests/task-actions-adapter.test.ts
RUN_TASK_AUTOMATION_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-action-lifecycle.test.ts tests/task-action-races.test.ts tests/task-action-receipt-integrity.test.ts tests/task-action-receipt-visibility.test.ts
npx tsc --noEmit
sha256sum -c openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256
```

**Runtime**: injected server-action dependencies for focused proof; existing opt-in disposable PostgreSQL action suites for unchanged canonical receipt/lifecycle behavior, serial execution. **Rollback**: remove forms/action state/server action first; retain all Tasks and receipts and keep `task_action` unchanged.

### S5 — Role routing, route error, accessible browser behavior, preservation, and local docs (budget 390 lines)

**Paths**: `app/admin/(protected)/dashboard/error.tsx`, `components/admin/admin-nav.ts`, `components/admin/admin-shell-client.tsx`, `tests/admin-navigation.test.ts`, `tests/admin-route-boundaries.test.ts`, `app/e2e-manager-capability/page.tsx`, `app/e2e-manager-capability/actions.ts`, `app/e2e-manager-capability/route-error-fixture.tsx`, `e2e/manager-capability.spec.ts`, `tests/task-automation-cutover-preservation.test.ts`, `tests/task-automation-historical-preservation.test.ts`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/implementation/ACTIVE.md`, `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`, `openspec/changes/week-03-role-aware-mi-dia/design.md`, `openspec/changes/week-03-role-aware-mi-dia/tasks.md`.

**Behavior/RED**: S5 exclusively delivers supported `Mi día` versus unsupported `Resumen`, the stable route, and safe route-level error/reset; it also proves fixed-prefix links, direct Manager denial, Asesor current Lead/Quote helper authority, null stale/inaccessible contexts, keyboard path, busy state, live regions, failure focus, unsupported Dashboard preservation, the routing threat row, final protected manifest, and regression receipt. No earlier slice claims navigation or route-error completion.

| Owned file | Maximum additions + deletions |
|---|---:|
| `app/admin/(protected)/dashboard/error.tsx` | 19 |
| `components/admin/admin-nav.ts` | 6 |
| `components/admin/admin-shell-client.tsx` | 4 |
| `tests/admin-navigation.test.ts` | 20 |
| `tests/admin-route-boundaries.test.ts` | 28 |
| `app/e2e-manager-capability/page.tsx` | 36 |
| `app/e2e-manager-capability/actions.ts` | 13 |
| `app/e2e-manager-capability/route-error-fixture.tsx` | 12 |
| `e2e/manager-capability.spec.ts` | 90 |
| `tests/task-automation-cutover-preservation.test.ts` | 12 |
| `tests/task-automation-historical-preservation.test.ts` | 2 |
| `docs/DECISIONS.md` | 6 |
| `docs/PROGRESS.md` | 16 |
| `docs/implementation/ACTIVE.md` | 16 |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | 30 |
| `openspec/changes/week-03-role-aware-mi-dia/design.md` | 38 |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | 40 |
| Unallocated correction reserve | 2 |
| **S5 hard maximum** | **390** |

**Focused commands**:

```bash
FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-contract.test.ts tests/mi-dia-adapter.test.ts tests/mi-dia-actions.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts tests/follow-up-task-dashboard-cutover.test.ts
node --import tsx --test --test-concurrency=1 tests/mi-dia-page.test.tsx
npm run test:e2e -- e2e/manager-capability.spec.ts
```

**Preservation/runtime commands**:

```bash
RUN_MI_DIA_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-runtime.test.ts
RUN_TASK_AUTOMATION_DB_TESTS=1 RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-action-*.test.ts tests/task-actions-*.test.ts tests/task-automation-*.test.ts tests/task-source-*.test.ts
FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/tasks-*.test.ts tests/follow-up-task-*.test.ts tests/crm-contact-*-task-read-runtime.test.ts tests/lead-events-append-only-runtime.test.ts
sha256sum -c openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256
npm run lint
npx tsc --noEmit
npm run build
```

**Runtime**: gated local Playwright Chromium plus serial disposable PostgreSQL 16 suites; external boundaries remain disabled by the existing E2E server setting. Automation/notification code is regression-only and unchanged. **Rollback**: revert S5 routing/error/fixture/docs, then S4 -> S1 in reverse; do not claim rollout, production readiness, or Week 03 closure.

## Migration / Rollout

No rollout or remote migration is authorized. `0089` is an additive local artifact after `0088`, and all database evidence is disposable. The implementation may report locally verified Mi día behavior only. A later rollout requires separate current-state inspection and authorization and is outside this design.

## Open Questions

None. The approved product choices and current executable Task/action/role contracts are sufficient; the selected definer boundary is required by the existing profile RLS and narrow Manager-label requirement.
