# Live care and the staff task pages

**Audience:** engineers working on Live care (`/parent/live-care`) or the staff and manager task pages.<br>
**Status:** describes the rules as implemented on `rebuild_petparents_pages`.

Live care shows a pet parent the same tasks staff work on. Both sides read the `tasks` table, so they must read each task the same way.

## 1. Task times

`scheduled_at` holds Auckland wall-clock time in the UTC fields. A task at `00:00` has a date but no time yet.

| Side        | A task at 00:00                                                   | A task with a time |
| ----------- | ----------------------------------------------------------------- | ------------------ |
| Staff pages | "Time not set"                                                    | its time           |
| Live care   | "Time to be set" / "时间待定", listed last, never shown as "Next" | its time           |

Tasks made from an approved booking (`task.fromBooking.mapping.ts`) now get a real time:

| Task                      | Time                      |
| ------------------------- | ------------------------- |
| Feeding (morning)         | 08:00                     |
| Medication Administration | 08:30                     |
| Outdoor Walk              | 10:30                     |
| Extra Playtime            | 16:00                     |
| Feeding (evening)         | 19:00                     |
| Grooming                  | none, the manager sets it |

Why these times: vets advise two meals 8 to 12 hours apart, with breakfast at 6 to 8 AM and dinner at 5 to 7 PM. The facility's day runs late, so the meals sit at the late end of that range, 11 hours apart. Medication follows breakfast so it goes down with food. Each time is at least 30 minutes from the next, the gap one staff member needs between two tasks (`assertStaffFree`).

Tasks stored at 00:00 before this change keep "time not set" on both sides until a manager sets them.

## 2. Task status

| `tasks.status` | Live care shows      |
| -------------- | -------------------- |
| `pending`      | Upcoming / 待完成    |
| `in_progress`  | In progress / 进行中 |
| `completed`    | Completed / 已完成   |
| `cancelled`    | not shown            |

Overdue is a staff-only signal. Live care never shows it; an overdue task stays "Upcoming".

## 3. The carer

The carer comes from the roster (`employee_assignments`). With nobody rostered, the API sends `sitterName: null` and `location: null`, and the page says "Cared for by the Wagstay team" / "由 Wagstay 团队照顾" with no place line.

## 4. Day stats

A stat tile with nothing planned for the day ("0/0") is left out. "Photos shared" is always shown.

## 5. Live updates

Every write that changes what Live care shows calls `publishTaskEvent(petId)` (`livecare.events.ts`). An open Live care page gets a `task-updated` event over SSE and fetches the day again.

| Staff or manager action                        | Where it publishes                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Create, edit, start, complete or delete a task | `task.service.core.ts`                                                                                             |
| Upload or delete a task photo                  | `task.photo.service.ts`                                                                                            |
| Approve a stay (care plan made)                | `task.fromBooking.service.ts`                                                                                      |
| Care plan deleted (undo, cancel)               | `task.fromBooking.service.ts`, except inside a transaction, which publishes after commit through the new care plan |
| Roster a carer onto the pet, or take one off   | `pet.assignment.service.ts`                                                                                        |

## 6. Known limitation

The stay window checks (`scheduled_at BETWEEN drop_off_time AND pick_up_time`) compare wall-clock time with a real instant, so the window is shifted by the Auckland offset. Both sides use the same check, so they agree with each other. Real stays (drop-off 7:30 to 10:00, pick-up 15:00 to 17:00) are not affected, but with a pick-up before about 8 AM the 19:00 meal on the last night would fall outside the window.
