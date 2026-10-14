# Frontend

The Frontend is a React 19, TypeScript, Vite, and Tailwind CSS v4 application. It serves two
account portals (the pet-parent experience and the Admin website for employees) plus a public
Google Maps review surface. Routes are declared in [`src/App.tsx`](src/App.tsx).

The root route selects the first enabled website from the authenticated user's account flags. The
Frontend uses `is_employee` and `is_pet_owner` for website access and route-level authorization.

## Run it

From the repository root on macOS or Windows PowerShell:

```text
npm ci --prefix Frontend
npm run dev --prefix Frontend
```

Vite serves the app at `http://localhost:5173`. The Frontend calls the Backend at
`http://localhost:3000` by default. A deployed build must name its Backend origin (no `/api`, no
trailing slash) in `Frontend/.env.production` or `Frontend/.env.local`, as `Frontend/.env.example`
shows:

```text
VITE_API_ORIGIN=https://api.example.co.nz
```

An `https` origin also switches live dictation to `wss`. The Backend must list the site's own origin
in `CORS_ORIGIN`.

Build and preview the production bundle with:

```text
npm run build --prefix Frontend
npm run preview --prefix Frontend
```

## Dependencies

The Frontend uses `chart.js` and `react-chartjs-2` for the manager KPI dashboard charts.

## Routes

| Route                       | Screen                                                                                                                                                        | Current backing                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/`                         | Redirects to `/parent`.                                                                                                                                       | React Router redirect                                                                        |
| `/login`                    | Google OAuth or email/password login.                                                                                                                         | Backend auth API                                                                             |
| `/signup`                   | Two-step pet-parent signup or Google profile completion.                                                                                                      | Backend/PostgreSQL                                                                           |
| `/maps/place/PetHouse/`     | Public PetHouse review page; reviewer sign-in is required before opening the write-review modal.                                                              | Fixture place/review content plus reviewer session API                                       |
| `/parent`                   | Pet-parent dashboard shell.                                                                                                                                   | UI placeholder                                                                               |
| `/parent/feedback`          | Ratings, category, text, optional voice, and feedback submission.                                                                                             | Backend/PostgreSQL; fixed demo pet context                                                   |
| `/parent/booking`           | AI booking concierge inside the portal (saved pets can be reused at checkout).                                                                                | `/api/concierge`; see [docs/ai-booking-concierge.md](../docs/ai-booking-concierge.md)        |
| `/parent/live-care`         | Care progress, timeline, photos, lightbox, and carousel.                                                                                                      | Static/default data; no live data API                                                        |
| `/parent/profile`           | Owner profile and pet list editing.                                                                                                                           | Browser localStorage                                                                         |
| `/parent/pets/:id`          | Pet details, medications, stays, and recent care.                                                                                                             | Browser localStorage                                                                         |
| `/parent/stays`             | Requested, active/upcoming, and past stays.                                                                                                                   | Browser localStorage                                                                         |
| `/admin`                    | Admin website dashboard shell.                                                                                                                                | UI placeholder                                                                               |
| `/admin/pets`               | Searchable pet roster.                                                                                                                                        | PostgreSQL pet/owner/booking reads                                                           |
| `/admin/pets/:id`           | Pet detail, basic profile edit, dated/shift assignment editor, Task Timeline grouped by booking, and remaining placeholder care panels.                       | PostgreSQL profile, `employee_assignments`, and task API                                     |
| `/admin/feedback`           | Employee feedback workspace with separate Internal Feedback and Google Reviews source tabs. Each source uses its own projection, filters, and review actions. | PostgreSQL feedback snapshot or Google Review read path plus the relevant Zustand projection |
| `/admin/feedback/:id`       | Internal Feedback detail, AI insights, ratings, answer, audio, Issue progress, or Suggestion workflow.                                                        | PostgreSQL read path; replies remain app-owned mock responses                                |
| `/admin/google-reviews/:id` | Manager Google Review detail with original review text/photos, a manually selected type, and a manual reply editor.                                           | Google Review projection plus manual type and reply APIs                                     |
| `/admin/operation`          | Manager-only operation dashboard with Google Review metrics, Average Rating, review count, Team Management, and KPI charts.                                   | Google Review dashboard API, admin team pages, and KPI dashboard API                         |
| `/admin/notifications`      | Standalone notification page removed; the legacy path redirects to `/admin`. Managers use the bell dropdown to open Google Review detail directly.            | PostgreSQL manager notification API plus `AdminNotificationPopover`                          |
| `/admin/profile`            | Manager profile/team management or staff profile/assigned pets.                                                                                               | PostgreSQL only; unavailable database returns an error                                       |
| `/admin/bookings`           | Booking / Approve / Refuse tabs; approve, refuse, and undo a paid booking. Manager-only.                                                                      | PostgreSQL `booking_pets` read/write; approve also generates tasks, undo deletes them        |
| `/admin/tasks`              | Staff self-service "My Tasks": the logged-in staff member's own tasks by day/week/month.                                                                      | PostgreSQL task read/write via `taskRouter`                                                  |
| `/admin/shifts`             | Staff Shift Table. Manager-only.                                                                                                                              | PostgreSQL `employees.shift_details`                                                         |
| `/admin/staff-dashboard`    | Team overview and per-staff detail. Manager-only.                                                                                                             | PostgreSQL task/shift aggregation                                                            |

## Feature layout

| Folder                             | Responsibility                                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/shared/auth/`                 | Shared login, signup, Google configuration, auth API, session state, and account identity routing.                                                                                                                                                                       |
| `src/features/maps-review/`        | Public PetHouse review surface, reviewer-only Google sign-in, cookie hydration, and review submission.                                                                                                                                                                   |
| `src/features/admin/`              | Admin website, pet roster/detail, separate Internal Feedback and Google Review management/detail surfaces, notifications, profile, staff directory, operation dashboard, KPI charts, booking review, Task Timeline/My Tasks, staff dashboard, and the Staff Shift Table. |
| `src/features/pet-parent/`         | Parent portal, navigation, booking UI, feedback intake, live care, and profile screens.                                                                                                                                                                                  |
| `src/features/pet-parent/profile/` | Local profile state, owner/pet/medication forms, stays, care logs, and mock conversation data.                                                                                                                                                                           |
| `src/shared/components/ui/`        | Shared controls, feedback rating components, loading states, and spinners.                                                                                                                                                                                               |
| `src/shared/dictation/`            | `useDictation` and `DictationButton`: microphone capture, live transcription through the Backend `/api/speech/stream` WebSocket (Amazon Transcribe), and the optional MediaRecorder copy for feedback uploads.                                                           |

## Data and integration boundaries

### Parent profile and stays

`src/features/pet-parent/profile/repository.ts` stores the parent demo state under
`wagstay-parent-profile-v2` in browser localStorage. Owner details, pet details, medications, stays,
care logs, and the mock conversation are browser-local; editing them does not call the Backend.

### Booking and live care

Booking in the portal is the AI concierge (`src/features/concierge/`). The old six-step form, which
took card numbers, was removed along with its Backend endpoint.
`LiveCareDashboardPage` renders default care entries and photos; its timer changes the displayed
“last updated” label, not the underlying data.

### Task Timeline and booking review

Approving a booking (`Frontend/src/features/admin/pages/AdminBookingsPage.tsx`) generates that pet's
tasks server-side; Undo reverts the decision and deletes them. The Pet Profile's Task Timeline
(`components/TaskTimeline.tsx`) groups the pet's tasks into one section per approved booking. This is done
client-side against `useBookingStore`'s booking dates, since `tasks` has no booking reference of its
own. See `docs/task-timeline-booking-scope.md` for the mechanism and its limits.

Task mutation routes are split by role: any employee can read tasks and update their own ("My
Tasks"); creating, deleting, and the Task Timeline's assign/set-time action require a manager. See
`Backend/README.md`'s Task routes table.

### Feedback

The parent feedback form collects five 1 to 5 ratings, an Issue/Suggestion/Praise category, and a
non-empty answer. Optional voice input uses `useDictation`: it streams the microphone to the Backend
`/api/speech/stream` WebSocket, appends the final transcript to the answer, and keeps the recorded
audio Blob for the Backend submission.

The submit request goes to `/api/feedback` as multipart form data. The Backend derives the owner from
the signed session and checks that the selected fixed pet belongs to that owner. The current page
does not select a pet from the local profile state.

The admin feedback page has separate Internal Feedback and Google Reviews source tabs. The Internal
Feedback tab hydrates its complete snapshot into the feedback store; the Google Reviews tab uses the
Google Review projection and does not reuse the Internal Feedback row projection. “Load More Feedback”
only reveals records already loaded; it is presentation pagination, not another API page request.
The shared `LoadingState`, `LoadingSpinner`, and feedback skeletons describe loading without adding
route-level `React.lazy` or `Suspense`.

### Maps reviews

The Maps review page is public and remains outside `AccountRoute`. Its reviewer identity is owned by
`src/features/maps-review/` and is separate from the parent/employee `authStore` and `/api/auth/*`
endpoints. The browser keeps no Google ID token or reviewer session token; it hydrates the sanitized
reviewer profile from `/api/review-auth/me` using the HttpOnly `maps_reviewer_session` cookie. When an
unauthenticated reviewer clicks `Write a review`, the same button requests the Maps-specific Google
authorization-code popup; the provider callback completes login without navigating to another
application route.

While the reviewer data contract is being finalized, `reviewerAuthStore` and
`mapsReviewStore` hold the current reviewer identity and newly submitted place reviews in frontend
state. The modal submits multipart data to `/api/google-reviews`, and the page reloads the persisted
Google review page after a successful submission or deletion. Photos selected in the write-review
modal are uploaded through that route and persisted in the app-owned Google review media log. The
public response contains review/location fields only; it does not expose AI summary, type, or
confidence.

### Manager Google Review workflow

Admin Google Review cards and detail show the original `reviewText` when present, along with photos
and rating. Managers select the review type, assign follow-up, and compose replies manually. The
Google Review UI does not request per-review AI analysis, generated reply drafts, or an Operation
summary bundle; the Operation card keeps Average Rating and review count from the regular dashboard
response. Internal Feedback insights remain a separate feature and are unaffected.

## Checks

```text
npm run test --prefix Frontend -- --run
npm run build --prefix Frontend
npm run lint --prefix Frontend
npx prettier --check .
```

The repository root README contains the full multi-service setup and the Windows PowerShell
equivalents. The detailed feedback contract is in [`docs/feedback-system.md`](../docs/feedback-system.md).
