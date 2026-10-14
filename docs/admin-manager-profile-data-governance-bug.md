# Admin Manager Profile Identity and State Ownership Bug

Status: Resolved for the verified implementation; residual architecture and production-measurement observations remain open
Severity: High (proposed; production frequency and affected staff count are not yet measured)
Scope: Admin current-staff identity, profile rendering, and account-state synchronization

## Summary

Entering `/admin/profile` as a manager previously rendered the wrong profile view before the
manager record finished loading. The screen first showed the full-width `Staff profile`, then
entered `Loading your profile…`, and finally showed the `Manager profile` sidebar and content.

The verified implementation resolves the manager-profile transition and current-staff ownership
problem in the local runtime path. A stable authenticated identity and explicit staff role now
cross the backend/frontend boundary, `currentStaffStore` owns the current staff snapshot, and the
profile route waits for an explicit profile status before selecting a role-specific view.

This record does not claim that the historical issue never occurred, that the production incident
rate is known, or that a full production browser audit has been completed.

## Why this matters

The original defect was visible during a basic account action and exposed a deeper inconsistency in
the frontend data model. The verified implementation addresses the ownership and transition parts
of that defect; the production impact remains unmeasured.

| Impact area                  | Historical effect                                                                                   | Current verified boundary                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Manager navigation           | A manager could briefly see `Staff profile` before the manager layout appeared.                     | Explicit profile status prevents unresolved data from selecting the staff view.                  |
| Layout continuity            | The first profile content had no sidebar; the final manager view appeared after another load.       | Manager sidebar and content are rendered by one resolved manager view with shared props.         |
| Network and API work         | Component-local hooks independently requested the current staff record and assignments.             | The store deduplicates current-staff hydration and separates profile readiness from assignments. |
| State ownership              | `authStore` held session data while each `useCurrentStaff()` instance held local profile state.     | `currentStaffStore` owns the current staff profile and assignments snapshot for the admin shell. |
| Identity governance          | The profile lookup depended on mutable email and lacked a stable auth identity in the login result. | Auth exposes `id`; email is retained only as a legacy bootstrap path when no id is available.    |
| State transition correctness | `staff = null` was used as the non-manager branch while data was unresolved.                        | `idle`, `loading`, `ready`, and `error` are handled explicitly at the profile route boundary.    |

There is no evidence in the supplied recording that the database record itself was corrupted, that
the manager was actually demoted, or that an authorization decision was bypassed. The confirmed
historical failure was incorrect intermediate rendering, repeated state loading, and an unclear
source of truth for the current account.

## Observed behavior

The user-provided screen recording from 2026-08-26 shows this sequence after selecting
`Manager Profile` from the admin account menu:

1. The account menu correctly offers `Manager Profile`.
2. The route first displays a full-width `Staff profile` page.
3. The profile card already contains manager data, including a `MANAGER` badge.
4. The page changes to `Loading your profile…`.
5. The final screen displays the manager sidebar, `Manager profile`, and the profile content.

The second state is important: the card contains manager data while the surrounding page is the
staff component. This shows that the backend result was not being rendered by the correct
role-specific page; it does not show that the backend classified the account as staff.

## Confirmed current data flow

The verified implementation flow is:

```text
Successful staff login
  -> AuthService returns AuthenticatedUser(id, email, name, role, staffRole)
  -> id is the stable authenticated identity; staffRole is sourced from employees.staff_role
  -> LoginPage writes user/token to authStore
  -> AdminPortal hydrates currentStaffStore for the authenticated admin session
  -> currentStaffStore fetches by id when available, or uses email only for legacy bootstrap
  -> currentStaffStore publishes profile readiness before assignment readiness
  -> AdminNavbar reads the shared current-staff snapshot for label and avatar
  -> /admin/profile gates idle/loading/error states before choosing a role-specific view
  -> ManagerProfilePage or StaffProfilePage receives the resolved snapshot as shared props
  -> logout clears authStore and the current-staff snapshot
```

The relevant source is:

- [`LoginPage.tsx`](../Frontend/src/features/auth/components/LoginPage.tsx) receives the login
  user and writes it to the auth store before navigating to `/admin`.
- [`authStore.ts`](../Frontend/src/features/auth/store/authStore.ts) persists the authenticated
  user, including the optional stable `id` and explicit `staffRole`, with the token.
- [`AdminPortal.tsx`](../Frontend/src/features/admin/components/AdminPortal.tsx) owns the admin
  shell hydration effect and clears the current-staff state when the session is not an admin
  session.
- [`currentStaffStore.ts`](../Frontend/src/features/admin/store/currentStaffStore.ts) owns the
  current staff profile, assignments, statuses, errors, hydration deduplication, profile save,
  identity keys, and clear lifecycle.
- [`AdminNavbar.tsx`](../Frontend/src/features/admin/components/AdminNavbar.tsx) reads the shared
  snapshot and clears it before logout; it does not start a current-staff request.
- [`AdminProfilePage.tsx`](../Frontend/src/features/admin/pages/AdminProfilePage.tsx) gates on
  authentication and explicit profile status, then passes one resolved snapshot to the selected
  role-specific view.
- [`useCurrentStaff.ts`](../Frontend/src/features/admin/hooks/useCurrentStaff.ts) is a compatibility
  selector over the store; it no longer owns a second local fetch state.
- [`StaffProfilePage.tsx`](../Frontend/src/features/admin/pages/StaffProfilePage.tsx) receives
  resolved staff and assignment data through shared view props.
- [`ManagerProfilePage.tsx`](../Frontend/src/features/admin/pages/ManagerProfilePage.tsx) receives
  the same resolved view props for the manager sidebar and content, while its separate directory
  hook remains responsible for manager team-directory data.
- [`staffApi.ts`](../Frontend/src/features/admin/api/staffApi.ts) provides id lookup, the legacy
  email lookup, and the separate assignments request.
- [`auth.service.ts`](../Backend/src/services/auth.service.ts) exposes the stable user id and maps
  the employee's explicit staff role without changing generic role semantics.
- [`auth.repository.ts`](../Backend/src/repositories/auth.repository.ts) selects the user id and
  `employees.staff_role` through the employee join used by authentication.
- [`staff.routes.ts`](../Backend/src/routes/staff.routes.ts) exposes the id detail, legacy email,
  and assignments endpoints used by the frontend boundary.

## Root cause

The primary architectural gap in the recorded defect was that current-staff data had no single
owner or lifecycle. The implementation combined several problems:

1. **A data-fetching hook was being used as a route discriminator.**

   `AdminProfilePage` decided between manager and staff layouts from `staff?.role`, but the hook
   started with `staff = null`. Unresolved data was therefore treated as the `staff` role.

2. **The same data hook owned local state per component instance.**

   `AdminNavbar`, `AdminProfilePage`, and the active profile page did not share a cache, context,
   store, or in-flight request. Reusing the hook reused fetch logic, not the data.

3. **Parent and child both fetched the same account.**

   `AdminProfilePage` fetched to decide which child to mount, and the selected child fetched again
   to render its content.

4. **Profile identity and assignment data were coupled.**

   The old hook waited for both the staff record and assignments before publishing `staff`, even
   though the navbar and role gate did not need assignments.

5. **The identity join key was not governed as a stable identifier.**

   The old auth contract contained an email but no staff id, so the frontend called
   `/admin/staff/me?email=...`. The staff record already had an id, while manager editing could
   change another staff member's email.

6. **The UI exposed component replacement as a data transition.**

   The staff and manager pages both used `animate-in fade-in`. The animation made the underlying
   unmount/remount sequence more visible, but it was not the root cause.

The verified implementation addresses these causes through one store, an explicit route status
gate, shared role-specific props, separate assignment readiness, and stable-id-first hydration.
UUID-vs-legacy identity keys are handled separately: the authenticated session key is derived from
the auth UUID when present, while the resolved staff record id remains the key used for staff and
assignment API calls. Email is only used for legacy bootstrap when the auth response lacks an id.

Development `StrictMode` can cause effect setup to run more than once. The implementation's
hydration deduplication protects the current-staff boundary, while the manager team-directory
effect has its own list request behavior described in the verification section below.

## Why the current implementation was introduced

The original implementation appears to have been assembled incrementally rather than designed as
one account-state boundary:

- The earlier profile route selected the page from the synchronous `authStore.user.role`.
- Commit `b9ae719` changed that selection to `useCurrentStaff()` while also changing the admin
  navbar to use the same hook. The commit focused on PostgreSQL API read-back coverage and profile
  API alignment; it did not introduce a shared current-staff store, provider, cache, or loading
  gate.
- The hook comment explained that email lookup was chosen because the auth store did not contain a
  staff id and the auth contract was intentionally left unchanged.
- The verified follow-up now extends the auth response with the stable id and explicit staff role,
  and moves current-staff ownership into `currentStaffStore`.

This section is an implementation-history inference, not a claim about the original author's
intent beyond the source comments and commit diff.

## Expected behavior

The admin account has one explicit current-staff state for the authenticated staff session:

```text
Auth login
  -> authStore owns session/token and authenticated identity
  -> AdminPortal hydrates currentStaffStore once for the admin shell
  -> currentStaffStore exposes status, staff, assignments, save, and clear lifecycle
  -> AdminNavbar and profile routes read the same currentStaff snapshot
  -> profile status is resolved before choosing the role-specific layout
  -> assignments load independently from profile identity and role
```

The verified behavior is:

1. `idle` or `loading` does not render `StaffProfilePage` as a default.
2. A manager renders one stable manager layout in which sidebar and content share the same
   resolved view props.
3. Navbar and profile do not maintain competing current-staff copies.
4. Profile identity and role readiness do not wait on assignments.
5. The auth contract exposes a stable id and explicit `staffRole` sourced from
   `employees.staff_role`; generic `role` mapping remains unchanged.
6. Logout clears both authentication state and current-staff state.
7. Profile self-edit updates the canonical current-staff snapshot once; manager team-directory
   operations remain owned by the directory hook.

## Planned remediation

The remediation direction has now been implemented and verified on the local application path.
Production-wide measurement remains open.

## Implemented solution

The verified implementation has three ownership and identity changes:

- The backend auth response now exposes `id` and `staffRole` from `employees.staff_role` while
  preserving the generic `role`.
- `currentStaffStore` is the single profile/assignment owner; `AdminPortal` hydrates it, the
  navbar reads the shared store, the profile route uses explicit status, role pages receive shared
  props, and logout clears the state.
- Stable `authIdentityKey` handles auth UUID versus the returned legacy `StaffMember.id`; email is
  only a legacy bootstrap path.

### Backend contract

The authentication repository now selects the user UUID as a stable string `id` and joins
`employees.staff_role`. `AuthService` returns both fields in the authenticated user response and
token payload. For an employee, `staffRole` is explicitly `manager` or `staff` when that is the
database value; unsupported or non-employee values map to `null`.

The generic `role` semantics remain unchanged: a database `employee` still maps to the generic
application role `staff`, and a database `pet_owner` still maps to `pet-parent`. `staffRole` is the
separate staff-specific role used to preserve the manager/staff distinction.

### Frontend current-staff boundary

- `currentStaffStore` owns the current staff profile, assignments, profile/assignment status,
  errors, save lifecycle, identity keys, hydration deduplication, and clear behavior.
- `AdminPortal` hydrates the store for the authenticated admin session and clears it when that
  session is absent or is a pet-parent session.
- `AdminNavbar` reads the shared snapshot for the account label/avatar and clears the snapshot on
  logout. It does not fetch current staff independently.
- `AdminProfilePage` gates explicit authentication and profile status before routing. An unresolved
  profile displays `Loading your profile…`; an error remains an error rather than becoming a staff
  decision.
- `ManagerProfilePage` and `StaffProfilePage` receive shared resolved props from the route instead
  of starting another current-staff fetch. Manager team-directory reads remain a separate concern.
- Profile readiness is published before assignment readiness, so role and identity consumers are
  not blocked by assignments.
- Logout clears the current-staff snapshot, including profile, assignments, errors, and identity
  keys, before the auth session is cleared.
- Email is only a legacy bootstrap lookup when the authenticated user has no id. UUID-based auth
  identity keys and resolved staff-record identity keys are tracked separately; the resolved staff
  id is used for the staff detail and assignment requests.

## Verification of the defect

The following evidence is available for the verified implementation:

- Backend auth/repository focused tests: 2 files, 28 tests passed. These cover the stable id,
  employee `staff_role` mapping, generic role preservation, and existing Google employee behavior.
- Frontend full suite: 30 files, 134 tests passed; final focused store/profile/navbar tests:
  3 files, 23 tests passed.
- Backend and Frontend builds, Frontend lint, root lint, targeted Prettier, and `git diff --check`
  passed.
- Browser runtime on `localhost:5173` with Backend `localhost:3000`, using an isolated demo
  manager session, showed the Manager profile sidebar and profile content together. The observed
  current-staff requests were exactly one `GET /api/admin/staff/u1` and one
  `GET /api/admin/staff/u1/assignments`, with zero console errors.
- Two `GET /api/admin/staff` list calls observed during development are the separate team-directory
  effect under development `StrictMode`. They are not current-staff duplicate hydration requests.

## Verification gap

The original recording remains evidence of the historical defect. The local browser run and
focused regression tests are evidence for the implemented transition and ownership boundary; they
do not establish production frequency, production latency distribution, real-user credentials, or
coverage of every production browser/environment combination.

## Acceptance criteria for the remediation

The following implementation acceptance criteria are satisfied and supported by the evidence above:

- Satisfied: entering `/admin/profile` as a manager does not render the `Staff profile` heading while the
  current-staff profile is unresolved; the deferred-promise regression test covers this transition.
- Satisfied: the unresolved state renders an explicit loading state and is not interpreted as the `staff`
  role.
- Satisfied: the manager sidebar and manager content appear within one resolved manager layout transition.
- Satisfied: navbar, profile route, and role-specific profile view consume one current-staff snapshot for the
  authenticated staff session.
- Satisfied: a normal profile entry performs one logical current-staff hydration and does not refetch because
  `AdminProfilePage` selected a child component.
- Satisfied: assignment loading does not block consumers that only need current-staff identity and role.
- Satisfied: the auth contract and store use a stable id first, while legacy email lookup remains an explicit
  bootstrap path; UUID-vs-legacy identity handling is covered by store and auth tests.
- Satisfied: logout clears the current-staff snapshot, and stale profile/assignment results are ignored after
  identity change or logout.
- Satisfied: self-edit updates the canonical current-staff state once.
- Satisfied: browser verification shows the manager sidebar and content together, one current-staff detail
  request, one assignment request, and no console errors. The separate team-directory list calls
  are documented above as a StrictMode-specific effect.

## Residual and open observations

The implementation is resolved for the verified local path, but these questions remain unresolved:

- production frequency, affected staff count, request volume, and production latency distribution;
- whether every production authentication path and deployment returns the new id and `staffRole`
  contract consistently;
- whether any external workflow still depends on the legacy email lookup;
- payload size and database cost of profile-plus-assignment hydration under production data volume;
- how active sessions should be invalidated when a manager changes a user's role or email outside
  the current user's self-edit flow;
- whether a full production browser audit is required across real-user credentials, browsers, and
  deployment environments.

There is no claim here about production frequency, real-user credentials, or a completed full
production browser audit.

Evidence status: Confirmed unless noted; implementation-history and production-impact statements
remain inference or unresolved as explicitly labelled.
