# Manager Capability Authorization Specification

## Purpose

Establish governed `manager`/`Gerencia` semantics and a bounded capability contract for sensitive staff actions. This slice preserves existing role, profile, audit, CRM, RLS, and physical `leads` behavior; Tasks, staff notifications, Mi día, and generic RBAC/RLS rewrites are out of scope.

## Requirements

### Requirement: Persist and recognize the Manager role

The system MUST persist the stable role name `manager` and expose the label `Gerencia` consistently across role vocabulary, role persistence, generated types, sessions, and targeted authorization. Admin MUST remain the only role allowed to create, remove, or change staff-role assignments; Manager MUST NOT govern staff roles.

#### Scenario: Active Manager session

- GIVEN an active profile with a persisted `manager` role
- WHEN the session and role catalog are loaded
- THEN the session recognizes `manager` and the UI may display `Gerencia`
- AND staff-role governance remains unavailable to Manager

#### Scenario: Admin-only staff-role mutation

- GIVEN an authenticated Manager or a Manager combined with another non-Admin role
- WHEN the user attempts to create, remove, or change a staff-role assignment
- THEN the server and database deny the mutation

### Requirement: Preserve active-profile and multirole compatibility

The system MUST continue loading only active profiles and MUST preserve additive multirole semantics for all existing roles. Adding Manager MUST NOT remove, replace, or reinterpret existing role checks unless a named sensitive seam is explicitly covered by this specification.

#### Scenario: Combined roles retain existing access

- GIVEN an active profile with `manager` and `asesor`
- WHEN an existing advisor-authorized flow is evaluated
- THEN the advisor role remains effective
- AND Manager does not grant unrelated access by fallback

#### Scenario: Inactive profile is denied

- GIVEN a profile with any role combination whose `is_active` value is false
- WHEN session or authorization is evaluated
- THEN no staff session or capability is granted

### Requirement: Provide a typed, bounded capability catalog

The system MUST define a static typed catalog and explicit role mapping for discount approval, handoff acceptance, payment verification, refund approval, sensitive traveler read, identity merge, content publish, and incident escalation. Manager approval authority MUST be represented by explicit mappings for the applicable approval capabilities, not inferred from the role name. Access, edit, approve, and delete semantics MUST remain distinct; an unmapped capability MUST NOT receive a broad role fallback. This slice does not claim that `canCapability()` has production callers.

#### Scenario: Explicit capability decision

- GIVEN a recognized active role set and a catalog capability
- WHEN the capability is evaluated
- THEN the result comes only from its explicit mapping
- AND combined roles receive the union of explicit grants, not implicit grants

#### Scenario: Unknown capability fails closed

- GIVEN a capability key absent from the typed catalog
- WHEN authorization is evaluated
- THEN the decision is denied

### Requirement: Defer production capability enforcement to a named follow-up

No newly implemented sensitive business action in this foundation is governed by the eight capability keys. Production action/RPC/RLS capability enforcement and associated audit integration are deferred to `week-02-sensitive-capability-enforcement`, which MUST bind each real action to server plus RPC/RLS enforcement before delivery. Existing Admin/role route enforcement remains authoritative and MUST NOT be described as capability enforcement. UI visibility MAY filter navigation or controls but MUST never authorize an action.

#### Scenario: Future governed action denies before work

- GIVEN the named follow-up binds a real action to an explicit capability and a user lacks that capability
- WHEN the user invokes the server action or RPC, even if a control is visible or directly addressed
- THEN authorization fails before the protected operation
- AND no unauthorized data mutation or protected read occurs

#### Scenario: Future governed sensitive action is auditable

- GIVEN the named follow-up binds an active Admin or explicitly mapped Manager capability to a real action
- WHEN a governed approval or escalation succeeds
- THEN the existing audit/event contract records the action without introducing a new audit schema

### Requirement: Fail closed across migration and authorization boundaries

Unknown or inactive persisted roles, missing generated role values, stale role rows, and inconsistent migration/type states MUST fail closed rather than grant capability. Migration and generated-type updates MUST remain compatible with existing profiles, role assignments, RLS helpers, and deployed data; the physical `leads` table MUST NOT be renamed or recreated.

#### Scenario: Unknown persisted role

- GIVEN a role row whose name is not in the recognized catalog
- WHEN roles are loaded or a capability is checked
- THEN the unknown role contributes no grants and the request is denied when no valid grant remains

#### Scenario: Adversarial authorization coverage

- GIVEN tests exercising unknown, inactive, Manager-only, combined-role, direct-server, and direct-RPC requests
- WHEN the authorization suite runs
- THEN unauthorized sensitive actions are denied at the authoritative boundary
- AND existing CRM, RLS, audit, and `leads` invariants remain passing
