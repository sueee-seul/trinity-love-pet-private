# User Management System: Code-Level Behavior

This document records the current authentication, employee identity, staff profile, and staff
management behavior. It is derived from the current `Backend/`, `Frontend/`, SQL schema, and tests.
It does not describe permissions that are only expected or planned.

## 1. Identity model

The database separates the general account from the employee record:

```text
users
  ├── is_employee / is_pet_owner
  ├── password_hash
  └── display identity

employees.users_uuid -> users.uuid
  ├── facility_uuid
  ├── employment_type
  ├── staff_role       ('manager' | 'staff')
  ├── staff_status     ('active' | 'on-leave')
  └── employee_number
```

The canonical schema defines `users.uuid` as the account identity and `employees.users_uuid` as the
employee identity. `employees.staff_role`, not a `users.role` field, supplies the Manager/Staff
role. An account may be both an employee and a pet owner because `is_employee` and `is_pet_owner`
are independent flags.

The application-facing `AuthenticatedUser` contains:

```text
id
email
name
is_employee
is_pet_owner
employee_role
isUsingTemporaryPassword
```

`AuthService.toAuthenticatedUser()` sets `employee_role` only when `is_employee` is true and the
employee row contains `manager` or `staff`. An unknown employee role becomes `null`.

The relevant schema is in
[database/neon.sql](../Backend/database/neon.sql). The application projection is in
[auth.repository.ts](../Backend/src/repositories/auth.repository.ts) and the public type is in
[auth.service.ts](../Backend/src/services/auth.service.ts).

## 2. Permission rules

### Authentication boundary

| Actor or state                                                | Employee website result                                     | Backend enforcement                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| No valid `wagstay_session`                                    | Redirected to `/login` in the Frontend; API returns 401     | `requireAuth`                                            |
| Authenticated pet owner only                                  | Cannot enter `/admin`; falls back to `/parent` or `/login`  | `AccountRoute identity="employee"` and `requireEmployee` |
| Authenticated employee                                        | Can enter `/admin` after employee profile hydration         | `AccountRoute identity="employee"` and `requireEmployee` |
| Authenticated employee with `isUsingTemporaryPassword = true` | Must go to `/first-login-password` before the admin website | `AccountRoute`                                           |
| Authenticated employee with `employee_role = 'manager'`       | Gets Manager admin routes and staff-management UI           | `AdminPortal` route selection and `requireManager`       |
| Authenticated employee with `employee_role = 'staff'`         | Gets Staff admin routes and self-service profile UI         | `AdminPortal` route selection and route middleware       |

### Staff-management permission matrix

| Operation                                                        | Manager                                                       | Staff                                            | Enforcement and current behavior                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Read the full staff directory                                    | Allowed                                                       | Denied with 403                                  | `GET /api/admin/staff` uses `requireManager`                                                    |
| Read facilities and employment-type options for staff management | Allowed                                                       | Denied with 403                                  | `GET /api/admin/staff/options` uses `requireManager`                                            |
| Create a staff account                                           | Allowed                                                       | Denied with 403                                  | `POST /api/admin/staff` uses `requireManager`                                                   |
| Read another employee by ID                                      | Allowed                                                       | Not available as an arbitrary target             | `resolveTargetStaffId` keeps the Manager URL ID but replaces a Staff URL ID with `req.user.id`  |
| Read the current employee through `/me`                          | Allowed                                                       | Allowed                                          | `GET /api/admin/staff/me` uses the authenticated employee email, not a caller-supplied identity |
| Read assigned pets                                               | Allowed for a selected target; own assignments also available | Own assignments only                             | `GET /api/admin/staff/:id/assignments` passes through the same target resolver                  |
| Edit managed account/employment fields                           | Allowed                                                       | Denied with 403                                  | `PATCH /api/admin/staff/:id` uses `requireManager`                                              |
| Edit own personal profile                                        | Allowed                                                       | Allowed                                          | `PATCH /api/admin/staff/:id/self` uses `req.user.id`                                            |
| Delete a staff account                                           | Allowed, subject to transaction guards                        | Denied with 403                                  | `DELETE /api/admin/staff/:id` uses `requireManager`                                             |
| Open the Team page                                               | Allowed                                                       | Route is not registered in the Staff route array | `AdminPortal` has `/team` only in `MANAGER_ADMIN_ROUTES`                                        |

The Frontend hides the Team page from Staff, but the backend checks are independent. A Staff user
cannot gain a directory, create, managed-edit, or delete capability by bypassing the UI.

### Important direct-ID behavior

The current code does not return 404 when a Staff user requests another employee ID on the two
employee-only read routes. `resolveTargetStaffId()` applies this rule:

```text
Manager -> use req.params.id
Staff   -> use req.user.id
```

As a result:

- `GET /api/admin/staff/:otherId` returns the authenticated Staff member's own record, if it exists.
- `GET /api/admin/staff/:otherId/assignments` returns the authenticated Staff member's own
  assignments.
- `PATCH /api/admin/staff/:anyId/self` also uses `req.user.id` in the controller, so the path ID
  cannot update another account.

This is the current behavior, not a claim that arbitrary Staff-target 404 semantics exist.

## 3. Employee authentication flow

### Password login

The password login path is:

```text
POST /api/auth/login
  -> auth.session.controller.login
  -> AuthService.login
  -> findUserByCredentials
  -> PostgreSQL users/employees projection
  -> AuthenticatedUser
  -> signed wagstay_session cookie
```

Detailed execution:

1. The controller requires string `email` and `password` values that are not empty.
2. `AuthService.login()` trims the email and calls `findUserByCredentials()`.
3. The repository loads a user, optional pet-owner profile, and optional employee row through one
   projection. It does not return a password hash to the service result.
4. PostgreSQL `crypt()` checks the submitted password against the stored hash.
5. A manager-provisioned hash has the existing `password_hash` prefix `temporary:`. The repository
   removes that marker for the comparison, verifies the temporary password, and exposes
   `is_temporary_password = true` in the projection.
6. The service maps the database role and identity flags into `AuthenticatedUser`.
7. The controller signs a session token whose subject is the user UUID and sets `wagstay_session`.
8. A matching login returns 200 with `{ data: { user } }`. No token is returned in the JSON body.
   Invalid credentials return 401; an unexpected controller error returns 500.

### Session claims and reload

`createSessionToken()` signs only the approved session claims:

```text
sub  -> user UUID
sv   -> AUTH_SESSION_VERSION or '1'
iat
exp  -> eight-hour session lifetime
```

The cookie is HttpOnly, SameSite Lax, secure only in production, scoped to `/`, and has an
eight-hour max age. `requireAuth()` verifies the cookie, then reloads the user from PostgreSQL using
the token subject. The role and identity flags therefore come from the current database projection,
not from untrusted or stale role claims in the browser.

`GET /api/auth/me` is protected by `requireAuth` and returns the reloaded user. `POST /api/auth/logout`
clears the cookie and returns `{ loggedOut: true }`; it does not require an existing valid session.

Sources: [auth.routes.ts](../Backend/src/routes/auth.routes.ts),
[auth.session.controller.ts](../Backend/src/controllers/auth.session.controller.ts),
[auth.middleware.ts](../Backend/src/common/middlewares/auth.middleware.ts),
[auth.service.ts](../Backend/src/services/auth.service.ts), and
[auth.session.ts](../Backend/src/services/auth.session.ts).

## 4. Account creation and password recovery

### Email/password pet-parent signup

`POST /api/auth/signup` validates the complete profile request before calling the service. The
database transaction inserts:

1. one `users` row with `is_employee = FALSE`, `is_pet_owner = TRUE`, and a generated bcrypt hash;
2. one `pet_owners` row linked by `users_uuid`.

Unique email and username violations are converted into a 409 field conflict. A failed profile
insert rolls the transaction back. This account-creation path creates a pet-parent account, not an
employee account.

`POST /api/auth/signup/validate` validates account/profile fields and separately checks email and
username conflicts. `POST /api/auth/check-email` performs a case-insensitive email lookup and
returns 200 when the email exists or 404 when it does not.

The shared signup contract enforces:

- email and username presence;
- password length from 8 to 32 characters;
- at least one number and one symbol;
- no surrounding password whitespace;
- no password substring derived from email local part, username, name, or date of birth;
- matching confirmation password;
- first and last name;
- emergency contact, home address and date of birth are optional (Privacy Act 2020, IPP 1:
  collect only what a booking needs); blank is stored as NULL, and a value that is given must still
  be an international phone number or a valid, non-future date.

### Google account path

`POST /api/auth/google` verifies a Google ID token. An existing email is mapped to the same database
identity and employee-role projection as password login. A verified Google identity with no existing
account returns 404 with `action = 'REQUIRE_SIGNUP'` and profile data for the Frontend to complete.

`POST /api/auth/google/signup` verifies the token again, validates the profile fields, creates a
pet-parent account and profile in one transaction, and stores `password_hash = NULL`. It does not
create an employee record.

### Temporary employee password

The first-login path is separate from ordinary signup:

```text
Manager creates employee
  -> users.password_hash = 'temporary:' + crypt(temporaryPassword, bcrypt salt)
  -> response returns temporaryPassword once
  -> employee logs in
  -> isUsingTemporaryPassword = true
  -> Frontend requires /first-login-password
  -> POST /api/auth/first-login-password
  -> database updates only a temporary-marked hash
  -> employee enters /admin
```

`staff.service.create()` generates a 20-character temporary password with required uppercase,
lowercase, number, and symbol characters. The manager creation response contains the staff
projection and the plaintext temporary password. The Staff edit modal has no password input and
reveals the generated credential only in the creation result view; it says the value will not be
shown again after the window closes.

`POST /api/auth/first-login-password` requires an employee and trusted origin. It rejects requests
when the session is not marked temporary, validates the new password, replaces only the existing
temporary hash, and returns `{ passwordChanged: true }`. The Frontend then clears the temporary flag
in its auth store and navigates to `/admin`.

### Password reset

`POST /api/auth/password-reset/request` requires a trusted origin and a valid email-shaped body. It
always returns the generic message `If the account exists, a reset link has been prepared.`. A local
reset URL is included only when `NODE_ENV !== 'production'` and
`EXPOSE_LOCAL_PASSWORD_RESET_URL === 'true'`; the route does not send an email.

The reset token contains:

```text
sub     -> target user UUID
purpose -> password-reset
pv      -> fingerprint of the current password hash
iat/exp -> fifteen-minute lifetime
```

`POST /api/auth/password-reset/complete` validates the token and new password, verifies the current
password-hash fingerprint, and updates the password only if the hash still matches. A changed,
expired, malformed, or invalid token returns the controlled invalid/expired response. Completing a
reset does not create an auth session.

## 5. Staff management API

The Backend mounts [staff.routes.ts](../Backend/src/routes/staff.routes.ts) at
`/api/admin/staff`. The controller returns raw JSON staff objects rather than the `{ code, msg,
data }` envelope used by the auth controllers.

| Method and route                       | Required actor                    | Controller/service behavior                             | Success shape                  |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------- | ------------------------------ |
| `GET /api/admin/staff/me`              | Employee                          | Uses `req.user.email` and `staffService.getByEmail()`   | One `StaffMember`              |
| `GET /api/admin/staff/options`         | Manager                           | Loads facilities and the allowed employment-type values | `StaffManagementOptions`       |
| `GET /api/admin/staff`                 | Manager                           | Lists all rows from the Staff read repository           | `StaffMember[]`                |
| `POST /api/admin/staff`                | Manager                           | Validates and creates one account and employee row      | `{ staff, temporaryPassword }` |
| `GET /api/admin/staff/:id`             | Employee; target resolved by role | Manager reads the requested ID; Staff reads self        | One `StaffMember`              |
| `GET /api/admin/staff/:id/assignments` | Employee; target resolved by role | Reads assigned pets from `employee_assignments`         | `AssignedPet[]`                |
| `PATCH /api/admin/staff/:id`           | Manager                           | Changes manager-owned account/employment fields         | One updated `StaffMember`      |
| `PATCH /api/admin/staff/:id/self`      | Employee                          | Ignores the path target and updates `req.user.id`       | One updated `StaffMember`      |
| `DELETE /api/admin/staff/:id`          | Manager                           | Deletes only after transactional guard checks pass      | 204                            |

The Staff repository facade only re-exports responsibility-specific modules:

- [staff.read.repository.ts](../Backend/src/repositories/staff.read.repository.ts) owns directory,
  identity, options, and manager-recipient reads.
- [staff.assignment.repository.ts](../Backend/src/repositories/staff.assignment.repository.ts)
  owns assigned-pet reads and pet assignment operations.
- [staff.write.repository.ts](../Backend/src/repositories/staff.write.repository.ts) owns account
  creation, managed updates, and deletion.

## 6. Staff creation execution

`POST /api/admin/staff` follows this sequence:

1. `requireManager` authenticates the session and checks `employee_role = 'manager'`.
2. `staffService.create()` requires a non-empty name, valid email, facility UUID, and employment
   type (`full-time` or `part-time`). Invalid role/status values fall back to `staff` and `active`.
3. The service generates the temporary password.
4. `createStaff()` starts a transaction and takes the advisory transaction lock
   `hashtext('tropical-love-pet:staff-writes')`.
5. It checks for a case-insensitive email conflict and derives a unique username from the display
   name. Suffixes are added when needed.
6. It inserts `users` with `is_employee = TRUE`, `is_pet_owner = FALSE`, and the temporary-marked
   bcrypt hash.
7. It inserts `employees` with facility, title, employment type, `staff_role`, `staff_status`, and
   the next `WS-####` employee number.
8. It commits, reads the new Staff projection back, and returns the projection plus the one-time
   temporary password.

Any conflict or insert failure rolls back the transaction. The permanent password is not selected
by the Manager and the plaintext temporary password is not stored in the database.

## 7. Profile ownership and managed edits

### Self-owned profile fields

The self-edit contract is deliberately narrow:

```text
StaffSelfEditableFields = name | phone | avatarUrl
```

The controller takes the authenticated `req.user.id`; it does not trust `req.params.id`. The service
validates non-empty names and normalizes optional strings. It passes only those three fields to the
repository. A payload containing `employee_role`, `status`, facility, employment type, or another
manager-owned field cannot promote or reconfigure the account through this route.

The Frontend `ProfileIdentityCard` displays role, status, employee number, email, and joined date,
but its edit form exposes only full name and contact number. Avatar is part of the typed self-edit
contract but is not edited by this form.

### Manager-owned fields

`StaffManagedFields` contains:

```text
email | employee_role | status | facilityUuid | employmentType
```

The Manager edit path does not change the Staff member's display name. It validates role (`manager`
or `staff`), status (`active` or `on-leave`), facility, employment type, and email before calling
the write repository. The write transaction updates `users.email` and the corresponding employee
fields together.

## 8. Deletion and role-preservation guards

`removeStaff()` starts a transaction, takes the Staff write lock, and locks the target Staff row.
The checks run before deleting anything:

1. Missing target returns `not_found`, which becomes 404.
2. If the target identity matches the acting employee's legacy ID or UUID, the result is
   `self_removal`, which becomes 409 `You cannot remove your own account`.
3. If the target has `staff_role = 'manager'` and there are no other manager rows, the result is
   `last_manager`, which becomes 409.
4. It selects all rows in `employee_assignments` for the target employee with `FOR UPDATE`.
   Any row blocks deletion with `has_assignments` and a 409 message requiring reassignment first.
5. Only when all checks pass does it delete the `users` row. The employee row is removed through the
   database cascade, then the transaction commits.

The same `last_manager` rule applies when `updateStaff()` demotes a Manager to Staff. The query
counts rows with `staff_role = 'manager'`; it does not filter on `staff_status`, so the current code
does not implement an “active managers only” interpretation.

The Frontend `StaffDirectory` mirrors the self-removal and only-manager checks by disabling the
button and showing the reason, but the repository transaction remains the authoritative guard.

## 9. Assigned-pet read behavior

`GET /api/admin/staff/:id/assignments` is a read view over `employee_assignments`, not a second
assignment store. The repository:

1. Resolves the target Staff row.
2. Selects pet, species, owner name, `assignment_date`, and `shift_end` through joins to `pets` and
   `pet_owners`.
3. Uses `DISTINCT ON (p.uuid)` and the newest `assignment_date` ordering to return one row per pet.
4. Maps the result to `AssignedPet` with `petId`, `petName`, `petType`, `ownerName`, and formatted
   `checkInDate`.
5. Sets `checkOutDate` to `null` in the current mapper, so the Frontend displays `Still staying`.

The Staff profile shows `My assigned pets`. The Manager profile shows the current Manager's
assigned pets, while the Manager Team page can open a selected employee's assignments. The Staff
management surface reads these assignments; it does not define the separate pet-assignment mutation
contract.

## 10. Frontend state and route flow

`App.tsx` first calls `GET /api/auth/me` to hydrate `useAuthStore`:

```text
GET /api/auth/me
  -> login(user) or logout()
  -> AccountRoute checks identity flags
  -> temporary employee -> /first-login-password
  -> employee -> AdminPortal
```

`AdminPortal` then hydrates `useCurrentStaffStore`:

1. If the authenticated `User` has an ID, it calls `fetchStaffById(user.id)`; otherwise it calls
   `fetchStaffByEmail(user.email)`.
2. Once the Staff record is ready, it starts `fetchStaffAssignments(staff.id)`.
3. A request sequence and identity key prevent a stale account response from overwriting the current
   account after logout or account switching.
4. `clear()` resets the current Staff record, assignments, errors, and in-flight maps.
5. The current `staff.employee_role` selects `MANAGER_ADMIN_ROUTES` or `STAFF_ADMIN_ROUTES`.

Manager routes include `/admin/team`; Staff routes do not. Both include `/admin/profile`, but the
route supplies the corresponding profile type. `AdminProfilePage` also refuses to render a profile
when the user is not an authenticated employee.

The Manager profile includes:

- own `ProfileIdentityCard` and self-edit action;
- current Manager assigned-pet view;
- a feedback dashboard placeholder;
- `AdminSettingsView`, where only facility details have an API-backed panel and the other visible
  settings are placeholders.

The Staff profile includes:

- own `ProfileIdentityCard` and self-edit action;
- own assigned-pet view;
- a settings placeholder with no data or API behind it.

The Team page uses `useStaffDirectory()` to load the Manager-only directory and management options,
then delegates create/edit/remove calls to the Staff API. The creation modal does not accept a
password; it displays the server-generated temporary credential after a successful response.

## 11. Error boundaries

| Condition                                                         | Current response                                                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Missing, invalid, expired, or version-mismatched employee session | 401 `UNAUTHENTICATED`                                                                          |
| Authenticated user lacks `is_employee`                            | 403 `FORBIDDEN`                                                                                |
| Staff calls a Manager-only Staff route                            | 403 `FORBIDDEN`                                                                                |
| Missing staff target                                              | 404 `NOT_FOUND`                                                                                |
| Duplicate email on Staff create/update                            | 409 `CONFLICT`                                                                                 |
| Last Manager demotion/removal                                     | 409 `CONFLICT`                                                                                 |
| Employee tries to remove self                                     | 409 `CONFLICT`                                                                                 |
| Target still has `employee_assignments` rows                      | 409 `CONFLICT`                                                                                 |
| Invalid staff input                                               | 400 `VALIDATION_ERROR` or controller schema error                                              |
| Password reset request with invalid email shape                   | 400                                                                                            |
| Invalid/expired password reset completion                         | 400                                                                                            |
| First-login password called for a non-temporary employee          | 409                                                                                            |
| Database failure in Staff reads/writes                            | Propagated through the database connection/error boundary; Frontend shows a safe generic error |

The Staff Frontend reads `StaffApiError.status` and the server's `error.message` for actionable
conflict messages. It does not fabricate a Staff record or assignment list when a database read
fails.

## 12. Test-to-behavior map

| Behavior                                                                                        | Test source                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Cookie authentication, database role reload, employee/Manager gates                             | `Backend/src/__tests__/auth.middleware.test.ts`, `auth.api.test.ts`, `auth.session.test.ts` |
| Password hash, temporary marker, transactional account creation, reset hash checks              | `Backend/src/__tests__/auth.repository.test.ts`, `auth.api.test.ts`                         |
| Staff create/update/delete guard outcomes and self-edit field boundary                          | `Backend/src/__tests__/staff.service.test.ts`                                               |
| Staff transaction ordering and assignment-blocked deletion                                      | `Backend/src/__tests__/staff.repository.test.ts`                                            |
| PostgreSQL Staff create, read, update, assignment, Manager-only create, first login, and delete | `Backend/src/__tests__/api.postgres.staff.test.ts`                                          |
| Staff directory reads and manager-recipient query                                               | `Backend/src/__tests__/staff.read.repository.test.ts`                                       |
| Temporary password generation and projection separation                                         | `Backend/src/__tests__/staff.provisioning.test.ts`                                          |
| Employee route selection and temporary-password redirect                                        | `Frontend/src/shared/auth/AccountRoute.test.tsx`                                            |
| First-login/reset UI behavior                                                                   | `Frontend/src/shared/auth/components/__tests__/FirstLoginPasswordPage.test.tsx`             |
| Manager/Staff profile presentation and assigned-pet view                                        | `Frontend/src/features/admin/pages/__tests__/AdminProfilePage.test.tsx`                     |
| Creation form field ownership and one-time credential reveal                                    | `Frontend/src/features/admin/components/profile/__tests__/StaffEditModal.test.tsx`          |
| Staff API payload and status handling                                                           | `Frontend/src/features/admin/api/staffApi.test.ts`                                          |

Evidence status: Confirmed from current source, schema, and test code unless a paragraph explicitly identifies a current placeholder or the Staff direct-ID behavior.
