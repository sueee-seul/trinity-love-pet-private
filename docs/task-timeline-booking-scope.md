# Task Timeline grouped by booking

**Audience:** engineers working on the manager-side admin app. Not for Live Care: see the note at the bottom.<br>
**Status:** describes the Task Timeline (`/admin/pets/:id`) as currently implemented.

## 1. What it does

A pet's Task Timeline no longer shows one mixed list of tasks. It shows one section per approved booking (ordered by check-in date), each with its own "+ Add task" that pre-fills that booking's date. Tasks that don't fall inside any approved booking's dates land in a trailing "Other tasks" section.

## 2. How grouping actually works (client-side, no schema change)

`tasks` has no `booking_pets_uuid` / `booking_id` column, only `pet_uuid`. `Frontend/src/features/admin/components/TaskTimeline.tsx` still fetches the pet's full task list the old way:

```
GET /api/pets/:petId/tasks?range=all|today|week|month
```

Grouping happens after the fetch, in `groupTasksByBooking` ([`TaskTimeline.tsx`](../Frontend/src/features/admin/components/TaskTimeline.tsx)):

1. Pulls this pet's bookings from `useBookingStore` (the same store `AdminBookingsPage` uses), filtered to `manager_review_status === 'approved'` and sorted by `check_in`.
2. For each booking, matches tasks whose `due_datetime`'s date falls between that booking's `check_in` and `check_out` (a plain string comparison on the already-fetched task list, with no separate request per booking).
3. Whatever's left over becomes the "Other tasks" section.

`?bookingPetsUuid=<booking_pets_uuid>` in the URL (set by `BookingCard.tsx`'s "View Profile" link) is **only used to scroll to and highlight that section**. It does not change what gets fetched.

## 3. The backend query param still exists, but nothing calls it

`findTasksForBookingPet(bookingPetsUuid)` ([`task.read.repository.ts`](../Backend/src/repositories/task.read.repository.ts)) and the `?bookingPetsUuid=` handling in `getPetTasks` ([`task.service.base.ts`](../Backend/src/services/task.service.base.ts), [`task.read.controller.ts`](../Backend/src/controllers/task.read.controller.ts)) were an earlier approach: fetch just one booking's tasks server-side, bounding `scheduled_at` to that booking's `drop_off_time`..`pick_up_time`. The Frontend was changed to group client-side instead, so no request currently sends `?bookingPetsUuid=`. Left in place since it's harmless and correctly authenticated; remove if confirmed unused when this is next touched.

**Not for Live Care.** This endpoint is under `taskRouter`, which now requires `requireEmployee` (manager or staff). A pet parent has no session that satisfies that, and the response includes staff/owner names Live Care shouldn't see anyway. Live Care has its own authenticated endpoint: `GET /api/petparent/live-care/:bookingPetId?date=...` (see `Backend/src/repositories/petparent.livecare.repository.ts`).

## 4. Auth (added since this doc was first written)

`taskRouter` ([`Backend/src/modules/tasks/task.routes.ts`](../Backend/src/modules/tasks/task.routes.ts)) now requires `requireEmployee` on every route. On top of that, `requireManager` gates: creating a task (`POST /pets/:petId/tasks`), deleting a task, `POST /tasks/from-booking/:bookingId`, deleting a task photo, and the Task Timeline's edit path `PATCH /pets/:petId/tasks/:taskId` (a manager-only alias of `updateTask`). Staff's own "My Tasks" page keeps using the plain `PATCH /tasks/:taskId`, which stays employee-level so staff can update their own tasks' status/issue.

## 5. Known limitations

- **No FK from `tasks` back to the booking that generated it.** Grouping, task-generation dedup, and Undo's deletion all identify "this booking's tasks" by date window, not a real reference. Two of the same pet's bookings with overlapping stay dates would mix.
- **Manually-created tasks fall through into whichever section their date happens to match**, or "Other tasks" if none match. There's no way to pin a manual task to a specific booking beyond its date.

```

```
