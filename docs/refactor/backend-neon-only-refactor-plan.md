# Backend Neon-Only Mock Removal and Refactor Plan

Status: owner-approved implementation plan; runtime implementation has not started  
Planning tier: L (cross-API, database, auth, and minimal Frontend contract change)  
Approved direction: 2026-08-29  
Execution model: sequential Luna write slices; mainline review and verification gate after every slice

## Overview

- Goal: remove `pet.mock.ts`, `auth.mock.ts`, and `staff.mock.ts` from production; make every existing SQL-backed API use Neon without local data fallback; reduce `auth.controller.ts` and `staff.repository.ts` by separating their existing responsibilities; preserve or explicitly migrate every affected function contract.
- Users: managers, staff, and pet parents using the existing Trinity application.
- Product outcome: the Backend either returns data backed by PostgreSQL/Neon or fails explicitly. It must never make a SQL-backed request appear successful by returning process-local fixtures.
- Non-goals: real email delivery, payment-provider integration, replacement of Frontend-only fixtures, AiService changes, Docker workflow changes, broad route authorization redesign, commit, push, deployment, or live production migration.
- Risk class: high. The work touches authentication, staff deletion, assignment ownership, user data, API contracts, and PostgreSQL transactions.

## Research findings [ready for plan]

- Evidence examined: `agents.md`, `docs/clean-code-rules.md`, all Backend routes, the three production mock modules and their consumers, `auth.controller.ts`, `staff.repository.ts`, direct services/repositories/controllers, `Backend/database/neon.sql`, Backend unit/PostgreSQL test runners, affected Backend tests, and the direct Frontend Pet assignment consumers.
- Confirmed current state: auth login/signup/session flows are PostgreSQL-backed, but `AuthService.getStaffOptions()` and `getManagerRecipient()` still use `DUMMY_USERS`; staff reads/writes can fall back to `MOCK_STAFF` and `MOCK_FACILITIES`; staff assignment reads merge PostgreSQL with `MOCK_PETS`; Pet Profile assignment writes only to `assigneeByPetId`; Task APIs read but do not write `employee_assignments`.
- Gaps: there is no production API that inserts, updates, or deletes `employee_assignments`; PostgreSQL API preflight does not currently include `employee_assignments`; current assignment unit tests prove only process-local behavior.
- Weak reasoning: Git authorship and line count do not determine the migration size. Runtime consumers and API contracts determine the required scope.
- Unsupported assumptions: none remain for planning. Live Neon row contents are not assumed; implementation must use an isolated `TEST_DATABASE_URL` for mutation tests.
- Assumption alignment: SQL-backed APIs use Neon and stateless endpoints are exempt (human-aligned); test-only doubles are allowed while production mocks are forbidden (human-aligned); legacy mock rows are not migrated (human-aligned); Pet Profile assignment becomes a dedicated dated-shift assignment API (human-aligned); mock email and mock payment behavior are excluded (human-aligned).
- Missing requirements: none for the approved scope.
- Ambiguities: none material. “No mock” in this plan means no three named production mock modules, no related production fallback, and no process-local Pet assignment state. It does not claim that excluded mock email/payment behavior was removed.
- Contradictions: README currently describes fallback and process-local assignment behavior that the target state removes. Documentation must be updated after implementation while preserving unrelated user edits.
- Questions that require human answers: none. A new material decision discovered during implementation is a stop condition, not permission for Luna to guess.

## Owner-approved Task Blueprint

### Objective and product outcome

Replace the three production mock data sources with neutral contracts and Neon-backed repositories. Preserve current auth, staff, pet, and task behavior except for the approved assignment contract migration: assignment is removed from Pet Profile PATCH and becomes a dedicated `employee_assignments` operation with date and shift data.

### In scope

- Delete:
  - `Backend/src/services/pet.mock.ts`
  - `Backend/src/services/auth.mock.ts`
  - `Backend/src/services/staff.mock.ts`
- Remove `MOCK_PETS`, `MOCK_STAFF`, `MOCK_FACILITIES`, `DUMMY_USERS`, `assigneeByPetId`, and profile database fixture fallback from production paths.
- Move Pet and Staff types/constants into neutral contract modules.
- Make Auth staff-option and manager-recipient reads use PostgreSQL.
- Make Staff list/detail/options/read/write/delete paths fail closed when PostgreSQL is unavailable.
- Split `staff.repository.ts` into bounded read, assignment, and write responsibilities.
- Correct the known staff transaction and assignment consistency problems while those paths are refactored.
- Create a dated-shift Pet assignment API backed by existing `employee_assignments`.
- Remove scalar `assigneeId` ownership from Pet Profile PATCH and update the minimum Frontend consumer contract.
- Correct and split `auth.controller.ts` without changing its public response contracts.
- Rewrite only tests coupled to production mocks; retain useful unit tests and add PostgreSQL read-back coverage.

### Out of scope

- `feedback.notification.service.ts` mock email behavior.
- `petparent.booking.ts` mock payment token behavior.
- Frontend notification, booking, parent-profile, and localStorage fixtures.
- Task API behavior or Task repository implementation. Task files are read-only regression dependencies.
- New database tables or migration of `u1`/`p1` legacy mock identities.
- Request-time DDL, request-time seeding, automatic migration runners, new ORM, dependency-injection framework, repository factory, or generic response framework.
- Root `README.md` cleanup unrelated to the exact changed runtime descriptions.

### Authority and trust boundaries

- Managers own staff account creation/removal and Pet assignment mutation.
- Staff and managers may read staff/Pet assignment state through existing authenticated surfaces.
- PostgreSQL owns users, employees, facilities, pets, and employee assignments.
- Unit tests may use test-only fake repositories/clients. Production source may not import test fixtures or return fixture data.
- Live Neon production mutation is not authorized by this plan. PostgreSQL API tests use only an isolated `TEST_DATABASE_URL`.
- Commit, push, deployment, and publication require separate requests.

## Goal

### Observable success criteria

1. The three named `*.mock.ts` files no longer exist.
2. No non-test Backend file imports those modules or references their exported data.
3. Staff APIs never return fixture data when PostgreSQL is unavailable; the request fails explicitly.
4. Auth staff options and manager recipient are loaded from PostgreSQL.
5. Pet assignment writes and reads survive process restart because they use `employee_assignments`.
6. Pet Profile PATCH no longer accepts or returns scalar `assigneeId` as profile-owned state.
7. Staff assignment list and staff deletion guard use the same PostgreSQL assignment source.
8. Task APIs remain behaviorally unchanged and continue reading `employee_assignments`.
9. `auth.controller.ts` becomes a small compatibility barrel over bounded controllers, or is replaced by equivalent bounded imports without changing routes.
10. `staff.repository.ts` becomes a small compatibility barrel/read owner rather than a 400-line mixed-responsibility module.
11. Every changed exported function has focused unit or contract evidence; every changed persistence flow has PostgreSQL API read-back evidence.
12. Relevant Backend and Frontend builds and tests pass on the final integrated state.

### Validation boundary

Passing tests is evidence for the specified paths, not an absolute guarantee that no future input can fail. Completion requires all mapped checks below; it does not imply live production, browser, or human validation unless explicitly reported.

## Complex change record

- Goal: Neon-only runtime for the three mock-backed domains plus targeted Auth/Staff responsibility refactors.
- Non-goals: email, payments, unrelated fixtures, broad security redesign, new persistence framework.
- Verified current state: mixed DB/mock Staff, process-local Pet assignment, two Auth helpers backed by `DUMMY_USERS`, three named production mock modules.
- Risk and reason for L classification: shared API/data contracts, auth/user data, irreversible staff deletion, PostgreSQL transactions, and a minimal Frontend consumer migration.
- Affected boundaries and dependency order: test isolation -> neutral contracts -> repository split -> DB-only Staff/Auth -> assignment Backend -> assignment Frontend/Pet -> Auth correctness/split -> final integration.
- Units and ownership: Luna writes one sequential slice in an isolated worktree; mainline inspects the diff, runs the specified focused checks, and accepts or re-dispatches against the slice criteria.
- Acceptance criteria -> tests/checks: mapped in each slice and in the final matrix.
- Approval decision: owner approved the blueprint and requested this plan artifact.
- Current status: planned.
- Resume point: Slice L0.
- Unresolved risks or deferred work: excluded mock email/payment remain; live production data is not mutated; root README has a pre-existing user edit that must be preserved.

## Current-to-target data flow

### Current mixed flow

```text
Auth helpers --------> DUMMY_USERS
Staff service --------> PostgreSQL OR MOCK_STAFF/MOCK_FACILITIES
Pet profile ----------> PostgreSQL pet fields + assigneeByPetId Map
Staff assignments ----> employee_assignments + MOCK_PETS
Staff deletion guard -> employee_assignments + MOCK_PETS
Task API -------------> employee_assignments read-only
```

### Target flow

```text
Route/controller -> service/domain rule -> repository -> Neon PostgreSQL
                                              |
                                              +-> explicit failure; no local data fallback

Pet profile ----------> pets/pet_owners only
Pet assignment API ---> employee_assignments
Staff assignments ----> employee_assignments
Staff deletion guard -> employee_assignments
Task API -------------> employee_assignments read-only and unchanged
```

## Target contracts

### Neutral Pet contract

Planned module: `Backend/src/contracts/pet.contract.ts`

```ts
export const PET_TYPES = ['Dog', 'Cat', 'Other'] as const;
export type PetType = (typeof PET_TYPES)[number];

export const PET_GENDERS = ['Male', 'Female'] as const;
export type PetGender = (typeof PET_GENDERS)[number];

export interface Pet {
  id: string;
  name: string;
  checkInDate: string;
  checkOutDate: string | null;
  type: PetType;
  age: number;
  gender: PetGender;
  ownerName: string;
}
```

`assigneeId` is deliberately absent because the schema permits several dated/shift assignments per Pet.

### Neutral Staff contract

Planned module: `Backend/src/contracts/staff.contract.ts`

It owns the existing `STAFF_ROLES`, `STAFF_STATUSES`, `EMPLOYMENT_TYPES`, `StaffMember`, edit/create input types, `FacilityOption`, and `StaffManagementOptions`. It contains no rows, passwords, UUID fixtures, or mutable state.

### Pet assignment API

Existing schema is sufficient; no new SQL migration is planned.

```yaml
apis:
  - method: GET
    path: /api/admin/pets/:petId/assignments
    auth: authenticated employee
    response:
      type: PetAssignment[]
  - method: POST
    path: /api/admin/pets/:petId/assignments
    auth: manager
    request:
      employeeUuid: uuid
      assignmentDate: YYYY-MM-DD
      shiftStart: HH:mm | null
      shiftEnd: HH:mm | null
    response:
      status: 201
      type: PetAssignment
  - method: DELETE
    path: /api/admin/pets/:petId/assignments/:assignmentId
    auth: manager
    response:
      status: 204

data_models:
  - PetAssignment:
      uuid: uuid
      petUuid: uuid
      petName: string
      employeeUuid: uuid
      employeeName: string
      assignmentDate: YYYY-MM-DD
      shiftStart: HH:mm | null
      shiftEnd: HH:mm | null

external_dependencies:
  - Neon PostgreSQL employee_assignments, employees, users, pets
```

Rules:

- `shiftStart` and `shiftEnd` are either both null or both present.
- When both are present, `shiftStart < shiftEnd`.
- Pet and employee must exist.
- For non-null `shiftStart`, the existing unique constraint remains a duplicate authority.
- For all-day assignments where `shiftStart` is null, the repository must lock the Pet row and perform a null-safe duplicate check inside the same transaction because a normal PostgreSQL UNIQUE constraint permits several null values.
- Duplicate outcomes map to HTTP 409 without creating a row.
- DELETE must match both assignment UUID and Pet UUID.
- The assignment API does not create or modify Tasks.

### Pet Profile PATCH

`PATCH /api/admin/pets/:id` retains `type`, `gender`, `age`, and `ownerName`. The request schema becomes strict and rejects `assigneeId`, preventing silent pseudo-persistence.

## Security and data-integrity requirements

- Assignment reads require an authenticated employee; assignment mutations require a manager.
- Frontend assignment requests include the existing session cookie and do not introduce a new token format.
- All SQL values remain parameterized. Dynamic SQL identifiers are not introduced by this refactor.
- Database unavailability fails closed and never becomes a fixture-backed success response.
- Assignment create/delete operations are transactional and verify Pet/employee ownership before mutation.
- Staff deletion checks and deletion execute inside one protected transaction; a concurrent assignment cannot be silently cascaded away.
- Auth logs and errors must not contain reset tokens, passwords, session cookies, raw Google tokens, or unredacted request bodies.
- PostgreSQL integration tests create unique rows and remove only those rows in `finally`; shared canonical fixtures are read-only.

### Staff repository outcomes

Persistence code must return typed outcomes rather than throwing HTTP-layer `AppError` directly. Service code maps those outcomes to existing HTTP errors.

Required outcomes include `found`, `not_found`, `email_conflict`, `last_manager`, `has_assignments`, `self_removal`, `created`, `updated`, and `removed` where applicable. Do not introduce a generic Result framework outside Staff.

## BDD scenarios

```gherkin
Feature: Neon-only Staff data

  Scenario: Staff database is unavailable
    Given a Staff API requires PostgreSQL
    And PostgreSQL cannot be reached
    When the request is handled
    Then the API returns an explicit server or service-unavailable error
    And no MOCK_STAFF or MOCK_FACILITIES data is returned

  Scenario: Manager recipient is loaded for Suggestion feedback
    Given an employee with manager role exists in PostgreSQL
    When Suggestion feedback resolves its manager recipient
    Then the recipient id, name, and email come from PostgreSQL
    And auth.mock.ts is not used

Feature: PostgreSQL Pet assignments

  Scenario: Manager creates a dated assignment
    Given the Pet and employee exist
    And the manager supplies a valid date and shift
    When the manager creates the assignment
    Then employee_assignments contains the new row
    And a subsequent GET returns the persisted row

  Scenario: Manager creates a duplicate assignment
    Given the same Pet, employee, date, and shift-start assignment exists
    When the manager submits it again
    Then the API returns 409
    And no duplicate row is created

  Scenario: Staff profile reads assigned Pets
    Given employee_assignments contains assignments for the staff member
    When the Staff assignment endpoint is read
    Then every item is sourced from PostgreSQL
    And no MOCK_PETS merge occurs

  Scenario: Staff deletion is blocked by assignments
    Given employee_assignments contains a row for the staff member
    When a manager attempts to delete the staff member
    Then the API returns 409
    And the user and assignment rows remain

  Scenario: Pet Profile no longer owns assignment
    Given the Pet Profile PATCH contract excludes assigneeId
    When a client sends assigneeId in the profile payload
    Then the request returns 400
    And neither Pet profile nor assignment state changes

Feature: Auth controller correctness

  Scenario: Google signup uses normalized profile data
    Given profile fields contain valid surrounding whitespace
    When Google signup passes validation
    Then the service receives parsed trimmed values

  Scenario: Password reset URL exposure is not implicitly enabled
    Given the explicit local-reset exposure setting is absent
    When password reset is requested for an existing account
    Then the response does not expose the token or reset URL
```

## Luna slice execution rules

Every slice is sequential. Do not start a dependent slice before mainline marks its dependency complete.

Each Luna dispatch must contain:

1. One observable goal.
2. Exact allowed files and read-only dependencies.
3. Forbidden files and non-goals.
4. Current behavior and target delta.
5. Function-level inputs, outputs, side effects, caller, and dependency.
6. Test/check mapped to every completion criterion.
7. Stop conditions.
8. No commit, push, live Neon mutation, broad formatting, or unrelated cleanup.

Each mainline gate must:

1. Compare the diff to allowed files.
2. Re-read changed functions and tests.
3. Run the focused commands.
4. Check `git diff --check` for the slice.
5. Accept only when every criterion is evidenced; otherwise re-dispatch the same slice with exact corrections.

## Slice L0: Decouple Staff unit tests from production fixtures [planned]

- Phase goal: Staff service business-rule tests use test-only repository doubles instead of database-unavailable production fallback.
- Affected components:
  - Change: `Backend/src/__tests__/staff.service.test.ts`
  - Read-only: `Backend/src/services/staff.service.ts`, `Backend/src/repositories/staff.repository.ts`
  - Forbidden: production source, SQL, Frontend, README.
- Data flow: test-local Staff rows -> mocked repository functions -> real Staff service -> assertion.
- Pseudocode:

  ```text
  create test-local staff state
  mock repository reads/writes against that state
  call real staff service functions
  assert existing manager/self-edit/validation behavior
  never trigger withDatabaseConnection fallback
  ```

- Edge cases: self-removal, last-manager demotion/removal, duplicate email, malformed email, empty name, assigned/unassigned staff.
- Tests: run only `Backend/src/__tests__/staff.service.test.ts`.
- Completion criteria:
  - Test file does not import `MOCK_STAFF`, `MOCK_FACILITIES`, or `MOCK_PETS`.
  - Existing meaningful service rules remain asserted.
  - Production source is unchanged.
- Stop condition: if a test cannot be expressed without deciding new product behavior, stop and report that single behavior.
- Luna dispatch: “Rewrite only Staff service tests to use test-local repository doubles. Preserve existing business assertions. Do not change product code or broaden test coverage.”

## Slice L1: Move Pet and Staff contracts out of mock modules [planned]

- Phase goal: production modules obtain types/constants from neutral contracts while runtime behavior remains unchanged.
- Affected components:
  - Add: `Backend/src/contracts/pet.contract.ts`, `Backend/src/contracts/staff.contract.ts`
  - Change imports only: `Backend/src/controllers/pet.controller.ts`, `Backend/src/services/pet.service.ts`, `Backend/src/repositories/pet.repository.ts`, `Backend/src/services/staff.service.ts`, `Backend/src/repositories/staff.repository.ts`, affected tests.
  - Read-only: the three mock modules.
  - Forbidden: mock-row deletion, service behavior changes, API changes, SQL, Frontend.
- Data flow: neutral compile-time contracts -> existing controllers/services/repositories; row data still follows current paths until later slices.
- Pseudocode:

  ```text
  copy only types and immutable enum-like constants
  update imports
  leave MOCK/DUMMY rows and behavior untouched
  ```

- Edge cases: preserve exact union values, snake_case `employee_role`, nullable fields, and current public type names.
- Tests: Backend build plus focused Pet/Staff type-consuming tests.
- Completion criteria:
  - No production file imports a type/constant from `pet.mock.ts` or `staff.mock.ts`.
  - No row data moved into contract files.
  - API behavior is unchanged.
- Stop condition: if moving a type requires an API shape change, leave that shape unchanged and report it for its later contract slice.
- Luna dispatch: “Perform a behavior-preserving type/constants extraction only. Do not delete mock rows or refactor functions.”

## Slice L2: Split Staff repository responsibilities without behavior changes [planned]

- Phase goal: reduce the 466-line mixed repository into bounded read, assignment, and write modules before changing persistence behavior.
- Affected components:
  - Change: `Backend/src/repositories/staff.repository.ts`
  - Add: `Backend/src/repositories/staff.read.repository.ts`, `Backend/src/repositories/staff.assignment.repository.ts`, `Backend/src/repositories/staff.write.repository.ts`
  - Change imports: `Backend/src/services/staff.service.ts`, Staff repository tests.
  - Forbidden: SQL semantics changes, fallback removal, AppError redesign, API changes, mock deletion.
- Data flow: Staff service -> bounded repository module -> current PostgreSQL/fallback behavior.
- Pseudocode:

  ```text
  move list/find/facility queries to read repository
  move employee_assignments queries to assignment repository
  move create/update/remove transactions to write repository
  keep staff.repository.ts as a small compatibility export surface
  ```

- Edge cases: legacy id/UUID lookup, nullable fields, phone/avatar tri-state update, existing transaction sequence.
- Tests: existing Staff repository tests and Backend build.
- Completion criteria:
  - No query or rule is duplicated.
  - Public imports continue to resolve.
  - No observable response or SQL behavior changes.
- Stop condition: do not “improve” a query during this mechanical split; record the issue for L5.
- Luna dispatch: “Split by existing responsibility only. Preserve every query and behavior byte-for-byte where practical.”

## Slice L3: Make database access fail closed and remove Staff read fallback [planned]

- Phase goal: Staff read APIs return Neon data or an explicit failure, never local fixtures.
- Affected components:
  - Change: `Backend/src/repositories/database.connection.ts`, `Backend/src/services/staff.service.ts`, `Backend/src/common/middlewares/error.middleware.ts`
  - Change focused tests: database connection/config and Staff service/controller tests.
  - Read-only: Staff repositories, routes, Frontend consumers.
  - Forbidden: Staff writes, assignment contract, mock file deletion, unrelated error framework.
- Data flow: Staff controller -> Staff service -> repository connection -> Neon result; connection error -> one typed database-unavailable error -> global HTTP error.
- Pseudocode:

  ```text
  withDatabaseConnection always attempts PostgreSQL
  remove boolean probe/null return
  on unavailable connection throw one narrow infrastructure error
  Staff reads return repository result only
  never inspect MOCK_STAFF or MOCK_FACILITIES
  ```

- Edge cases: database absent, empty result, not-found result, valid empty facility list.
- Tests: focused database config/connection tests, Staff read service/API tests, one failure-path assertion proving no fixture response.
- Completion criteria:
  - Staff read repository return types no longer contain infrastructure `null`.
  - `getList`, `getManagementOptions`, `getDetail`, and `getByEmail` have no fixture branch.
  - DB unavailable fails explicitly.
- Stop condition: do not change non-Staff repositories or response envelopes beyond the narrow database error mapping.
- Luna dispatch: “Remove only Staff read fallback and the nullable connection sentinel. Preserve Staff API success shapes.”

## Slice L4: Remove Staff write fallback and delete staff.mock.ts [planned]

- Phase goal: Staff create/update/remove functions use PostgreSQL only, and `staff.mock.ts` is deleted.
- Affected components:
  - Change: `Backend/src/services/staff.service.ts`, Staff write tests.
  - Delete: `Backend/src/services/staff.mock.ts`
  - Read-only: Staff repository modules, routes/controllers.
  - Forbidden: transaction redesign, assignment API, auth controller, SQL seed migration.
- Data flow: validated Staff input -> write repository -> PostgreSQL outcome -> Staff response/error.
- Pseudocode:

  ```text
  call repository write
  return DB-backed Staff result
  remove NODE_ENV test fallback and mutable MOCK_STAFF branches
  delete staff.mock.ts after import search reaches zero
  ```

- Edge cases: duplicate email, unavailable DB, not found, self-profile null phone/avatar, temporary password remains returned once.
- Tests: focused Staff service/provisioning/repository tests and relevant Staff API tests.
- Completion criteria:
  - `MOCK_STAFF` and `MOCK_FACILITIES` references are zero outside Git history.
  - `staff.mock.ts` is deleted.
  - Staff write functions retain their success/error contracts.
- Stop condition: if transaction behavior must change to make a test pass, defer it to L5 rather than mixing concerns.
- Luna dispatch: “Delete Staff runtime fixtures only after all write branches are DB-only. Do not refactor transaction semantics in this slice.”

## Slice L5: Correct Staff atomic rules and repository layer ownership [planned]

- Phase goal: Staff write/delete invariants are atomic and repository code no longer throws HTTP-layer errors.
- Affected components:
  - Change: `Backend/src/repositories/staff.write.repository.ts`, `Backend/src/repositories/staff.assignment.repository.ts`, `Backend/src/services/staff.service.ts`, focused tests.
  - Read-only: `Backend/database/neon.sql`, Staff controller/routes.
  - Forbidden: schema redesign, new framework, task code, Frontend.
- Data flow: service use case -> write repository transaction -> typed outcome -> service maps to existing `AppError`.
- Pseudocode:

  ```text
  begin transaction
  lock target and manager/assignment rows needed by the rule
  evaluate last-manager and assignment constraints inside transaction
  allocate username/employee number under the same protected write boundary
  perform mutation once
  commit and return typed outcome
  service maps outcome to existing HTTP contract
  ```

- Edge cases: simultaneous manager demotions/removals, concurrent Staff creation, duplicate username/email, assignment added during removal, read-back failure after commit.
- Tests: repository transaction unit tests plus PostgreSQL concurrency/read-back cases in the Staff integration suite.
- Completion criteria:
  - No repository imports `AppError` from middleware.
  - Last-manager and assignment deletion checks occur inside the mutation transaction.
  - User/employee updates occur exactly once.
  - Existing HTTP status/message contracts remain stable.
- Stop condition: do not add a schema constraint or migration unless current SQL proves the application-only transaction cannot enforce the approved rule; report before widening scope.
- Luna dispatch: “Fix only evidenced Staff atomicity and layer-coupling issues. Use typed local outcomes, not a global Result abstraction.”

## Slice L6: Replace Auth dummy staff lookups and delete auth.mock.ts [planned]

- Phase goal: staff options and manager recipient come from PostgreSQL, and `auth.mock.ts` is deleted.
- Affected components:
  - Change: `Backend/src/repositories/staff.read.repository.ts`, `Backend/src/services/staff.service.ts`, `Backend/src/services/auth.service.ts`, `Backend/src/services/parent.feedback.service.ts`, focused tests.
  - Delete: `Backend/src/services/auth.mock.ts`
  - Read-only: feedback notification implementation, auth routes/controllers.
  - Forbidden: mock email behavior, auth controller refactor, payment, SQL seed migration.
- Data flow: Pet/feedback caller -> Staff service/read repository -> `users` + `employees` -> option/manager recipient.
- Pseudocode:

  ```text
  list employee options from users joined to employees
  find manager recipient from users joined to employees where role=manager
  remove the two staff-directory methods from AuthService
  update callers to Staff service
  delete auth.mock.ts after import search reaches zero
  ```

- Edge cases: no manager row -> explicit configuration/data error; invalid staff status remains governed by existing contract; no plaintext password data in source.
- Tests: focused Staff read repository/service tests, parent feedback manager-recipient test, relevant auth/feedback PostgreSQL API cases.
- Completion criteria:
  - `DUMMY_USERS` references are zero.
  - `auth.mock.ts` is deleted.
  - Login/signup/session behavior is unchanged.
- Stop condition: do not alter mock email sending after resolving the DB-backed recipient; it is explicitly deferred.
- Luna dispatch: “Move only staff-directory lookups out of AuthService and into PostgreSQL Staff ownership. Leave auth flows and notification delivery unchanged.”

## Slice L7: Add PostgreSQL Pet assignment API [planned]

- Phase goal: manager-created Pet assignments are persisted and read from existing `employee_assignments`.
- Affected components:
  - Add: `Backend/src/contracts/pet.assignment.contract.ts`, `Backend/src/controllers/pet.assignment.controller.ts`, `Backend/src/services/pet.assignment.service.ts`
  - Change: `Backend/src/repositories/staff.assignment.repository.ts`, `Backend/src/routes/pet.routes.ts`, `Backend/src/__tests__/pet.api.test.ts`, PostgreSQL API runner/preflight and one focused PostgreSQL assignment test file.
  - Read-only: task repository/service/controller, `Backend/database/neon.sql`.
  - Forbidden: Task code changes, Pet Profile contract changes, Frontend, new table/migration.
- Data flow: authenticated request -> Zod assignment contract -> assignment service -> assignment repository -> existing Neon table -> typed response.
- Pseudocode:

  ```text
  GET validate pet UUID -> query assignment rows -> return typed list
  POST require manager -> validate employee/date/shift
       -> begin transaction and lock Pet row
       -> verify employee and null-safe duplicate state
       -> insert -> map duplicate to 409 -> return row
  DELETE require manager -> delete by pet+assignment UUID -> 204 or 404
  ```

- Edge cases: missing Pet/employee, duplicate assignment with non-null shift, duplicate all-day assignment with null shift, concurrent duplicate requests, one-null shift boundary, start >= end, assignment UUID belongs to another Pet, database unavailable.
- Tests: controller/service unit tests; PostgreSQL create/read/delete read-back; preflight includes `employee_assignments` columns.
- Completion criteria:
  - API contract matches the approved schema semantics.
  - Test-created rows are cleaned in `finally`.
  - Task API focused regression remains green without Task changes.
- Stop condition: no schema or Task changes are allowed; stop if the existing table cannot satisfy the contract.
- Luna dispatch: “Implement one assignment resource over the existing table. Do not touch Pet Profile or Task code.”

## Slice L8: Migrate the minimal Frontend assignment consumer [planned]

- Phase goal: Pet Profile editing and assignment editing call separate APIs while preserving visible assignment functionality.
- Affected components:
  - Change: `Frontend/src/features/admin/api/petApi.ts`, `Frontend/src/features/admin/hooks/usePetDetail.ts`, `Frontend/src/features/admin/types/pet.ts`, `Frontend/src/features/admin/components/pet/PetProfileDetailsPanel.tsx`, `Frontend/src/features/admin/pages/PetDashboardPage.tsx`, exact related tests.
  - Add only if needed to avoid mixing profile/assignment state: one small `PetAssignmentEditor.tsx` colocated with Pet components.
  - Read-only: Backend assignment contract.
  - Forbidden: unrelated Pet panels, TaskTimeline behavior, navigation, feedback, parent UI.
- Data flow: profile form -> Pet Profile PATCH; assignment editor -> credentialed assignment GET/POST/DELETE -> refreshed assignment list.
- Pseudocode:

  ```text
  load Pet detail and assignment list independently
  save profile without assigneeId
  create/delete assignment through dedicated API with credentials included
  refresh assignments after successful mutation
  render assignment date/shift explicitly
  ```

- Edge cases: assignment request failure must not discard successful profile data; empty assignments; save disabled for incomplete date/shift; stale request after Pet id change.
- Tests: focused Pet API, hook, panel/editor, and page tests.
- Completion criteria:
  - Frontend no longer sends `assigneeId` in Pet Profile PATCH.
  - Existing Pet profile fields remain editable.
  - Assignment UI uses the dedicated API and displays persisted assignment semantics.
- Stop condition: do not redesign the page or add unrelated UX; use the smallest existing layout-compatible control.
- Luna dispatch: “Separate only assignment state from the existing Pet profile editor. Preserve visual structure and unrelated Pet behavior.”

## Slice L9: Remove process-local Pet assignment and delete pet.mock.ts [planned]

- Phase goal: Pet APIs and Staff assignment/deletion use PostgreSQL only, allowing `pet.mock.ts` and `assigneeByPetId` to be removed.
- Affected components:
  - Change: `Backend/src/services/pet.service.ts`, `Backend/src/controllers/pet.controller.ts`, `Backend/src/repositories/pet.repository.ts`, `Backend/src/services/staff.service.ts`, `Backend/src/repositories/staff.assignment.repository.ts`, focused tests.
  - Delete: `Backend/src/services/pet.mock.ts`
  - Read-only: assignment API modules, Task modules.
  - Forbidden: Task changes, mock email/payment, new schema.
- Data flow: Pet profile -> Pet repository only; Staff assignment list/delete guard -> assignment repository only.
- Pseudocode:

  ```text
  remove assigneeId from Pet profile types/schema/service
  remove assigneeByPetId and reset helper
  remove MOCK_PETS merge and externalAssignmentCount
  list/count assignments from PostgreSQL
  delete pet.mock.ts after import search reaches zero
  ```

- Edge cases: Pet with no assignments, several assignments, Staff with historical rows, Staff deletion with any remaining assignment, strict rejection of obsolete assigneeId payload.
- Tests: focused Backend Pet/Staff unit tests, PostgreSQL assignment + Staff deletion cases, Task assignment regression.
- Completion criteria:
  - `MOCK_PETS`, `assigneeByPetId`, `petListAssignments`, and `externalAssignmentCount` are absent.
  - `pet.mock.ts` is deleted.
  - Staff assignment counts use real rows rather than `SELECT 1 LIMIT 1`.
  - Pet profile and assignment APIs both satisfy their separate contracts.
- Stop condition: do not add compatibility fallback for `assigneeId`; the Frontend consumer was migrated in L8.
- Luna dispatch: “Remove the obsolete Pet assignment state and final Pet mock module. Use the already-implemented assignment repository only.”

## Slice L10: Fix Auth controller correctness before splitting [planned]

- Phase goal: resolve evidenced Auth correctness/security smells in-place with focused regression tests.
- Affected components:
  - Change: `Backend/src/controllers/auth.controller.ts`, `Backend/src/services/auth.service.ts`, `Backend/src/repositories/auth.repository.ts`, `Backend/src/contracts/auth.signup.contract.ts` only if a combined request schema is needed, focused auth tests.
  - Forbidden: structural file split, route changes, response-envelope redesign, new auth features.
- Data flow: request -> validated parsed data -> Auth service -> Auth repository -> existing response contract.
- Pseudocode:

  ```text
  expose local reset URL only under explicit opt-in
  pass google signup parsed profile data to service
  map persistence conflicts to typed Auth domain errors before controller
  keep public status/message/data shapes unchanged
  log only safe error summaries
  ```

- Edge cases: unset/reset exposure config, malformed Google payload, username/email conflicts, database failure, validate-signup query failure.
- Tests: focused `auth.api.test.ts`, `auth.repository.test.ts`, `auth.first-login.api.test.ts`, relevant PostgreSQL auth cases.
- Completion criteria:
  - No implicit reset-token exposure when environment is unset.
  - Google signup persists normalized parsed values.
  - Controller no longer knows PostgreSQL error code `23505` or constraint names.
- Stop condition: preserve all existing route paths and success/error envelopes.
- Luna dispatch: “Make only the evidenced Auth correctness fixes in the current file. Do not split or redesign yet.”

## Slice L11: Split auth.controller.ts by bounded workflow [planned]

- Phase goal: reduce the 492-line Auth controller while preserving behavior proven in L10.
- Affected components:
  - Add: `Backend/src/controllers/auth.session.controller.ts`, `Backend/src/controllers/auth.signup.controller.ts`, `Backend/src/controllers/auth.password-reset.controller.ts`
  - Change: `Backend/src/controllers/auth.controller.ts` as a small compatibility export surface, focused auth tests only if imports require updates.
  - Read-only: `Backend/src/routes/auth.routes.ts`, Auth service/contracts.
  - Forbidden: new shared response framework, route/API behavior changes, service/repository refactor, Frontend.
- Data flow: unchanged route -> bounded controller -> unchanged service -> unchanged response.
- Pseudocode:

  ```text
  move login/google/current-user/logout/first-login handlers to session controller
  move signup/google-signup/validation handlers to signup controller
  move request/complete reset handlers to password-reset controller
  keep auth.controller.ts as explicit exports so route imports remain stable
  ```

- Edge cases: shared auth cookie helper has one owner; no duplicate conflict/response helpers; no circular imports.
- Tests: all focused Auth API tests and Backend build.
- Completion criteria:
  - Each controller has one workflow purpose.
  - `auth.controller.ts` contains exports only or is comparably small.
  - No behavior or response snapshot changes.
- Stop condition: if a helper is used only twice and is short, keep it with its workflow rather than creating an abstraction.
- Luna dispatch: “Perform a behavior-preserving Auth controller split only. The L10 snapshot is the contract.”

## Slice L12: Final integration, documentation, and mock audit [planned]

- Phase goal: prove the integrated target and update only documentation made stale by the refactor.
- Affected components:
  - Change: `Backend/README.md`; targeted runtime/source sections in root `README.md` only after preserving its pre-existing user edit.
  - Read-only verification: all changed Backend/Frontend/test files, Task modules, canonical schema.
  - Forbidden: new product behavior, broad formatting, mock email/payment cleanup, commit/push/live deployment.
- Data flow: integrated source -> builds/tests/static audit -> documentation claims -> exact read-back.
- Pseudocode:

  ```text
  search production for three deleted mock modules and related fallback symbols
  run changed-path focused checks
  run final Backend unit and PostgreSQL suites once
  run relevant Frontend package checks once
  update only stale DB/mock/assignment documentation
  re-read exact documentation sections
  ```

- Edge cases: root README has unrelated user edits; excluded mock email/payment must remain documented as excluded; no claim of live production verification.
- Tests:
  - Backend build and unit suite.
  - PostgreSQL API suite with isolated `TEST_DATABASE_URL`.
  - Focused Frontend assignment tests and Frontend build/package suite as required by the cross-contract change.
  - `git diff --check` and production source searches.
- Completion criteria:
  - Three files deleted and zero runtime imports/references.
  - No Staff/Pet local fixture fallback or process-local assignment state.
  - All mapped tests/checks pass on the final state.
  - Task behavior remains unchanged.
  - Documentation distinguishes completed DB-only scope from excluded mock email/payment behavior.
- Stop condition: if README overlap cannot be safely isolated, leave it unchanged and report `DOCUMENTATION UPDATE REQUIRED` rather than overwrite user work.
- Luna dispatch: “Integrate and verify only. Fix failures in the owning earlier slice; do not add new behavior during final cleanup.”

## Acceptance criteria to evidence map

| Acceptance criterion                                      | Primary evidence owner                        |
| --------------------------------------------------------- | --------------------------------------------- |
| Test suite no longer depends on production Staff fixtures | L0 focused Staff service test                 |
| Types/constants no longer come from mock files            | L1 build and import search                    |
| Staff reads fail closed                                   | L3 Staff failure-path test                    |
| Staff writes have no fixture fallback                     | L4 Staff service/API tests                    |
| Staff manager/delete/create invariants are atomic         | L5 repository + PostgreSQL concurrency tests  |
| Auth helper data comes from PostgreSQL                    | L6 Staff read + parent feedback tests         |
| Assignment API persists rows                              | L7 PostgreSQL create/read/delete read-back    |
| Frontend separates profile and assignment calls           | L8 focused API/hook/component tests           |
| Pet/Staff no longer use mock or Map assignment            | L9 static search + PostgreSQL Staff/Pet tests |
| Auth correctness findings resolved                        | L10 focused Auth regressions                  |
| Auth controller responsibilities split                    | L11 build + complete focused Auth tests       |
| Integrated application meets scope                        | L12 final package/API checks and static audit |

## Verification commands

Exact commands may be narrowed by the slice, but the final gate uses repository-supported commands only.

```text
npm run build --prefix Backend
npm run test:unit --prefix Backend
npm run test:api:postgres --prefix Backend
npm run build --prefix Frontend
npm run test --prefix Frontend -- --run <focused assignment tests>
npm run lint
git diff --check
```

The PostgreSQL command requires an isolated `TEST_DATABASE_URL`. Missing credentials are a verification blocker, not permission to fall back to mocks or weaken assertions.

## Rollout and rollback

- Integration order is the numbered slice order. L7 and L8 form one cross-contract release boundary even though they are separately reviewed.
- No feature flag is planned; adding one would preserve obsolete dual behavior and contradict the mock-removal goal.
- Before L8 is integrated, L7 may exist only in its isolated worktree/branch; do not publish the backend contract alone.
- Rollback is Git-level reversal of the uncommitted/branch slice. No live production migration is planned, so no data rollback procedure is required by this plan.
- PostgreSQL integration test rows must be uniquely identified and removed in `finally` blocks.
- Staff deletion tests must never target canonical shared fixtures.

## Implementation hard stops

Stop the active slice and return to owner/mainline review if any of the following occurs:

- Existing `employee_assignments` cannot represent the approved dated-shift contract.
- A change requires Task API behavior modification.
- A live Neon schema/data mutation is required.
- An excluded mock email/payment behavior must change to satisfy a slice.
- A new user/role/authorization decision appears.
- The slice must edit files outside its allowlist to pass.
- A focused test reveals an unrelated regression.
- Root README changes overlap ambiguously with the user's existing edit.

## Human approval and completion boundary

- The Task Blueprint and plan are owner-approved for documentation.
- Runtime code, tests, SQL, Frontend, and live Neon have not been modified by this plan-writing task.
- Each implementation slice still requires its specified mainline acceptance gate.
- This document does not authorize commit, push, deployment, publication, or live database mutation.
- “Plan validated” does not mean “runtime implemented” or “production verified.”
