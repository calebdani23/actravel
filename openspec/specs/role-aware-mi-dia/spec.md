# Role-Aware Mi día Specification

## Purpose

Define a bounded, role-aware operational queue on `/admin/dashboard` for authorized active Tasks, with deterministic Mexico City day buckets, closed pagination and result contracts, canonical audited actions, accessible states, narrow disclosure, and local-only verification.

## Requirements

### Requirement: Supported roles and deterministic scope

The system MUST offer Mi día only to active sessions whose recognized role union contains `admin`, `manager`, or `asesor`. Scope MUST use this precedence: any `admin` role yields `all`; otherwise any `manager` role yields `team`; otherwise `asesor` yields `self`. Additional recognized roles MUST NOT reduce a supported scope or add work beyond the canonical union. A session with only `operaciones`, `finanzas`, or `marketing`, an unknown-only role set, an inactive profile, or no authenticated profile MUST NOT receive a Mi día scope.

#### Scenario: Admin receives all scope

- GIVEN an active session whose roles include `admin`
- WHEN Mi día authorization is evaluated
- THEN the scope is exactly `all`
- AND additional roles do not narrow that scope

#### Scenario: Manager receives team scope

- GIVEN an active session with `manager` and without `admin`
- WHEN Mi día authorization is evaluated
- THEN the scope is exactly `team`

#### Scenario: Asesor receives self scope

- GIVEN an active session with `asesor` and without `admin` or `manager`
- WHEN Mi día authorization is evaluated
- THEN the scope is exactly `self`

#### Scenario: Unsupported or inactive session receives no scope

- GIVEN a role set containing only `operaciones`, `finanzas`, or `marketing`, an unknown-only role set, an inactive profile, or no authenticated profile
- WHEN Mi día authorization is evaluated
- THEN no Mi día scope, read, item, count, cursor, or action is granted

### Requirement: Exact authorized active Task set

Every Mi día row MUST satisfy all of the following: `task_kind IN ('follow_up','first_contact','quote_follow_up')`, `status IN ('pending','in_progress')`, and the existing `task_actor_can_manage` decision for the current active actor. Admin MUST see all such Tasks, including Admin-owned Tasks. Manager without Admin MUST see such Tasks owned by active non-Admin owners and MUST NOT see Admin-owned Tasks. Asesor without Admin or Manager MUST see only such Tasks whose `owner_id` equals the actor. For supported Admin, Manager, and Asesor actors only, the complete unchanged-page Task-ID set MUST equal the direct Task RLS-visible set under the identical active-kind and active-status predicates. Operations, Finance, Marketing, and unknown-role actors MUST NOT be included in that parity claim; their ownership of an otherwise admitted Task MUST NOT bypass the unsupported-role denial. Terminal Tasks, `manual` Tasks, malformed Tasks, and Tasks outside the helper decision MUST NOT contribute an item or count. Mi día MUST NOT add, approximate, or override Task ownership policy.

#### Scenario: Role matrix matches the canonical helper

- GIVEN active admitted Tasks owned by an Admin, the current Asesor, another Asesor, and a Manager
- WHEN Admin, Manager-only, and Asesor-only actors read Mi día
- THEN each actor receives exactly the Task IDs allowed by `task_actor_can_manage`
- AND Manager-only receives no Admin-owned Task
- AND Task-ID parity is asserted only for these supported actors

#### Scenario: Active kinds and statuses are closed

- GIVEN visible Tasks covering every Task kind and status
- WHEN Mi día is read
- THEN only `follow_up`, `first_contact`, and `quote_follow_up` Tasks in `pending` or `in_progress` appear
- AND all `manual`, `completed`, and `canceled` Tasks are absent from items and counts

#### Scenario: Multirole authorization is a union

- GIVEN an active actor with `manager` and `asesor` but not `admin`
- WHEN Mi día is read
- THEN team-visible non-Admin-owned Tasks are included
- AND adding `asesor` neither hides team Tasks nor exposes Admin-owned Tasks

#### Scenario: Purged context does not change Task authority

- GIVEN an otherwise authorized active Task whose lead or quote context has been purged under existing `ON DELETE SET NULL` behavior
- WHEN Mi día is read
- THEN the Task remains visible under the canonical Task decision
- AND no missing context is reconstructed from history or another CRM relation

### Requirement: Narrow owner and context disclosure

For an already-authorized Task, Mi día MAY disclose only the item fields defined by this specification. `ownerLabel` MUST be the owner's non-empty stored `full_name`; it MUST NOT include email, phone, role assignments, profile metadata, or any other profile field. Context display MUST be limited to the closed kind label, the persisted Task `description`, the applicable nullable context ID, and the policy-derived nullable `navigationHref`. The kind labels MUST be `Seguimiento`, `Primer contacto`, and `Seguimiento de cotización`. This capability MUST NOT add general SELECT access, policies, grants, or reusable reads over profiles, contacts, leads, opportunities, quotes, or historical events.

#### Scenario: Manager receives only the narrow projection

- GIVEN a Manager is authorized for another staff member's active Task
- WHEN the Task is projected into Mi día
- THEN the item may contain that owner's `ownerId` and `ownerLabel`
- AND it contains no owner email, phone, roles, profile object, contact identity, commercial amount, or unrestricted CRM field

#### Scenario: Existing broad reads remain denied

- GIVEN a Manager can read a team Task through Mi día but cannot independently read the owner's profile or the related CRM route
- WHEN the Manager directly requests those broader resources
- THEN the existing denial remains unchanged
- AND Mi día data does not act as a general grant or fallback

#### Scenario: Missing or malformed enrichment fails closed

- GIVEN an authorized Task cannot produce a valid non-empty owner label or its projected context violates the closed item shape
- WHEN the page result is formed
- THEN the read fails as `PERSISTENCE_FAILURE`
- AND no partial item, broader lookup, fabricated label, or provider detail is returned

### Requirement: Closed page request and cursor input

The server-facing page request MUST be exactly `{cursor}` where `cursor` is either `null` or exactly `{referenceTime,afterDueAt,afterId}`. A first-page request MUST use `cursor=null`; the server MUST establish `referenceTime`, use application limit `20`, and send the internal read input exactly as `{referenceTime,limit,afterDueAt,afterId}` with both keyset fields null. A subsequent request MUST copy all three cursor values from the prior successful `nextCursor`, use limit `20`, and send both keyset fields. `referenceTime`, `afterDueAt`, and all returned timestamps MUST use exact canonical UTC microsecond form `YYYY-MM-DDTHH:mm:ss.ffffffZ`; IDs MUST be canonical lowercase UUIDs. Missing keys, extra keys, noncanonical values, or only one keyset field MUST be `INVALID_REQUEST`.

#### Scenario: First page establishes time

- GIVEN an authorized supported session and `{cursor:null}`
- WHEN the first Mi día page is requested
- THEN the server establishes one UTC `referenceTime`
- AND the internal input is exactly that time, limit `20`, `afterDueAt=null`, and `afterId=null`

#### Scenario: Next page carries the original time

- GIVEN a successful page supplies a non-null `nextCursor`
- WHEN that cursor is used for the next page
- THEN its exact `referenceTime`, `afterDueAt`, and `afterId` are carried forward
- AND no new reference time is established

#### Scenario: Partial or extended cursor is rejected

- GIVEN a cursor has only one keyset field, a noncanonical timestamp or UUID, a missing field, or an extra field
- WHEN the adapter validates it
- THEN `INVALID_REQUEST` is returned before database client creation
- AND no best-effort coercion or read occurs

#### Scenario: Database limit is bounded

- GIVEN the internal read boundary receives an integer limit below `1`, within `1` through `50`, or above `50`
- WHEN it applies the limit
- THEN it clamps the effective limit to `1`, preserves an in-range value, or clamps it to `50`, respectively
- AND the application adapter always requests `20`

### Requirement: Due-and-ID keyset pagination

Rows MUST remain ordered by `due_at ASC,id ASC`. A subsequent page MUST select only rows whose key is strictly greater than `(afterDueAt,afterId)`: later due timestamps, or the same due timestamp with a lexically greater lowercase UUID. The read boundary MUST fetch at most `effectiveLimit+1` authorized rows, return at most `effectiveLimit`, and use only the extra row to determine `hasMore`. If `hasMore=true`, `nextCursor` MUST contain the unchanged `referenceTime` and the `dueAt` and `taskId` of the last returned item; otherwise it MUST be null. Page stability is guaranteed only while the qualifying Task data and authorization decisions remain unchanged.

#### Scenario: Equal due timestamps use Task ID

- GIVEN more than one authorized active Task has the same `dueAt` across a page boundary
- WHEN consecutive pages are read
- THEN the lowercase Task ID breaks the tie
- AND each unchanged Task appears exactly once

#### Scenario: Limit plus one determines continuation

- GIVEN `21` qualifying unchanged Tasks and application limit `20`
- WHEN the first page is read
- THEN exactly `20` items are returned
- AND `hasMore=true` with a cursor from item `20`, while the extra row is not exposed

#### Scenario: Final page closes the cursor

- GIVEN no qualifying row exists after the last returned key
- WHEN a page is read
- THEN `hasMore=false`
- AND `nextCursor=null`

#### Scenario: Mutation does not imply snapshot history

- GIVEN a Task is created, rescheduled, terminally acted on, reassigned, or changes authorization between page requests
- WHEN a later page is requested with the prior cursor
- THEN the system applies the current qualifying data after that cursor
- AND it makes no historical-snapshot, no-duplicate, or no-skip guarantee for changed data

### Requirement: Mexico City day buckets and complete counts

Mi día MUST interpret calendar boundaries in IANA zone `America/Mexico_City` while retaining UTC Task due timestamps. `todayStart` MUST be the UTC instant corresponding to local midnight containing `referenceTime`; `tomorrowStart` MUST be the next local midnight. Bucket precedence MUST be: `overdue` when `dueAt < referenceTime`; otherwise `today` when `dueAt < tomorrowStart`; otherwise `upcoming`. Equality with `referenceTime` MUST NOT be overdue, and equality with `tomorrowStart` MUST be upcoming. `counts` MUST describe the complete authorized active admitted Task set at the fixed reference time, not only the current page, and MUST satisfy `total=overdue+today+upcoming` on every page.

#### Scenario: Strict overdue equality

- GIVEN one Task is due one microsecond before `referenceTime` and another is due exactly at `referenceTime`
- WHEN buckets are calculated
- THEN the earlier Task is `overdue`
- AND the equal Task is `today` when it is before `tomorrowStart`

#### Scenario: Tomorrow boundary is exclusive

- GIVEN one non-overdue Task is due one microsecond before `tomorrowStart` and another exactly at `tomorrowStart`
- WHEN buckets are calculated
- THEN the first Task is `today`
- AND the second Task is `upcoming`

#### Scenario: Local midnight uses the named zone

- GIVEN a fixed UTC reference time whose Mexico City local date differs from the UTC date
- WHEN day boundaries are calculated
- THEN `todayStart` and `tomorrowStart` correspond to Mexico City local midnights
- AND no fixed UTC offset or browser timezone changes the result

#### Scenario: Counts remain complete across pages

- GIVEN qualifying work spans more than one page and all three buckets
- WHEN any page is read with the original reference time
- THEN `counts` equals the complete authorized set and is identical on every unchanged page
- AND each count is a nonnegative integer whose sum equals `total`

### Requirement: Closed read result contracts

A successful read MUST contain exactly `{ok,referenceTime,todayStart,tomorrowStart,scope,counts,items,pageInfo}` with `ok=true`; `scope` MUST be `self|team|all`; `counts` MUST contain exactly `{overdue,today,upcoming,total}`; and `pageInfo` MUST contain exactly `{hasMore,nextCursor}`. Each item MUST contain exactly `{taskId,ownerId,ownerLabel,kind,status,description,dueAt,bucket,leadId,quoteId,navigationHref}`. Kind MUST be `follow_up|first_contact|quote_follow_up`; status MUST be `pending|in_progress`; bucket MUST be `overdue|today|upcoming`; IDs and timestamps MUST be canonical; and `navigationHref` MUST be null or a policy-derived same-origin admin path. A failure MUST contain exactly `{ok:false,error:{code,message}}`, where `message` equals `code` and no other field is present.

#### Scenario: Exact success shape is accepted

- GIVEN a provider result has every required key, valid closed values, coherent counts, and no extra key at any level
- WHEN the adapter decodes it
- THEN it returns the exact success contract

#### Scenario: Exact item context is enforced

- GIVEN an item of kind `follow_up` or `first_contact`
- WHEN it is decoded
- THEN `quoteId` is null and `leadId` is a canonical UUID or null only for preserved purged context
- AND for `quote_follow_up`, `leadId` is null and `quoteId` is a canonical UUID or null only for preserved purged context

#### Scenario: Cursor coherence is enforced

- GIVEN `hasMore=true` with a null cursor, `hasMore=false` with a non-null cursor, or a next cursor that does not match the last returned item and fixed reference time
- WHEN the adapter decodes the result
- THEN it returns `PERSISTENCE_FAILURE`
- AND it returns no items or cursor

#### Scenario: Empty success remains a success

- GIVEN the complete authorized set is empty
- WHEN Mi día is read
- THEN the result has zero counts, an empty item array, `hasMore=false`, and `nextCursor=null`
- AND it is not converted into a failure

### Requirement: Auth-first strict adapter and closed failures

The Mi día adapter MUST remain server-only. It MUST resolve authentication and active-profile status, resolve supported role scope, and validate the closed page request in that order before creating a database client or attempting a provider read. The sole database read boundary MUST be exactly `public.read_mi_dia_page(text,uuid,integer,text,text)`, with no overload or default argument, and MUST be `STABLE SECURITY DEFINER`, owned by `postgres`, with fixed `SET search_path = ''`. The migration MUST revoke all privileges on that exact function from `PUBLIC`, `anon`, `authenticated`, and `service_role` before granting `EXECUTE` to `authenticated` only; it MUST add no other function, table, view, profile, or CRM grant or policy.

The read boundary MUST independently require an authenticated active actor, require the expected actor ID to equal the authenticated actor ID, and enforce the same supported role decision. Despite its definer privilege, every Task included in an item or count MUST pass `public.task_actor_can_manage(t.owner_id)` for the current actor. For supported Admin, Manager, and Asesor actors only, the RPC-visible Task-ID set across complete unchanged pagination MUST equal the direct Task RLS-visible set under the identical active-kind and active-status predicates. An active Operations-only, Finance-only, Marketing-only, other recognized unsupported-only, or unknown-only actor MUST receive `AUTH_ROLE_UNSUPPORTED` before any Task lookup or projection, even when canonical Task RLS would expose an active admitted Task owned by that actor; no Task-ID parity assertion applies to such an actor. The only read failure codes MUST be `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_ROLE_UNSUPPORTED|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|PERSISTENCE_FAILURE`. Provider errors, thrown exceptions, malformed success or failure payloads, impossible counts, duplicate Task IDs, out-of-order items, or unknown values MUST map to `PERSISTENCE_FAILURE` without provider text, PII, partial data, event fallback, or a second data source.

#### Scenario: Authentication precedes request validation

- GIVEN an unauthenticated request also contains an invalid cursor
- WHEN the adapter is called
- THEN `AUTH_REQUIRED` is returned
- AND no database client or read is attempted

#### Scenario: Inactive and unsupported roles fail before reads

- GIVEN an inactive profile, or an active profile containing only Operations, Finance, Marketing, other recognized unsupported roles, or unknown roles, including an unsupported actor who owns an active admitted Task
- WHEN the adapter is called with a valid request
- THEN it returns `AUTH_INACTIVE` or `AUTH_ROLE_UNSUPPORTED`, respectively
- AND the denial occurs before database client creation, provider read, Task lookup, or projection, so self-ownership never admits an unsupported actor

#### Scenario: Expected actor mismatch fails independently

- GIVEN an authenticated supported actor invokes the read boundary with another actor's expected ID
- WHEN the boundary authorizes the call
- THEN it returns `AUTH_ACTOR_MISMATCH`
- AND no Task existence, item, count, or owner label is disclosed

#### Scenario: Provider or decoder failure is closed

- GIVEN the provider fails, throws, or returns a missing, extra, wrongly typed, duplicated, incoherent, or out-of-order value
- WHEN the adapter handles the result
- THEN it returns only `PERSISTENCE_FAILURE` in the closed failure envelope
- AND no provider message, partial queue, cached queue, or `lead_events` fallback is returned

### Requirement: Role-aware Dashboard composition and failure isolation

For a supported session, `/admin/dashboard` MUST render Mi día as the primary work section before preserved non-Task Dashboard content and MUST retire the legacy fetch-all follow-up queue as the page's work source. The Dashboard MUST authenticate and determine role support before starting the Mi día read. A Mi día read failure MUST remain inside the Mi día section and MUST NOT erase, fabricate, or convert unrelated metrics or data-quality results. Existing Manager-only fallback behavior for failures in its pre-existing Dashboard dependencies MUST remain authoritative and MUST NOT be triggered solely by a Mi día failure.

#### Scenario: Supported Dashboard renders Mi día first

- GIVEN an active Admin, Manager, or Asesor session and a successful Mi día read
- WHEN `/admin/dashboard` renders
- THEN Mi día appears before preserved non-Task Dashboard sections
- AND the old eight-item fetch-all follow-up queue is not rendered or read

#### Scenario: Mi día failure is isolated

- GIVEN preserved Dashboard metrics and data-quality reads succeed but Mi día returns a closed failure
- WHEN a supported Dashboard renders
- THEN the Mi día section shows its retryable error state
- AND the successful unrelated Dashboard content remains visible and unchanged

#### Scenario: Existing Manager fallback remains separate

- GIVEN a Manager-only session and a failure in an existing metric or data-quality dependency
- WHEN the Dashboard composition runs
- THEN the pre-existing Manager fallback behavior occurs
- AND a Mi día success does not mask that failure

#### Scenario: Unhandled route failure is safe

- GIVEN an unexpected route-level rendering failure outside the closed Mi día read result
- WHEN the Dashboard error boundary renders
- THEN it presents a retry action and safe Spanish copy
- AND it exposes no stack, provider text, PII, or stale Task item

### Requirement: Complete role-aware UI states

The Mi día section MUST use the heading `Mi día`. Scope labels MUST be `Mis tareas` for `self`, `Tareas del equipo` for `team`, and `Todas las tareas` for `all`. Count labels MUST be `Vencidas`, `Hoy`, `Próximas`, and `Total`; bucket headings MUST be `Vencidas`, `Hoy`, and `Próximas`; status labels MUST be `Pendiente` and `En curso`. It MUST provide loading, empty, retryable error, paginated success, action-pending, action-success, and safe action-failure states without optimistic status mutation. Items MUST retain canonical due-and-ID order even when visually partitioned by bucket.

#### Scenario: Loading state is bounded

- GIVEN a supported Dashboard is waiting for its Mi día page
- WHEN loading UI is rendered
- THEN the section identifies itself as `Cargando Mi día`
- AND it shows no stale item, action, count, owner label, or false empty result

#### Scenario: Self-scope empty state is role-aware

- GIVEN a successful empty result with scope `self`
- WHEN the section renders
- THEN it displays `No tienes tareas activas.`
- AND it displays no pagination or action control

#### Scenario: Team or all empty state is role-aware

- GIVEN a successful empty result with scope `team` or `all`
- WHEN the section renders
- THEN it displays `No hay tareas activas para mostrar.`
- AND it displays no pagination or action control

#### Scenario: Paginated success preserves order

- GIVEN a successful page containing more work after its last item
- WHEN the section renders
- THEN it presents the page in `dueAt,taskId` order under the applicable bucket headings
- AND it exposes `Siguiente` only with the server-issued non-null cursor

#### Scenario: Read error is retryable and safe

- GIVEN a closed Mi día read failure
- WHEN the section renders
- THEN it displays `No pudimos cargar Mi día. Intenta de nuevo.` and a `Reintentar` control
- AND it displays no partial items, counts, cursor, provider text, or event-derived fallback

### Requirement: Accessible queue and feedback

Mi día MUST be operable by keyboard and understandable without color. The section MUST have a unique accessible heading, each bucket MUST have a labeled count, Tasks MUST use list semantics, and each due value MUST expose a machine-readable UTC date-time plus human-readable Mexico City date and time. Kind, status, overdue state, and action result MUST be available as text. Loading and action submission MUST expose busy state; success messages MUST use a polite live region; failures MUST use an alert live region; disabled controls MUST remain perceivable; and focus MUST move to newly rendered error feedback when submission or page loading fails.

#### Scenario: Screen reader receives structure and time

- GIVEN a successful page with Tasks in each bucket
- WHEN assistive technology traverses Mi día
- THEN it encounters the Mi día heading, bucket labels and counts, a semantic Task list, textual kind and status, and UTC date-time values
- AND the visible time is identified as Mexico City time

#### Scenario: Keyboard user can complete the flow

- GIVEN a keyboard-only user focuses an actionable Task
- WHEN the user opens, confirms, or cancels an action and navigates to the next page
- THEN every control is reachable and operable in logical order
- AND no hover-only or pointer-only operation is required

#### Scenario: Pending and feedback states are announced

- GIVEN an action is submitted and later succeeds or fails
- WHEN state changes
- THEN busy state prevents duplicate activation
- AND the corresponding polite success or alert failure message is announced

#### Scenario: Meaning is not color-only

- GIVEN overdue, pending, in-progress, disabled, success, and failure styles are displayed
- WHEN color information is unavailable
- THEN text and semantics still distinguish every state
- AND focus remains visibly identifiable

### Requirement: Canonical action availability and mapping

Mi día MUST mutate Tasks only through the unchanged `performTaskAction` and `task_action` boundary. Before any Task context lookup, canonical action invocation, receipt mutation, or path revalidation, the Mi día action wrapper MUST require an authenticated active profile and a recognized role union containing `admin`, `manager`, or `asesor`. An unauthenticated actor MUST receive exact wrapper code `AUTH_REQUIRED`; an inactive profile MUST receive exact wrapper code `AUTH_INACTIVE`; and an active actor containing only Operations, Finance, Marketing, other recognized unsupported roles, or unknown roles MUST receive exact wrapper code `AUTH_ROLE_UNSUPPORTED`, even when the submitted Task is an active admitted Task owned by that actor. Each preliminary denial MUST use exactly `Tu sesión ya no permite actualizar esta tarea.`, disclose no Task existence or provider detail, and remain a wrapper failure rather than a new canonical `task_action` result.

A pending item MUST offer `Iniciar`, `Completar`, and `Cancelar`; an in-progress item MUST offer `Completar` and `Cancelar` but not `Iniciar`. The server action request MUST contain exactly `{requestId,taskId,intent,taskKind,cancelReason}` where `intent=start|complete|cancel`, `taskKind` is an admitted Mi día kind, and IDs are canonical lowercase UUIDs. Start MUST map to target `in_progress` with null reason, outcome, and note. Completion MUST map `first_contact` to `first_contact_completed` and the other admitted kinds to `work_completed`, with null reason and note. Cancellation MUST require exactly one canonical reason `no_longer_needed|duplicate|source_invalidated|other`, use target `canceled`, and send null outcome and note. Caller-supplied target status, completion outcome, note, owner, context, or navigation path MUST NOT be accepted.

#### Scenario: Pending and in-progress controls differ

- GIVEN one pending item and one in-progress item
- WHEN action controls render
- THEN the pending item offers start, complete, and cancel
- AND the in-progress item offers complete and cancel only

#### Scenario: Start maps to the audited boundary

- GIVEN a valid start request for a pending displayed Task
- WHEN the server action maps it
- THEN it invokes the canonical action boundary with target `in_progress` and all action metadata null
- AND it performs no direct Task update

#### Scenario: Completion is kind-aware

- GIVEN displayed Tasks of all three admitted kinds
- WHEN each completion request is mapped
- THEN `first_contact` uses `first_contact_completed`
- AND `follow_up` and `quote_follow_up` use `work_completed`

#### Scenario: Cancellation reason is closed

- GIVEN a user cancels a displayed Task
- WHEN the cancellation is submitted
- THEN one of `Ya no es necesaria`, `Duplicada`, `Origen invalidado`, or `Otro` maps to its canonical reason
- AND a missing, unknown, or extra value is rejected without mutation

#### Scenario: Malformed or forged form fails safely

- GIVEN either an authenticated active supported actor submits missing or extra keys, noncanonical IDs, an unknown intent or kind, an invalid reason combination, or caller-supplied mutation fields, or an unauthenticated or inactive actor submits directly, or an Operations-only, Finance-only, Marketing-only, other recognized unsupported-only, or unknown-only actor directly submits an otherwise valid Mi día action for an active admitted Task they own
- WHEN the Mi día action wrapper handles the submission
- THEN malformed supported input returns the safe `INVALID_REQUEST` state, while preliminary authorization denial returns exactly `AUTH_REQUIRED`, `AUTH_INACTIVE`, or `AUTH_ROLE_UNSUPPORTED` according to the actor state
- AND every preliminary authorization denial displays exactly `Tu sesión ya no permite actualizar esta tarea.` before any Task context lookup, canonical action invocation, receipt mutation, or path revalidation
- AND no denied submission mutates Task, receipt, or Dashboard data or discloses Task existence

### Requirement: Retry-stable actions and safe outcomes

Each user action intent MUST receive one request ID before its first submission. The exact request ID MUST persist across retries of the same Task, intent, kind, and cancellation reason; a new Task, changed intent, changed reason, or prior success MUST use a new request ID. The UI MUST treat canonical `applied`, exact `replayed`, and `already_at_target` outcomes as success and MUST NOT expose receipt internals or add a receipt-read contract. Success copy MUST be `Tarea iniciada.`, `Tarea completada.`, or `Tarea cancelada.` for an applied or replayed action and `La tarea ya estaba actualizada.` for `already_at_target`.

Failure copy MUST map exactly as follows: `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_ROLE_UNSUPPORTED|AUTH_ACTOR_MISMATCH|TASK_FORBIDDEN` to `Tu sesión ya no permite actualizar esta tarea.`; `INVALID_REQUEST` to `La solicitud no es válida.`; `TASK_ACTION_IDEMPOTENCY_CONFLICT` to `La solicitud ya se usó para otra acción.`; `TASK_INVALID_TRANSITION` to `La tarea cambió y esta acción ya no está disponible.`; and `PERSISTENCE_FAILURE` to `No pudimos actualizar la tarea. Intenta de nuevo.`. `AUTH_ROLE_UNSUPPORTED` MUST remain local to the Mi día wrapper and MUST NOT change the canonical `performTaskAction` or `task_action` failure union. No failure MAY include provider text, raw exception text, PII, or optimistic status mutation.

#### Scenario: Exact retry keeps request identity

- GIVEN an action attempt returns a retryable safe failure without a canonical success
- WHEN the user retries the unchanged action
- THEN the same request ID and canonical action input are submitted
- AND no client-generated replacement ID is used

#### Scenario: Already-at-target is successful

- GIVEN the canonical boundary returns `already_at_target`
- WHEN the result is presented
- THEN the UI displays `La tarea ya estaba actualizada.` as success
- AND it does not present a conflict or retry failure

#### Scenario: Conflict and stale transition remain safe

- GIVEN the canonical boundary returns `TASK_ACTION_IDEMPOTENCY_CONFLICT` or `TASK_INVALID_TRANSITION`
- WHEN the result is presented
- THEN the exact safe Spanish mapping is shown
- AND no local Task status is changed

#### Scenario: Forbidden or provider failure leaks nothing

- GIVEN current authority was removed or the provider fails
- WHEN an action is attempted
- THEN the exact safe forbidden/session or persistence message is shown
- AND no provider message, Task existence detail, receipt body, or PII is displayed

#### Scenario: Submission has no optimistic mutation

- GIVEN a Task action is pending
- WHEN the UI waits for the canonical result
- THEN the current status remains displayed, action controls are busy or disabled, and duplicate activation is blocked
- AND status changes only after a successful result and authorized revalidation

### Requirement: Authorized revalidation after action

After any canonical action success, including replay and `already_at_target`, the system MUST revalidate `/admin/dashboard`. It MAY additionally revalidate only the exact non-null `navigationHref` already derived for that item; it MUST NOT accept a revalidation path from form input or derive a broader CRM route from team visibility. A failed or malformed action MUST NOT trigger success revalidation. Revalidation MUST refresh the Task from the authoritative read so terminal work disappears, started work changes status, counts are recomputed, and concurrent changes are not overwritten by client state.

#### Scenario: Success refreshes Dashboard and authorized context

- GIVEN an item has a non-null authorized `navigationHref` and its action succeeds
- WHEN post-action handling completes
- THEN `/admin/dashboard` and that exact context path are revalidated
- AND no unrelated context path is revalidated

#### Scenario: Non-linking item refreshes only Dashboard

- GIVEN a team item or purged-context item has `navigationHref=null`
- WHEN its action succeeds
- THEN only `/admin/dashboard` is revalidated
- AND no context route is invented

#### Scenario: Failure does not claim refreshed success

- GIVEN an action returns any failure
- WHEN post-action handling completes
- THEN success revalidation and success feedback do not occur
- AND the safe failure state remains available for correction or retry

#### Scenario: Revalidation uses authoritative current state

- GIVEN another actor or automation changes the Task while an action is in flight
- WHEN the action result and revalidation complete
- THEN the refreshed page reflects the canonical current Task and counts
- AND stale client state does not overwrite it

### Requirement: Role-aware navigation and safe context links

The stable Home route MUST remain `/admin/dashboard`. Its navigation label MUST be `Mi día` when the active recognized role union includes `admin`, `manager`, or `asesor`; it MUST remain `Resumen` for sessions containing only `operaciones`, `finanzas`, or `marketing`. A Mi día item MAY link to `/admin/leads/{leadId}` for `follow_up` or `first_contact`, or `/admin/quotes/{quoteId}` for `quote_follow_up`, only when the current session independently has route access. Admin MAY link every valid context as before. A non-Admin Asesor MAY link a self-owned Task only when a separate current authorization decision through the existing CRM route policy or helper authorizes that actor for the exact Lead or Quote route; Task visibility, Task ownership, or historical assignment alone MUST NOT grant the link. A stale Lead assignment or an inaccessible Quote MUST produce `navigationHref=null`. Manager-only team rows and Manager+Asesor rows owned by another actor MUST continue to have `navigationHref=null`. A missing or purged context MUST also have a null link.

#### Scenario: Home label changes without route change

- GIVEN an active supported role union
- WHEN admin navigation renders
- THEN the Home item is labeled `Mi día`
- AND its href remains `/admin/dashboard`

#### Scenario: Unsupported-only navigation is preserved

- GIVEN an active session has only Operations, Finance, or Marketing roles
- WHEN admin navigation renders
- THEN the Home item remains labeled `Resumen`
- AND all existing role-visible navigation items remain unchanged

#### Scenario: Admin and owning Asesor receive valid links

- GIVEN an Admin sees a valid-context Task, or an Asesor sees their own valid-context Task and the existing CRM route policy or helper independently authorizes that Asesor's current access to the exact Lead or Quote
- WHEN the item is projected
- THEN its href uses the exact kind-appropriate lead or quote route
- AND the href contains only the canonical context ID
- AND Asesor Task ownership alone is not treated as route authority

#### Scenario: Team visibility does not grant a CRM link

- GIVEN a Manager-only actor or a Manager+Asesor actor sees another owner's team Task
- WHEN the item is projected
- THEN `navigationHref=null`
- AND the related CRM route remains independently denied

#### Scenario: Missing context remains non-linking

- GIVEN an authorized Task has a null context after allowed purge behavior, or an owning Asesor's Lead assignment is stale under the current CRM route policy or the exact Quote is inaccessible to that Asesor
- WHEN the item is projected
- THEN the Task remains actionable with `navigationHref=null`
- AND no Task ownership, historical assignment, historical event, alternate relation, or fabricated ID supplies a link

### Requirement: Operations, Finance, and Marketing Dashboard preservation

An active session whose recognized roles contain none of `admin`, `manager`, or `asesor` MUST branch before any Mi día read or action setup. Operations, Finance, and Marketing MUST receive the complete pre-change Dashboard content, ordering, metrics, fallbacks, and `Resumen` navigation presentation that their existing role union permits. This preservation MUST NOT be implemented by calling Mi día and hiding its result. If any supported role is also present, additive multirole semantics MUST select the supported Mi día scope while retaining all unrelated grants from the other role.

#### Scenario: Other-role Dashboard performs no Mi día work

- GIVEN an active Operations-only, Finance-only, or Marketing-only session
- WHEN `/admin/dashboard` loads
- THEN no Mi día adapter, page read, cursor, action setup, or Mi día fallback is invoked
- AND the existing Dashboard renders

#### Scenario: Existing content remains unchanged

- GIVEN identical non-Task fixtures for an unsupported-only role before and after this change
- WHEN the Dashboard and navigation render
- THEN content, counts, ordering, links, fallbacks, and the `Resumen` label are unchanged

#### Scenario: Supported multirole session receives Mi día additively

- GIVEN an active session combines `asesor` with Operations, Finance, or Marketing and has no Admin or Manager role
- WHEN `/admin/dashboard` loads
- THEN Mi día uses `self` scope
- AND unrelated existing permissions from the additional role remain intact

### Requirement: Complete local verification and regression coverage

Verification MUST prove the specification through focused static, contract, disposable PostgreSQL/RLS, adapter, action, component, route, navigation, accessibility, and browser-level evidence. The role matrix MUST include Admin, Manager, Asesor owner, non-owner Asesor, Manager+Asesor, supported-plus-other-role, Operations-only, Finance-only, Marketing-only, other recognized unsupported-only, inactive, unknown-only, unauthenticated, and Admin-owned Task cases. Task-ID parity proof MUST be limited to supported Admin, Manager, and Asesor actors. Unsupported-role read and action proof MUST use self-owned active admitted Tasks and MUST establish `AUTH_ROLE_UNSUPPORTED` before Task lookup or action rather than extending parity to those actors. Contract proof MUST cover all admitted and excluded kinds/statuses, exact fields, narrow labels, count coherence, Mexico City boundaries, strict overdue equality, due/ID ties, `limit+1`, cursor pairing, malformed payloads, and closed failure codes. Navigation proof MUST establish independent current Lead and Quote route authority for Asesor links, including null links for stale Lead assignment and inaccessible Quote cases. UI proof MUST cover every specified state, exact action mapping and retry identity, revalidation, navigation, keyboard use, focus, live regions, and unchanged unsupported-role behavior.

#### Scenario: SQL visibility equals Task authority

- GIVEN the sole `0089` Mi día function, supported-role fixtures for every required owner case, and self-owned active admitted Tasks for each unsupported-role case
- WHEN migration order, PostgreSQL function metadata and privileges, direct Task RLS visibility, and the Mi día read are compared for supported Admin, Manager, and Asesor actors, and unsupported actors invoke the read boundary
- THEN the exact function is `STABLE SECURITY DEFINER`, is owned by `postgres`, has fixed empty `search_path`, filters every projected Task through `public.task_actor_can_manage(t.owner_id)`, and only for the supported actors the union of its complete unchanged pages equals exactly the direct RLS-visible Task-ID set
- AND every Operations-only, Finance-only, Marketing-only, other recognized unsupported-only, and unknown-only actor receives `AUTH_ROLE_UNSUPPORTED` before Task lookup or projection despite self-ownership, with no parity claim for those actors
- AND the migration revokes all privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role` before granting `EXECUTE` to `authenticated` only
- AND no overload, default argument, additional callable disclosure boundary, or profile or CRM policy or grant broadening is present

#### Scenario: Contract boundaries fail closed

- GIVEN valid and adversarial requests, cursors, provider envelopes, timestamps, IDs, orderings, counts, and action forms
- WHEN contract verification runs
- THEN valid closed values pass and every malformed or extra value produces its specified closed failure
- AND no partial result or provider text escapes

#### Scenario: UI and accessibility states are complete

- GIVEN the loading, empty, error, paginated, pending, success, failure, and unsupported-role fixtures
- WHEN route and browser-level verification runs
- THEN every required state, Spanish label, keyboard path, focus transition, live announcement, and safe link decision is observable

#### Scenario: Canonical regressions remain passing

- GIVEN existing Task RLS, action audit, automation, historical bootstrap, cutover, CRM pending-work/history, Dashboard, navigation, and route-boundary regression families
- WHEN local verification runs
- THEN their prior invariants remain passing with zero event fallback, direct Task mutation, legacy transition, or broadened grant

### Requirement: Local-only delivery and reverse-order rollback

The Mi día read contract and any supporting index MUST be additive after `0088`, MUST perform zero historical Task or event DML, and MUST leave migrations `0061` through `0088` unchanged. All verification and status claims MUST remain local/disposable and MUST NOT imply remote parity, migration application, rollout, production readiness, or Week 03 closure. Before any authorized rollback, Dashboard callers, action forms, navigation, and presentation MUST be reverted to the prior behavior; then adapter/manual types MAY be removed. If the additive Mi día migration is unapplied, it MAY be removed locally. If it was applied under separate future authorization, rollback MUST use a new forward migration to revoke/drop only the Mi día read boundary and its supporting index after callers are reverted. Rollback MUST NOT delete Tasks, origins, outcomes, tombstones, receipts, or events; restore `task_transition`; rewrite history; weaken authorization; or perform an unauthorized remote operation.

#### Scenario: Local success is not rollout

- GIVEN every Mi día verification case passes against local or disposable infrastructure
- WHEN status is reported
- THEN it states local verification only
- AND remote parity, rollout, production readiness, and Week 03 closure remain unclaimed

#### Scenario: Unapplied local rollback is ordered

- GIVEN the additive Mi día migration has not been remotely applied
- WHEN the change is rolled back
- THEN Dashboard callers, actions, navigation, and presentation revert before adapter/types and the local migration are removed
- AND migrations `0061` through `0088` remain byte-for-byte unchanged

#### Scenario: Applied rollback is forward-only

- GIVEN a separately authorized environment has applied the Mi día migration
- WHEN rollback is later authorized
- THEN callers are reverted first and a new forward migration removes only the Mi día boundary and supporting index
- AND no historical migration is edited

#### Scenario: Persisted canonical state is preserved

- GIVEN Tasks, origins, outcomes, tombstones, receipts, or events exist
- WHEN Mi día is disabled or rolled back
- THEN all canonical state and audited action behavior remain intact
- AND no legacy transition, event rewrite, destructive deletion, or unauthorized remote operation occurs
