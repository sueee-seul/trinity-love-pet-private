# Manager Booking Review, Task Management & Staff Operations: Test Criteria Document

> Based on `test-engineering-handbook.md` and `qa-readiness-guide.md`. (`clean-code-rules.md` already
> applied to this branch separately, so it is excluded from this handover.)

---

## 0. Basic Info

| Item                | Details                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature name        | Manager Booking Review, Task Timeline/Management, Task Page (My Tasks), Staff Shift Table, Staff Management Dashboard                                                                    |
| Owner               | Sue                                                                                                                                                                                      |
| Branch / commit SHA | `task_booking_test_Sue`                                                                                                                                                                  |
| Related PR          | Built on merged #183 (staff_task_Sue), #259 (staff_task2_Sue), #348 (staff_dashboard_Sue), #445 (Manager-booking-Sue). This handover covers the follow-up branch `task_booking_test_Sue` |
| Affected boundary   | Frontend, Backend, PostgreSQL                                                                                                                                                            |
| Affected role(s)    | Manager, Staff (pet parent indirectly, via Live Care task events)                                                                                                                        |

---

## 1. Scope & Acceptance Criteria

- **User problem / intended outcome:** Managers need to review paid bookings (approve/refuse/undo) and have that decision automatically populate the pet's care tasks; staff and managers need task/shift visibility split by role instead of one shared, unauthenticated task API.
- **Explicit acceptance criteria:**
  1. Manager can approve, refuse (reason required), or undo a paid booking-pet.
  2. Approving generates that pet's tasks (Feeding ×2/night, Grooming ×1, Extra Playtime/Medication Administration/Outdoor Walk ×1/night when applicable).
  3. Undo reverts `manager_review_status` to `pending` and deletes the tasks that approval generated.
  4. Task Timeline (Pet Profile) groups a pet's tasks into one section per **approved** booking, ordered by check-in **descending** (most recent first), 3 sections visible at a time with Prev/Next paging past that.
  5. Clicking Edit on a task while the editor is already open for a different task immediately shows the newly-clicked task's own title/status/time/staff, not leftover data from the task that was open before.
  6. Any employee can read tasks, edit their own task page ("My Tasks"), and upload/delete task photos (from either Task Timeline or "My Tasks"); only a manager can create a task, delete a task, generate tasks from a booking, or use the Task Timeline's assign-staff/set-time edit path.
  7. Staff Shift Table and Staff Management Dashboard are manager-only end to end (route + nav).
  8. Petlist / Pet Profile header `status` auto-flips `incoming` → `onboarding` once today reaches an **approved** booking's check-in date; `checked out` only changes via the manual action. Refused/pending bookings never surface as a pet's check-in/check-out.
- **Validation rules / error states:**
  - `refuse` with an empty/missing `reason` → `400 VALIDATION_FAILED`.
  - `approve` / `refuse` / `undo` on a non-existent `booking_pets_uuid` → `404`.
  - Task creation without `staffId` or `assignmentId` → rejected (`TaskServiceError`).
  - Task creation/update with a past `dueDatetime` → rejected (`assertNotInPast`).
  - Task creation/update with a `dueDatetime` outside the pet's approved stay window → rejected (`assertWithinStay`), now correctly checked against **any** of the pet's approved bookings, not just the most recent one.

  `assertNotInPast` compares against the current moment; `assertWithinStay` compares against the pet's booked stay dates. Both must pass:

  | Example (today = 9/22, 3:00 PM) | `assertNotInPast`           | `assertWithinStay` (pet's approved stay: 9/20 to 9/23) | Result                  |
  | ------------------------------- | --------------------------- | ------------------------------------------------------ | ----------------------- |
  | Task dated 9/22, 9:00 AM        | Fails: already passed today | Passes: inside 9/20 to 9/23                            | Rejected (past)         |
  | Task dated 9/25                 | Passes: still in the future | Fails: pet checked out 9/23                            | Rejected (outside stay) |
  | Task dated 9/23, 5:00 PM        | Passes                      | Passes                                                 | Accepted                |
  - Staff hitting a manager-only task route (create/delete/from-booking/Task-Timeline-edit) → `403 FORBIDDEN`.

- **Changed routes / pages / APIs:**
  - `PATCH /api/admin/bookings/:id/{approve,refuse,undo}`
  - `POST /api/tasks/from-booking/:bookingId`, `POST /pets/:petId/tasks`, `DELETE /tasks/:taskId`: manager-only
  - `PATCH /pets/:petId/tasks/:taskId`: new manager-only alias of `updateTask` (Task Timeline's edit path)
  - `PATCH /tasks/:taskId`: stays employee-level (staff's own "My Tasks" edits)
  - `POST /tasks/:taskId/photos`, `DELETE /tasks/:taskId/photos/:storedName`: employee-level (both staff and manager can upload/delete task photos); Task Timeline's `TaskTable.tsx` now has the same per-photo delete (×) button "My Tasks" already had
  - `/admin/bookings`, `/admin/shifts`, `/admin/staff-dashboard`: manager-only pages/nav; `/admin/tasks`: staff self-service
- **Known limitations, feature flags, intentionally unsupported cases:**
  - `tasks` has no FK back to the booking that generated it. Grouping, dedupe, and Undo's deletion all identify "this booking's tasks" by date window (`scheduled_at` within `drop_off_time..pick_up_time`). Two of the same pet's bookings with **overlapping** stay dates will cross-contaminate all three. Paige (pet-parent booking owner) is expected to prevent overlapping bookings for the same pet at creation time, which would close this off at the source.
  - `AdminNavbar.test.tsx` still asserts staff can see "Bookings", which is now false; Alan (the test's author) will update the expectation (tracked as a known issue, not fixed in this branch).

---

## 2. Expected Behaviour & Expected Outcome

| Condition / Trigger                                              | Expected Behaviour                                                | Expected Outcome                                                                                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Manager clicks Approve on a pending booking-pet                  | Status → `approved`; tasks generated for that pet                 | `204`; `GET /api/admin/bookings` shows `manager_review_status: "approved"`, `refusal_reason: null`; `tasks` has new rows for that `pet_uuid` |
| Manager clicks Refuse with a reason                              | Status → `refused`, reason stored                                 | `204`; booking shows `refused` + reason; no tasks generated                                                                                  |
| Manager clicks Refuse with an empty reason                       | Rejected before any write                                         | `400 VALIDATION_FAILED`                                                                                                                      |
| Manager clicks Undo on an approved booking                       | Status → `pending`; that booking's tasks deleted                  | `204`; booking back in the Booking tab; those `tasks` rows gone                                                                              |
| Manager opens Pet Profile for a pet with 4+ approved bookings    | Task Timeline pages 3 at a time, newest check-in first            | Only 3 sections rendered; Prev/Next control visible; page 1 shows the latest check-in date first                                             |
| Manager clicks Edit on task 2 while task 1's editor is open      | Editor form now shows task 2's fields                             | Title/status/priority/time/staff match task 2, not task 1                                                                                    |
| Staff calls `POST /pets/:petId/tasks` or `DELETE /tasks/:taskId` | Blocked                                                           | `403 FORBIDDEN`                                                                                                                              |
| Staff opens "My Tasks" and edits their own task's status/issue   | Allowed                                                           | `200`; task updated                                                                                                                          |
| Today's date reaches an approved booking's check-in              | Pet status flips automatically                                    | Petlist/Pet Profile show `onboarding`, not `incoming`                                                                                        |
| A booking is refused or undone                                   | That booking's dates never appear as the pet's check-in/check-out | Petlist/Pet Profile fall back to another approved booking or blank                                                                           |

---

## 3. What to Check in Unit Tests

### TC-UNIT-01: `groupTasksByBooking` buckets tasks by date window

- Risk: high. Wrong grouping mixes one stay's care instructions into another's section.
- Level: util (`TaskTimeline.tsx`)
- Preconditions: a task list and an approved-bookings list with non-overlapping date ranges.
- Steps: 1) call with tasks whose dates fall inside/outside each booking's range 2) inspect returned groups.

| Expected Behaviour                                                                | Expected Outcome                                                                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Each task is bucketed into the one approved booking whose date window contains it | Returned groups partition the input tasks with no duplicates; unmatched tasks appear only in the "Other tasks" group |

- Evidence: `Frontend/src/features/admin/components/__tests__/TaskTimeline.test.tsx`, "grouping tasks by booking" describe block.
- Result: pass

### TC-UNIT-02: Booking sections sort descending and page 3 at a time

- Risk: medium
- Level: component (`TaskTimeline.tsx`)
- Steps: render with 5 approved bookings of different check-in dates; click Next.

| Expected Behaviour                                                           | Expected Outcome                                                                                                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Sections render sorted by check-in descending and sliced to the current page | Page 1 lists the 3 most recent bookings first; Next/Prev correctly slice the remaining bookings and disable at the boundaries |

- Evidence: `Frontend/src/features/admin/components/__tests__/TaskTimeline.test.tsx`, "ordering and pagination of booking sections" describe block.
- Result: pass

### TC-UNIT-03: Task editor remounts per task (no stale form)

- Risk: high. Silent data-corruption risk (editing task 2 could accidentally save under task 1's stale fields).
- Level: component (`TaskEditor` + `key`)
- Steps: open Edit on task 1, then task 2 without closing.

| Expected Behaviour                                                            | Expected Outcome                                                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `TaskEditor` remounts (fresh internal state) whenever the edited task changes | Form fields reflect task 2's title/status/priority/time/staff immediately after the second Edit click, with no leftover task 1 values |

- Evidence: `Frontend/src/features/admin/components/__tests__/TaskTimeline.test.tsx`, "editing a different task while the editor is already open" describe block.
- Result: pass

### TC-UNIT-04: `findPetStayForDate` checks any approved booking, not just the latest

- Risk: high. Previously blocked valid staff assignment for a pet with multiple bookings.
- Level: repository (Backend)
- Steps: seed a pet with 2 approved bookings (older + newer); query a date inside the older one.

| Expected Behaviour                                                                                     | Expected Outcome                                                                                         |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Stay-window check considers every approved booking for the pet, not only the most recently created one | `within_stay` returns `true` for a date inside the older booking even though a newer booking also exists |

- Evidence: `task.assignment.repository.ts` test.
- Result: not run

### TC-UNIT-05: `findIsPastDueDatetime` SQL executes without a syntax error

- Risk: high. A missing quote previously broke every task save with a due date.
- Level: repository (Backend)
- Steps: call with a future and a past datetime.

| Expected Behaviour                                                       | Expected Outcome                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Past-due check executes a syntactically valid comparison against `now()` | Query returns `is_past: false` / `true` correctly for a future / past datetime, with no thrown SQL error |

- Result: not run

### TC-UNIT-06: `pet.repository.ts` derives `status` and filters non-approved bookings

- Risk: high
- Level: repository (Backend)
- Steps: seed a pet with (a) only a pending booking, (b) an approved booking whose check-in is today, (c) a `checked out` pets row.

| Expected Behaviour                                                                                           | Expected Outcome                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pet status and check-in/out are derived from approved bookings only, with `checked out` as a manual override | (a) pending-only pet shows no dates, status `incoming`; (b) an approved booking starting today shows status `onboarding`; (c) a `checked out` pet stays `checked out` regardless of dates |

- Result: not run

### TC-UNIT-07: Task route auth split

- Risk: high (security boundary).
- Level: route/middleware (Backend)
- Steps: call each task route as staff and as manager.

| Expected Behaviour                                                                   | Expected Outcome                                                                                                                                                                |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manager-only routes reject non-manager sessions before reaching the controller logic | Staff sessions get `403` on create/delete/from-booking/`PATCH /pets/:petId/tasks/:taskId`; both roles get `200` on reads, on `PATCH /tasks/:taskId`, and on photo upload/delete |

- Result: not run

### TC-UNIT-08: `remove()` and `save()` surface real error messages

- Risk: medium. Previously failed silently (`remove`) or showed `[object Object]` (`save`).
- Level: hook (`useTaskEditor.ts`)
- Steps: mock a `403`/`401` response from delete and from save.

| Expected Behaviour                                                                                                   | Expected Outcome                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Failed save/delete responses are parsed and shown to the user instead of being swallowed or stringified as an object | `window.alert` displays the server's `error.message` text; a failed delete leaves the task list/editor state unchanged rather than silently closing |

- Evidence: `Frontend/src/features/admin/components/tasks/__tests__/useTaskEditor.test.ts`.
- Result: pass

**Checklist**

- [ ] Happy path
- [ ] Empty / null / undefined input (empty task list, no bookings, empty refuse reason)
- [ ] Invalid input (malformed UUID in `:id`)
- [ ] Repeated calls (re-approve is a no-op; delete twice)
- [ ] State transition boundaries (pagination edges, `pending`↔`approved`↔`refused` via undo)

---

## 4. What to Check in Smoke Tests

| #   | Item to check                                        | Method                                                                   | Expected result                                        | Pass/Fail                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `GET /api/admin/bookings` loads for a manager        | Log in as manager, open Bookings page                                    | List renders, tabs show counts                         | Pass                                                                                                                                                                                                                                |
| 2   | Approve generates tasks                              | Approve a pending booking, open that pet's profile                       | Task Timeline shows a new section with generated tasks | Pass                                                                                                                                                                                                                                |
| 3   | Undo removes tasks                                   | Undo the approval just made                                              | Section/tasks disappear, booking back in Booking tab   | Pass                                                                                                                                                                                                                                |
| 4   | Staff cannot see Bookings/Shifts/Staff Dashboard nav | Log in as staff                                                          | Nav shows Petlist/Inquiries/Tasks/Profile only         | Fail: Booking page nav is correctly hidden for staff in the app itself, but `AdminNavbar.test.tsx` still asserts staff can see it, so the Frontend automated suite fails here. Alan (test's author) will fix the related test file. |
| 5   | Staff cannot create/delete a task                    | Attempt via Task Timeline as staff (if UI exposes it) or direct API call | `403`                                                  | Pass                                                                                                                                                                                                                                |
| 6   | Task Timeline pagination                             | Open a pet with 4+ approved bookings                                     | 3 shown, Prev/Next works                               | Pass                                                                                                                                                                                                                                |

- Related automated commands:
  ```powershell
  npm run test --prefix Frontend -- --run
  npm run test:unit --prefix Backend
  npm run ci:quality
  ```

---

## 5. User Journey

```text
Charter: Explore booking approval → task generation → Task Timeline for a pet with multiple stays
Role/session: Manager, authenticated
Data: One pet with 2+ paid bookings, one pending, one already approved with tasks
Timebox: 30 minutes
Focus: happy path, validation, permissions, loading/error/empty states,
       refresh/navigation, repeated actions (re-approve, re-refuse, undo→re-approve)
Observations: <fill in during execution>
```

**Main user flow ✅**

1. Manager opens Bookings → Booking tab, sees a pending booking-pet.
2. Manager clicks Approve → booking moves to Approve tab.
3. Manager opens that pet's profile → Task Timeline shows a new section for that booking's date range with generated tasks.
4. Manager edits one task: assigns staff + exact time, saves → task updates; Live Care (if open for that pet) refreshes via `task-updated` event.
5. Manager clicks Edit on a different task in the same section → form shows that task's own data.
6. Manager returns to Bookings, clicks Undo on the same booking → it returns to Booking tab; Task Timeline section and its tasks are gone.

**Role-based branches ✅**

- **Manager:** full access: approve/refuse/undo, create/delete tasks, assign staff/time, Staff Shift Table, Staff Management Dashboard.
- **Staff:** can view Task Timeline/My Tasks/Petlist; can update/complete their own tasks and upload photos; cannot create/delete tasks, cannot assign staff in the Task Timeline, cannot see Bookings/Shifts/Staff Dashboard nav or routes.

---

## 6. Edge Cases

| Edge Case                                                                | How to reproduce                                                           | Expected Behaviour                                                                                                                                                                                                                                                                                                | Verified                |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Empty refuse reason                                                      | Submit refuse with blank textarea                                          | `400`, no state change                                                                                                                                                                                                                                                                                            | Y                       |
| Staff calls a manager-only task route directly                           | `curl`/devtools as staff session                                           | `403`, no data change                                                                                                                                                                                                                                                                                             | Y                       |
| Access by unauthorized role (staff → `/admin/bookings`, `/admin/shifts`) | Log in as staff, navigate directly to `/admin/bookings` or `/admin/shifts` | Redirects to `/admin`. `STAFF_ADMIN_ROUTES` maps both paths to `<Navigate to="/admin" replace />` (previously the paths were just absent from the route table, which rendered a blank page); nav link also hidden. **Gap:** `staff-dashboard` doesn't have this redirect yet, so it still renders blank for staff | Y                       |
| Two of the same pet's bookings with overlapping dates                    | Book pet twice with overlapping stay ranges, approve both                  | **Known limitation:** task grouping/dedupe/Undo deletion can cross between them; expected to be prevented upstream by Paige's pet-parent duplicate-booking check, not fixed here                                                                                                                                  | Pending, owned by Paige |
| Duplicate approve (re-click)                                             | Approve an already-approved booking-pet                                    | No duplicate tasks: dedupe on `pet_uuid` + `title` + `scheduled_at` in `insertGeneratedTask` (`Backend/src/repositories/task.fromBooking.repository.ts`)                                                                                                                                                          | Y                       |
| Undo on a booking with no generated tasks (was refused, not approved)    | Undo a refused booking                                                     | Status → `pending`, 0 tasks deleted, no error                                                                                                                                                                                                                                                                     | Y                       |
| Refresh mid-edit                                                         | Open Task Timeline editor, refresh page                                    | Editor closes, no partial save                                                                                                                                                                                                                                                                                    | Y                       |
| Pagination boundary                                                      | On last page, click Next                                                   | Button disabled, no-op                                                                                                                                                                                                                                                                                            | Y                       |
| Boundary: task exactly at booking's check-out date/time                  | Create a task dated exactly at `check_out`                                 | Falls inside that booking's section (inclusive range)                                                                                                                                                                                                                                                             | Y                       |
| Large dataset                                                            | Pet with 10+ approved bookings                                             | Pagination still correct page count; no perf regression in grouping (client-side over already-fetched list)                                                                                                                                                                                                       | Y                       |

---

## 7. API / Contract Changes

| Item                                                   | Details                                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Method & Path                                          | `PATCH /api/admin/bookings/:id/undo` (new)                                                                        |
| Authentication requirement                             | Session cookie                                                                                                    |
| Authorization rule                                     | `requireManager`                                                                                                  |
| Valid request example / expected response              | No body → `204`                                                                                                   |
| Invalid request example / expected error response      | Unknown `:id` → `404`                                                                                             |
| Compatibility with existing Frontend/Backend consumers | New endpoint, additive; no existing consumer broken                                                               |
| Persistence side effect / emitted event                | Deletes tasks in that booking's date window, resets `manager_review_status` to `pending`, clears `refusal_reason` |

| Item                                                   | Details                                                                                                                                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method & Path                                          | `PATCH /api/pets/:petId/tasks/:taskId` (new, manager-only alias of `updateTask`)                                                                                                             |
| Authentication requirement                             | Session cookie                                                                                                                                                                               |
| Authorization rule                                     | `requireManager`                                                                                                                                                                             |
| Valid request example / expected response              | Same body shape as `PATCH /tasks/:taskId` → `200` with updated task                                                                                                                          |
| Invalid request example / expected error response      | Called by staff → `403`; unknown task → `404`                                                                                                                                                |
| Compatibility with existing Frontend/Backend consumers | `useTaskEditor.ts` updated to call this path only when editing an existing task from the Task Timeline; "My Tasks" (`useTaskDashboardTable.ts`) untouched, still uses `PATCH /tasks/:taskId` |
| Persistence side effect / emitted event                | `publishTaskEvent(petId)`: Live Care refresh                                                                                                                                                 |

> Both above require Backend contract coverage (TC-UNIT-04/05/06/07) and a Frontend consumer check (Task Timeline's editor calling the right path per role).

---

## 8. Required Test Environment / Data

- **Required test accounts per role:** one manager account, one staff account (see `Backend/README.md`'s Local demo authentication section for provisioning).
- **Required fixtures:** at least one pet with 2+ paid, non-overlapping bookings (one pending, one approved with generated tasks); one staff member with a Staff Shift Table entry covering a test date/time.
- **`TEST_DATABASE_URL` required:** Y, for any automated PostgreSQL read-back test.
- **External dependencies:** none beyond PostgreSQL; Live Care refresh is same-repo SSE, no external provider.
- **Cleanup/reset method:** delete test bookings/tasks via the Undo endpoint or direct SQL against the fixture rows; do not reuse a booking whose tasks were manually edited across test runs (dedupe will skip regeneration).

---

## 9. Quality Checks Run

| Check                          | Run?    | Result                                                                                                                                                                                                                           |
| ------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint                           | Y       | Pass (`ci:quality`)                                                                                                                                                                                                              |
| Prettier check                 | Y       | Pass (`ci:quality`)                                                                                                                                                                                                              |
| Type check / Build             | Y       | Pass (`ci:backend`)                                                                                                                                                                                                              |
| `git diff --check`             | Y       | Pass: no output, no whitespace/patch issues found                                                                                                                                                                                |
| Related unit/integration tests | Partial | Backend unit suite passes; Frontend suite fails one pre-existing-assumption test (see §10); TC-UNIT-01/02/03/08 written and passing (mock-only, no DB); TC-UNIT-04/05/06/07 (DB-touching repository/route tests) not yet written |

- `git diff --check` was run and returned no output: no whitespace/patch issues.

---

## 10. Known Issues / Residual Risks

| Item                                                                      | Severity | Status                             | Notes                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | -------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminNavbar.test.tsx` asserts staff can see "Bookings"                   | Medium   | Open                               | Contradicts intended permission split (§1); requested Alan update the expectation                                                                                                                                                                           |
| No FK from `tasks` to the booking that generated it                       | Medium   | Open, mitigation expected upstream | Grouping/dedupe/Undo-deletion rely on date-window matching; overlapping bookings for the same pet cross-contaminate. Paige (pet-parent booking) is expected to block overlapping bookings for the same pet at creation, which removes the trigger condition |
| Pending/refused bookings still resolve on Live Care                       | Low      | Open                               | `petparent.livecare.repository.ts`'s stay lookups only exclude `draft`, not non-approved; requested fix from Live Care owner(Paige)                                                                                                                         |
| `docs/task-timeline-booking-scope.md`'s backend `?bookingPetsUuid=` param | Low      | Unused, kept                       | Dead but harmless/authenticated; earlier approach superseded by client-side grouping                                                                                                                                                                        |
| TC-UNIT-04/05/06/07 not yet written                                       | Medium   | Open                               | TC-01/02/03/08 (mock-only) done and passing; the remaining 4 touch real SQL/routes and still need to be written, per §3's DB-vs-mock discussion                                                                                                             |

---

## 11. QA Handoff Summary (Copy-ready)

```text
QA handoff: Manager Booking Review, Task Timeline/Management, Staff Shift & Dashboard

- Build/commit: task_booking_test_Sue (see PR)
- Scope: Manager approve/refuse/undo of paid bookings with automatic task generation/deletion;
  Task Timeline grouped and paginated by approved booking; staff/manager permission split on all
  task-mutation routes; Staff Shift Table and Staff Management Dashboard (manager-only); pet
  status auto-derivation from approved booking dates.
- Acceptance criteria: see §1
- Environment: local dev (http://localhost:5173 / :3000), PostgreSQL (Neon or local Docker)
- Test data/accounts: one manager + one staff account; a pet with 2+ non-overlapping paid bookings
  (one pending, one approved); a staff shift entry covering a test date/time
- API/contracts: see §7; full route tables in Backend/README.md
- Dependencies: PostgreSQL only; no external provider; Live Care refresh via same-repo SSE
- Automated evidence: ci:quality ✅, ci:backend ✅, ci:frontend ❌ (AdminNavbar.test.tsx: known
  issue, not a regression in this feature's own behavior)
- Known issues/risks: see §10. Most notable: no real FK linking tasks to their generating
  booking (date-window heuristic), and the AdminNavbar test needing an update
- Requested QA focus: permission boundary (staff vs manager on task routes), Undo's task deletion
  correctness when a pet has multiple bookings, Task Timeline pagination/ordering, and the
  approve→task-generation→Live Care event chain end to end
```
