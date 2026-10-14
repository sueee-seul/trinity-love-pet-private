# Route change notice: parent profile API, facilities API, staff assignments

**Date:** 27 August 2026
**Author:** Claude (paired with Yuan)
**Status:** Announced before implementation, per the team rule that route and
middleware changes must be written down and circulated first.

> **Update, 1 September 2026.** This notice is kept as the original
> announcement; two things it describes have since changed and should not be
> taken as current behavior:
>
> - Section 4's "database or fixture" gate (`withProfileDatabase()`,
>   `repositories/profile.database.ts`) is gone. The parent profile and
>   facility repositories now use `withDatabaseConnection()`, the same
>   fail-closed helper the Staff API uses: an unavailable database throws
>   `DatabaseUnavailableError` (HTTP 503), never a fixture response. The
>   `pets`/`pet_medication` columns this API needs are part of the canonical
>   schema and a small migration
>   (`Backend/src/data/migrations/20260901_parent_profile_and_facility_schema.sql`),
>   not runtime DDL; the identity/demo-account seeding this section
>   references moved to an explicit, hand-run script
>   (`Backend/src/data/parent_profile_demo_seed.sql`) instead of running on
>   first request.
> - `PUT /api/admin/staff/:id/assignments` (row 4 of section 2, and item 4 of
>   section 5) was removed rather than shipped. The in-memory
>   `assigneeByPetId` map it wrote to doesn't exist either. Pet-to-staff
>   assignment is the dated-shift, PostgreSQL-backed
>   `/api/admin/pets/:petId/assignments` API instead.
>
> Section 5 item 1 (no authentication on these routes) is still accurate.

Read the two tables. If a route below collides with something you are building,
say so before this is merged.

---

## 1. Middleware

**No middleware is added, removed, renamed or reordered.**

`requireAuth`, `requirePetParent`, `requireEmployee`, `requireTrustedOrigin`,
`errorHandler`, the CORS configuration and the `express.json()` /
`express.urlencoded()` chain in `server.ts` are all untouched.

The new routes follow the pattern the existing `/api/admin/staff` routes already
use: the caller states who it is through a query parameter or a path id, and
there is no session check. That is a real gap, it is the same gap staff routes
already have, and closing it belongs to the JWT work, not to a profile screen.
It is called out again in section 5.

---

## 2. Routes being added

Nothing existing is modified. Every line below is new.

| Method   | Path                                | Purpose                                                                |
| -------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `GET`    | `/api/parent/profile?email=`        | Owner, their pets, each pet's medications and stays                    |
| `PATCH`  | `/api/parent/profile/:ownerId`      | Owner edits their own name, phone, avatar                              |
| `POST`   | `/api/parent/profile/:ownerId/pets` | Owner adds a pet                                                       |
| `PATCH`  | `/api/parent/profile/pets/:petId`   | Owner edits a pet                                                      |
| `DELETE` | `/api/parent/profile/pets/:petId`   | Owner deletes a pet's profile; stays and feedback are kept (see below) |
| `GET`    | `/api/admin/facilities`             | List facilities                                                        |
| `GET`    | `/api/admin/facilities/:id`         | One facility                                                           |
| `PATCH`  | `/api/admin/facilities/:id`         | Manager edits facility details                                         |
| `PUT`    | `/api/admin/staff/:id/assignments`  | Manager sets which pets a staff member is responsible for              |

Two new routers are mounted in `server.ts`:

```
app.use('/api/parent/profile', parentProfileRoutes);
app.use('/api/admin/facilities', facilityRoutes);
```

`PUT /api/admin/staff/:id/assignments` is added to the existing
`staff.routes.ts` router. The `GET` on the same path is unchanged.

## 3. Routes explicitly NOT changed

- Every existing `/api/auth/*` route
- Every existing `/api/feedback/*` and `/api/admin/feedback/*` route
- `/api/admin/pets/*`: untouched. Pet-to-staff assignment already goes through
  `PATCH /api/admin/pets/:id`; the new `PUT` above is a manager-side convenience
  that writes to the same in-memory assignment map, not a replacement.
- `/api/admin/staff/*`: all existing methods and paths unchanged.
- `/api/health` and `/`

## 4. Database

**No schema migration is written and no table is altered by this change.**

Everything the parent profile API reads and writes already exists:

- `users`, `pet_owners`: owner identity
- `pets`: including `colour`, `desexed`, `vet_name`, `vet_phone`,
  `emergency_contact`, which `repositories/profile.database.ts` already adds
  idempotently
- `pet_medications`: already created by the same bootstrap
- `bookings`, `booking_pets`: stays
- `facilities`: already in `First_version_schema.sql`

New repositories go through `withProfileDatabase()`, which is the existing
"database or fixture" gate. When PostgreSQL is unreachable the API answers from
an in-memory fixture instead of failing, exactly like the staff profile API.

## 5. Known gaps this change does NOT close

State these out loud so nobody assumes otherwise:

1. **No authentication on the new routes.** Anyone who can reach the API can
   read or edit any parent profile by guessing an email or an id. Same as the
   existing staff routes. Blocked on the JWT work.
2. **The owner id is the `users.uuid`**, but the front end also still knows a
   parent as `u4` in the login fixtures. The API accepts either.
3. **Stay writes are read-only.** A parent cannot create or cancel a stay
   through this API. Booking already has its own track.
4. **`PUT /assignments` writes to memory, not `employee_assignments`.** The
   roster table keys on real employee UUIDs; the pet list still uses `u2`-style
   ids. Merging those two identity systems is a data migration and is out of
   scope here. Assignments reset when the API restarts. This is the same
   behaviour `pet.service.ts` already has.

## 6. How to test

See the "Parent profile API" section added to `README.md`. No installation or
service-start command in that file was changed.

## Deleting a pet keeps its history (2026-10-01)

Apply `Backend/src/data/migrations/20261001_keep_stays_when_a_pet_is_deleted.sql` before running
this version. The owner approved its three changes: `booking_pets.pet_name` (filled for existing
rows), and `booking_pets.pet_uuid` and `feedback.pet_uuid` becoming nullable with
`ON DELETE SET NULL`.

- `DELETE /api/parent/profile/pets/:petId` deletes the pet's profile, its medications and care
  tasks (cascade), and its stored photo. Past stays, payments and feedback stay on record, because
  sales records are kept for seven years (Tax Administration Act 1994 s 22).
- It answers `409 PET_HAS_OPEN_STAY` while the pet has a stay that is coming up or under way, or
  whose card guarantee is not settled (`pending`, `authorized` or `failed`). The check and the delete
  are one SQL statement.
- After the delete, the parent's bookings and stays, the staff booking list and staff feedback
  still show the stay or feedback. The pet id is `null`, the name comes from
  `booking_pets.pet_name`, and feedback shows "Deleted pet".
- The pet page warns before deleting: the profile, photo, medicines and care notes cannot be
  recovered; past stays, payments and feedback stay on record.
