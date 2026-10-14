# 🐾 Trinity

![React](https://img.shields.io/badge/frontend-React-61DAFB.svg)
![Node.js](https://img.shields.io/badge/backend-Express-339933.svg)
![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-4169E1.svg)

Trinity is a local full-stack prototype for pet-care operations. It contains a
pet-parent portal, an Admin website for employees, an Express API, and a PostgreSQL data layer. Voice
input is live dictation: the Backend streams microphone audio over a WebSocket to a local Whisper
speech service (`SpeechService/`), so no cloud account is needed.

The most complete end-to-end path is parent feedback: an authenticated pet parent submits ratings,
text, and optional audio; the Backend validates ownership, asks the configured LLM provider for a
structured summary, stores the feedback and its initial timeline event in PostgreSQL, and exposes it
to the authenticated staff feedback workflow. Other screens are intentionally at different stages:
some are PostgreSQL-backed, some use browser localStorage or in-memory state, and some are UI
placeholders. This README keeps those boundaries explicit.

> [!WARNING]
> **Before deploying this branch, apply its eight October 2026 migrations** in this order from
> `Backend/src/data/migrations/`: `20261007_booking_charges_ledger.sql`,
> `20261007_booking_terms_in_stay_changes.sql`, `20261007_daily_summaries.sql`,
> `20261007_medication_administrations.sql`, `20261008_escalations_and_care_metrics.sql`,
> `20261008_notification_preferences.sql`, `20261009_stay_memory_notes.sql` and
> `20261009_account_contacts.sql`. The shared development database already has all eight. Without them in-stay changes, the daily update, the stay report
> and emergency contacts fail, and checkout answers `TERMS_VERSION_CHANGED`.
>
> **部署这个分支之前，必须按上面的顺序执行 8 个 2026 年 10 月的数据库迁移。** 共用的开发库已经全部执行过。缺少这些迁移时，住宿期间改单、每日动态、住宿报告和紧急联系人都会报错，结账会返回 `TERMS_VERSION_CHANGED`。

## What this branch changes

This branch adds the following on top of `main`. The rows in [Current status](#current-status) give the details.

| Area                       | What changes for the reader                                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Booking assistant          | The chat runs on rules, GPT OSS or Claude, suggests two or three combos and fills a floating stay panel. A signed-in parent can say "same as last time".                                                                                                                  |
| One-step booking           | After "book it for me", a booking card shows the stay, dates, pets, total and card form. A signed-in parent confirms with one press or by typing "confirm" or "确认". One sentence beside the button covers both agreements: the booking terms and emergency vet consent. |
| Booking without signing in | A first-time guest gives an email and a password on the details step. Send makes the account, the pet profiles and the booking together, then signs the guest in. The page no longer sends an email code.                                                                 |
| Say it once                | On the details step the guest speaks or types about themselves and their pets, and the empty fields fill in (`POST /api/concierge/details/read`). After the booking, each new pet's profile is filled from the same notes.                                                |
| Changes during a stay      | Extend a stay, add an add-on for a day or move a check-in or check-out time, from My Stays or the parent chat.                                                                                                                                                            |
| Daily updates              | An evening update per pet, a settled-in note and a stay report, with photos and videos, by bell and email.                                                                                                                                                                |
| Parent account             | New pages for emergency contacts (`?tab=contacts`) and update settings (`?tab=updates`).                                                                                                                                                                                  |
| Look and words             | One visual system for staff and parent pages, new illustrations and an example clip, a language switch in the accessibility toolbar, and "check-in" and "check-out" instead of "drop-off" and "pick-up".                                                                  |

## Current status

| Area                                   | Current state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Source of truth                                                                                                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication                         | Password login, Google login/progressive signup, signed HttpOnly cookie, session hydration, password recovery, and manager-created employee activation are implemented through PostgreSQL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `Backend/src/services/auth.service.ts`, `Backend/src/services/auth.session.ts`                                                                                                                                                                                  |
| Parent feedback                        | Ratings, category, text, optional voice input, structured AI insights, ownership checks, and PostgreSQL persistence are implemented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `Frontend/src/features/pet-parent/pages/PetParentFeedbackPage.tsx`, `Backend/src/services/parent.feedback.service.ts`                                                                                                                                           |
| Staff feedback                         | PostgreSQL list/detail reads, filters, sorting, read state, assignment, Issue progress, and Suggestion workflow are implemented. Staff reply and Suggestion notification remain mock-backed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `Backend/src/services/admin.feedback.read.service.ts`, `Backend/src/services/admin.feedback.workflow.service.ts`                                                                                                                                                |
| Google Reviews                         | Public review creation, simulator ingestion, and PostgreSQL persistence are implemented. Admins see original review text, manually set a type, assign follow-up, and compose/send replies. Review creation also persists manager notifications; no per-review AI analysis or generated reply drafts run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `Backend/src/repositories/review.repository.ts`, `Backend/src/repositories/google.review.notification.repository.ts`, `Backend/src/services/admin.google.review.service.ts`                                                                                     |
| Manager KPI dashboard                  | The protected operation dashboard requests 13 task KPI chart series for `today`, `7d`, `30d`, or `90d` ranges from the live PostgreSQL-backed API. Its bar-chart dataset contract is type-checked during the Frontend build; mock data remains the explicit fallback when the API response is unavailable or incomplete.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `Frontend/src/features/admin/api/kpiApi.ts`, `Frontend/src/features/admin/components/operation/KpiBarChart.tsx`, `Backend/src/services/kpi.service.ts`                                                                                                          |
| KPI daily summary                      | Each morning a job saves yesterday's KPI figures and a one-call Gemini takeaway to a separate MongoDB; the KPI dashboard card shows the saved summary without calling the LLM. See [docs/kpi-reports-and-alerts.md](docs/kpi-reports-and-alerts.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `Backend/src/services/kpi.daily-summary.service.ts`, `Frontend/src/features/admin/components/operation/KpiDailySummaryCard.tsx`                                                                                                                                 |
| KPI rule alerts                        | Every 30 minutes a job checks four code-only rules (overdue rate, staff overdue, critical task overdue, time not set) and saves new or worsened alerts to the KPI MongoDB. Managers see them at the top of the existing notification bell, with read state per manager. See [docs/kpi-reports-and-alerts.md](docs/kpi-reports-and-alerts.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `Backend/src/services/kpi.alerts.rules.ts`, `Frontend/src/features/admin/components/KpiAlertSection.tsx`                                                                                                                                                        |
| KPI weekly and monthly reports         | From 09:00 on Mondays and the 1st, a job saves last week's and last month's change report (trend warnings, key numbers, biggest changes, staff, and LLM-grouped delay reasons) to the KPI MongoDB, announces it in the bell and emails it (console mode by default). See [docs/kpi-reports-and-alerts.md](docs/kpi-reports-and-alerts.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `Backend/src/services/kpi.report.service.ts`, `Backend/src/services/kpi.report.email.render.ts`                                                                                                                                                                 |
| Staff and manager profiles             | Managers create initial employee accounts with generated temporary passwords, while staff update their own name, phone, and avatar. Profile images upload directly to public Neon Object Storage and only the stable URL is stored in PostgreSQL; profile image reads are lazy-loaded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `Backend/src/services/profile.media.storage.ts`, `Frontend/src/shared/api/profileMediaApi.ts`                                                                                                                                                                   |
| Pet List and basic Pet Dashboard       | Pet roster/profile fields use PostgreSQL. Check-in/out and `status` are derived from the pet's approved bookings only (see `docs/admin-bookings-api.md` §9). Dated/shift assignments use the dedicated `employee_assignments` API and are shown in the Pet Dashboard editor. Care, health, behaviour, and quick-log panels are UI placeholders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `Backend/src/repositories/pet.repository.ts`, `Backend/src/repositories/staff.assignment.repository.ts`, `Frontend/src/features/admin/components/pet/PetAssignmentEditor.tsx`                                                                                   |
| Parent profile, pet profile, and stays | Owner profile, pets, medications, and read-only stays use PostgreSQL only and fail explicitly when it is unavailable. Owner and pet images upload directly to the public synthetic `petown` bucket; PostgreSQL stores only stable URLs and all profile/pet image reads are lazy-loaded. Care logs, facilities detail, and LiveCare conversations have no endpoint yet and remain fixture-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `Backend/src/repositories/parent.profile.repository.ts`, `Frontend/src/features/pet-parent/profile/repository.ts`, `Frontend/src/shared/api/profileMediaApi.ts`                                                                                                 |
| Booking                                | Booking goes through the AI concierge at `/parent/booking` and `/book`. The guest chats, speaks or ticks a checklist; the server suggests two or three combos named from their contents, each with one sentence on why it fits, and marks one as recommended. Every room, food and add-on also has its own price in a floating stay panel, so the guest can build a stay line by line; the server prices every selection (`POST /api/concierge/price`) and the assistant never states an amount. A signed-in parent can say "same as last time" to copy the pets and services of their latest stay (dates are always asked); a guest is told once, in passing, that signing in makes this possible. "Book it for me" puts the recommended combo in the stay and opens a one-step booking card with the stay, dates, pets, total and card form. A signed-in parent confirms it with one press or by typing "confirm" or "确认"; one sentence beside the button covers both agreements (the booking terms and emergency vet consent), and nothing is booked before that. A guest signs in first, or uses the full form. On the full form a first-time guest gives an email and a password, and Send makes the account, the pet profiles and the booking together (`newAccount` on `POST /api/concierge/checkout`); an email that already has an account gets 409 `CONCIERGE_ACCOUNT_EXISTS` and is asked to sign in, and a staff email is refused. The details step can be filled by speaking or typing once (`POST /api/concierge/details/read`, six reads a minute, 503 when the model fails), and after the booking each new pet's profile is filled from the same notes. The assistant runs on rules (default, no model), GPT OSS on Bedrock Mantle, Claude on an Anthropic account, or Claude on Amazon Bedrock, and falls back to rules when the model is down. The guest then adds a card (Stripe, or a development fake) and sends the booking; its full price is held at once. Each pet is confirmed at once unless a manager checks it first (at most 24 hours); confirmed stays are charged, and cancelling refunds all but a fee that grows closer to check-in. Bookings under the older terms keep the 48-hour hold and the charge at check-in. While the pet is staying the parent can extend the stay, book an add-on for a day or move a time from My Stays or by asking the AI chat, which quotes the price and makes the change only after the parent confirms; each is priced first and charged or refunded on the saved card into the `booking_charges` ledger. The old six-step form and its `POST /api/petparent/bookings` endpoint were removed on 2026-09-29. | [docs/ai-booking-concierge.md](docs/ai-booking-concierge.md), `Frontend/src/features/concierge/`                                                                                                                                                                |
| Daily updates                          | From the parent's chosen hour (default 17:00 Auckland) the booking job writes one update per checked-in pet from the day's tasks, photos and dose record, in the parent's language, plus a settled-in note on the check-in day and a stay report on check-out day; each goes to the bell and, unless turned off, to email. Preferences live at `/api/parent/profile/notification-preferences`. A memory note per day flags two days of eating less or being less active, or a 5% weight change, to staff and in the parent's update; a 30-day signed link gives the vet a printable report. See [docs/daily-updates.md](docs/daily-updates.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `Backend/src/services/daily-summary.service.ts`, `Backend/src/services/daily-summary.compose.ts`                                                                                                                                                                |
| Changes during a stay                  | Parents extend a stay, add a priced add-on for a day, or move a check-in or check-out time from My Stays or the parent chat. Each change is priced first and then charged on the saved card, or added to the bill and paid at the desk at check-out when no card is saved. Wagstay does not collect pets, so parent pages say check-in and check-out. See [docs/in-stay-change-tools.md](docs/in-stay-change-tools.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `Backend/src/services/booking.in-stay.ts`, `Backend/src/services/conversation.stay-changes.ts`                                                                                                                                                                  |
| Live care                              | Static/default care entries render a live-care UI. The page updates its displayed elapsed label but does not fetch new care data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `Frontend/src/features/pet-parent/pages/LiveCareDashboardPage.tsx`                                                                                                                                                                                              |
| Notifications and chat                 | Manager notifications (Google Reviews, and "New booking request" on concierge checkout) use PostgreSQL rows scoped to every active manager, persist `notification.read_at`, and appear in the bell dropdown. Parent notices (request received, approved, not accepted, back in review) appear in the parent bell on wider screens only; see [docs/booking-notifications.md](docs/booking-notifications.md). The parent mobile Chat link and database chat tables are not connected to a chat route.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Backend/src/repositories/admin.google.review.notification.repository.ts`, `Backend/src/services/booking.notifications.ts`, `Frontend/src/features/pet-parent/components/PetParentNotificationPopover.tsx`                                                      |
| Booking review & task generation       | Managers approve, refuse (with a reason), or undo each pet of a request. Approving generates that pet's care tasks; once no pet waits, the confirmed pets are charged from the hold (older bookings: the 48-hour job holds the approved total). The manager who decided is recorded and shown to the parent. Staff record each confirmed pet's arrival and finish check-in, which keeps what is owed and refunds the rest (older bookings: charges the saved card once). The Task Timeline groups a pet's tasks into one section per approved booking. Task read is open to any employee; creating, deleting, and the Task Timeline's assign/set-time action require a manager.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `Backend/src/services/manager.booking.ts`, `Backend/src/services/booking.check-in.ts`, `Backend/src/services/task.fromBooking.service.ts`, `Frontend/src/features/admin/components/TaskTimeline.tsx`, `Frontend/src/features/admin/pages/AdminBookingsPage.tsx` |
| Staff shift & staff dashboard          | Managers maintain the Staff Shift Table (per-staff, per-date shift entries) and view a team overview / per-staff detail (completion rate, overdue tasks, recent issues, shift calendar) from PostgreSQL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `Backend/src/repositories/staff.shift.repository.ts`, `Backend/src/services/staff.dashboard.service.ts`, `Frontend/src/features/admin/pages/StaffDashboardPage.tsx`                                                                                             |

The Frontend does not currently add route-level authorization guards. Backend authorization is the
source of truth for protected routes: staff routes require an employee, Pet assignment reads require
an employee, and assignment mutations require a manager. Basic Pet profile routes remain outside a
complete route-level authorization boundary.

## Reader routes

| Reader goal                                 | Start here                                                                                                                                      | What this page gives you                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Run the local application                   | [Getting started](#getting-started)                                                                                                             | Dependencies, environment files, Docker, macOS commands, and Windows PowerShell commands.        |
| Understand authentication and account setup | [Local demo authentication](#local-demo-authentication) and [Admin & Pet Parent Login Guide](docs/admin-login.md)                               | Cookie-session behavior, seeded accounts, password provisioning, and current boundaries.         |
| Trace the implemented feedback path         | [Feedback System](docs/feedback-system.md)                                                                                                      | Parent input, voice, AI, PostgreSQL persistence, admin reads, and remaining mock boundaries.     |
| Understand Google Review management         | [Google Review AI removal plan](docs/google-review-ai-removal-plan.md) and [manager notifications](docs/manager-google-review-notifications.md) | Manual review types/replies, notification flow, Average Rating card, and retained configuration. |
| Run checks before a pull request            | [Testing and CI](#testing-and-ci) and [Testing Guide](docs/testing-guide.md)                                                                    | Focused package checks, PostgreSQL read-back checks, and the current E2E prerequisites.          |
| Understand the source layout                | [Architecture](#architecture) and the package READMEs                                                                                           | Runtime responsibilities and the relevant source locations.                                      |

## User-facing routes

All routes are declared in `Frontend/src/App.tsx`. The root route shows the public landing page to
guests and signed-in pet parents, and sends staff to their own website.

### Public and authentication routes

| Route                       | Behavior                                                                                                                                                                                                                                                         | Current backing                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `/`                         | Public landing page (prices, how booking works, care updates, FAQ). Staff go to `/admin`.                                                                                                                                                                        | Live `/api/concierge` prices; see [docs/landing-page.md](docs/landing-page.md)     |
| `/book`                     | Public AI booking concierge: chat, voice or checklist, suggested combos and a build-your-own stay panel, booked with a saved card. A first-time guest makes the account with the booking. Talk to a person opens a signed-in parent's chat at `/parent/ai-chat`. | `/api/concierge`; see [docs/ai-booking-concierge.md](docs/ai-booking-concierge.md) |
| `/login`                    | Email lookup followed by password login or Google login. Another page (the booking concierge) can pass the email to fill in and a same-site path to return to after sign-in.                                                                                     | Backend auth API; Google requires `GOOGLE_CLIENT_ID`                               |
| `/signup`                   | Two-step pet-parent account and profile signup, or profile completion after Google signup.                                                                                                                                                                       | PostgreSQL through the Backend                                                     |
| `/forgot-password`          | Requests a password reset link without revealing whether an email is registered.                                                                                                                                                                                 | Backend auth API                                                                   |
| `/reset-password?token=...` | Reuses the Set your password form to set a new password, then returns to Login.                                                                                                                                                                                  | Signed reset token; no session is created                                          |
| `/maps/place/PetHouse/`     | Public PetHouse Google-shaped review page; reviewer sign-in is required before writing a review.                                                                                                                                                                 | PostgreSQL review/location projection plus reviewer session API                    |

### Pet-parent routes

| Route               | Behavior                                                                                                                                                                                                                                          | Current backing                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/parent`           | Dashboard shell with a “Book a Walk” placeholder.                                                                                                                                                                                                 | UI only                                                                                                                              |
| `/parent/feedback`  | Five ratings, parent-selected Issue/Suggestion/Praise category, free text, optional voice input, and feedback submission. The current page uses one fixed demo pet UUID and has no pet selector.                                                  | PostgreSQL for a successful submission; configured LLM provider required for AI analysis; local audio storage when audio is attached |
| `/parent/booking`   | AI booking concierge inside the portal: saved pets can be reused at checkout, and "same as last time" copies the pets and services of the parent's latest stay.                                                                                   | `/api/concierge`; see [docs/ai-booking-concierge.md](docs/ai-booking-concierge.md)                                                   |
| `/parent/live-care` | Care summary, progress, timeline entries, photos, lightbox, and photo carousel.                                                                                                                                                                   | Static/default data; no live data API                                                                                                |
| `/parent/profile`   | Edit owner details, and create/open/delete pets. Emergency contacts (`?tab=contacts`) and update settings (`?tab=updates`) have their own pages. Deleting a pet keeps its past stays, payments and feedback, and is refused while a stay is open. | PostgreSQL profile API; images use direct upload to public synthetic `petown` storage                                                |
| `/parent/pets/:id`  | Edit pet details and medications, view stays and recent care.                                                                                                                                                                                     | PostgreSQL profile API; pet images are lazy-loaded                                                                                   |
| `/parent/stays`     | My Stays: requested, upcoming and past stays, what the saved card is doing, and withdraw a request, cancel, or change dates once (the cost shown first).                                                                                          | PostgreSQL profile/stays projection                                                                                                  |

### Staff and manager routes

| Route                       | Behavior                                                                                                                                                           | Current backing                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `/admin`                    | Administration dashboard shell.                                                                                                                                    | UI placeholder                                                                                                 |
| `/admin/pets`               | Searchable pet roster.                                                                                                                                             | PostgreSQL pet/owner/booking reads                                                                             |
| `/admin/pets/:id`           | Pet header, check-in/out, editable basic profile, dated/shift assignment editor, Task Timeline grouped by booking, summary, and remaining placeholder care panels. | PostgreSQL profile, `employee_assignments`, and task API                                                       |
| `/admin/feedback`           | Employee feedback workspace with separate Internal Feedback and Google Reviews source tabs; each source keeps its own projection, filters, and actions.            | PostgreSQL feedback snapshot or Google Review read path; “Load More” reveals records already loaded in Zustand |
| `/admin/feedback/:id`       | Internal Feedback detail, AI summary/insights, ratings, original answer, optional audio, Issue progress, or Suggestion workflow.                                   | PostgreSQL read path; reply remains mock-backed                                                                |
| `/admin/google-reviews/:id` | Google Review detail with original text/photos, manually selected review type, and manual reply composition.                                                       | Google Review projection and manual type/reply APIs                                                            |
| `/admin/operation`          | Manager-only operation dashboard with Google Review metrics, Average Rating, Team Management, and KPI charts.                                                      | Google Review dashboard API, admin team pages, and KPI dashboard API                                           |
| `/admin/notifications`      | Standalone notification page removed; the legacy path redirects to `/admin`. Managers use the bell dropdown and direct review-detail links.                        | PostgreSQL manager notification projection and `AdminNotificationPopover`                                      |
| `/admin/profile`            | One route that renders manager profile/team management or staff profile/assigned pets based on the resolved staff role.                                            | PostgreSQL only; unavailable database returns an explicit error                                                |
| `/admin/bookings`           | Booking / Approve / Refuse / Cancelled tabs; approve, refuse, undo; the check-in desk (arrivals, one charge) and no-fee exceptions. Manager-only.                  | PostgreSQL `booking_pets` read/write; approve also generates tasks, undo deletes them                          |
| `/admin/tasks`              | Staff self-service "My Tasks": the logged-in staff member's own tasks by day/week/month.                                                                           | PostgreSQL task read/write via `taskRouter`                                                                    |
| `/admin/shifts`             | Staff Shift Table. Manager-only.                                                                                                                                   | PostgreSQL `employees.shift_details`                                                                           |
| `/admin/staff-dashboard`    | Team overview and per-staff detail. Manager-only.                                                                                                                  | PostgreSQL task/shift aggregation                                                                              |

## Architecture

The repository has two runtime components and an optional local database service:

| Component         | Responsibility                                                                                                                                                                                                                                             | Development entrypoint          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `Frontend/`       | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Zustand, and browser-side fixture/localStorage flows.                                                                                                                                           | `npm run dev --prefix Frontend` |
| `Backend/`        | Express 5 API with Router → Controller → Service → Repository boundaries, auth/session handling, feedback processing, and PostgreSQL access. It also serves the live dictation WebSocket (`/api/speech/stream`), which relays audio to the speech service. | `npm run dev --prefix Backend`  |
| `SpeechService/`  | Python service that runs Whisper (faster-whisper) locally and turns dictated speech into text. Only the Backend calls it.                                                                                                                                  | `npm run dev:speech`            |
| Docker PostgreSQL | Optional local PostgreSQL 16 database for isolated development or API tests, exposed on host port `5433`.                                                                                                                                                  | `npm run db:up`                 |

The primary feedback flow is:

```text
Parent browser
  ├─ ratings + category + text ───────────────────────────────┐
  ├─ optional dictation ─> WS /api/speech/stream (Whisper)    │
  │                          └─ transcript appended; the      │
  │                             recording is kept for upload  │
  └─ multipart POST /api/feedback ────────────────────────────┘
                                      │
                                      ├─ signed pet-parent session is checked
                                      ├─ pet ownership is derived from the session user
                                      ├─ Zod validates the payload
                                      ├─ Configured LLM provider returns summary + up to 5 insights
                                      ├─ optional raw audio is written to Backend/storage/feedback/
                                      └─ feedback + initial timeline event are inserted transactionally
                                      │
                                      ▼
Staff browser
  └─ /api/admin/feedback* ─> PostgreSQL reads and workflow mutations
                             └─ Zustand holds the Frontend projection
```

The parent voice transcript and the uploaded raw recording are separate outputs. The current parent
insert appends transcript text to `raw_answer` but leaves the nullable database `feedback.transcript`
column unset. Raw audio is local development storage; S3/object storage is not connected.

### Key technologies

| Layer         | Technologies used in the current manifests                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend      | React, React DOM, TypeScript, Vite, Tailwind CSS, React Router DOM, Zustand, Vitest, Testing Library, oxlint, Chart.js, and react-chartjs-2                                                                    |
| Backend       | Node.js, Express, TypeScript, `pg`, Zod, `jose`, `google-auth-library`, Multer, Vercel AI SDK, Anthropic SDK, Stripe, Amazon SES, and Vitest                                                                   |
| Speech        | Local Whisper (`large-v3-turbo` on an NVIDIA GPU, `small` on the CPU) through faster-whisper in `SpeechService/`; `ws` in the Backend; `shared/dictation` in the Frontend. Amazon Transcribe remains optional. |
| Local tooling | Docker Compose, ESLint, Prettier, Husky/lint-staged, Playwright, jscpd, and GitHub Actions                                                                                                                     |

The Backend uses the current LLM factory: the local endpoint uses the native Ollama-compatible
adapter, while other configured endpoints use the `@ai-sdk/openai` adapter.
`LLM_API_KEY` is used for the OpenAI-compatible route; the local native route uses the placeholder
value only as configuration compatibility. On AWS the OpenAI-compatible route is Amazon Bedrock
Mantle in Sydney (`Backend/src/config/mantle.ts`, default model `openai.gpt-oss-120b`); its
12-hour key is re-read from `Backend/.env` after a 401, so a new key needs no restart.

## Environment variables

The canonical Backend example is [`Backend/.env.example`](Backend/.env.example). Copy it to
`Backend/.env`; never commit the copied file. The normal application connection is the team's pooled
Neon URL in `POSTGRESQL_URL`. The Backend explicitly checks a repository-root `.env.local` and
`Backend/.env` before the normal dotenv lookup. Use `Backend/.env` for the setup below unless you
intentionally need a shared root override.

| Variable                                                          | Where                 | Required when                                                                 | Default / meaning                                                                                                                                                                                |
| ----------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POSTGRESQL_URL`                                                  | `Backend/.env`        | Using PostgreSQL-backed auth, feedback, pets, or profile/staff behavior.      | Pooled Neon PostgreSQL connection string. The only product runtime database variable.                                                                                                            |
| `PORT`                                                            | `Backend/.env`        | Optional.                                                                     | `3000`                                                                                                                                                                                           |
| `CORS_ORIGIN`                                                     | `Backend/.env`        | Optional for local defaults; set explicitly when the Frontend origin differs. | Use `http://localhost:5173,http://127.0.0.1:5173` for both local browser hostnames.                                                                                                              |
| `TRUST_PROXY`                                                     | `Backend/.env`        | Required behind a load balancer or reverse proxy.                             | Unset locally. `1` for one proxy hop, or a comma-separated list of proxy addresses, so rate limits see each visitor's own address.                                                               |
| `NODE_ENV`                                                        | `Backend/.env`        | Required as `production` on any deployed server.                              | `development` locally. `production` turns on the Secure cookie flag and HSTS, refuses the test card and console email, and stops serving local uploads.                                          |
| `EXPOSE_LOCAL_PASSWORD_RESET_URL`                                 | `Backend/.env`        | Local/test reset-link verification only.                                      | `true` in the local/test example; production suppresses the URL regardless of this value.                                                                                                        |
| `AUTH_SESSION_SECRET`                                             | `Backend/.env`        | Using password/Google login or protected feedback routes.                     | Replace the example value with a long random secret.                                                                                                                                             |
| `AUTH_SESSION_VERSION`                                            | `Backend/.env`        | Optional.                                                                     | `1`; changing it invalidates existing session tokens.                                                                                                                                            |
| `GOOGLE_CLIENT_ID`                                                | `Backend/.env`        | Using Google login or Google signup.                                          | No default. Password login does not use this value.                                                                                                                                              |
| `LLM_BASE_URL`                                                    | `Backend/.env`        | Optional override for the configured feedback LLM provider.                   | `http://127.0.0.1:11434/api`                                                                                                                                                                     |
| `LLM_MODEL`                                                       | `Backend/.env`        | Optional override for the configured feedback LLM model.                      | `qwen2.5-coder:14b`; the selected model must be available at the configured provider.                                                                                                            |
| `LLM_API_KEY`                                                     | `Backend/.env`        | Optional key for a configured OpenAI-compatible provider.                     | `ollama` for the local provider; use the provider key when the endpoint requires one.                                                                                                            |
| `KPI_MONGO_URI`                                                   | `Backend/.env`        | Using the KPI daily summary.                                                  | MongoDB for KPI reports, separate from `MONGO_URI`; the feature is off without it.                                                                                                               |
| `KPI_LLM_MODEL` / `KPI_LLM_API_KEY`                               | `Backend/.env`        | Using the KPI daily summary.                                                  | Gemini model name and Google AI Studio key for KPI reports only.                                                                                                                                 |
| `KPI_SUMMARY_JOB` / `KPI_ALERTS_JOB`                              | `Backend/.env`        | Optional.                                                                     | `off` keeps this server from running the KPI daily summary or rule alert job.                                                                                                                    |
| `KPI_EMAIL_MODE` / `RESEND_API_KEY` / `KPI_REPORT_TEST_RECIPIENT` | `Backend/.env`        | Sending KPI report emails.                                                    | `console` by default; `resend` needs the key, and without a verified domain the test recipient must be the Resend account's email.                                                               |
| `KPI_REPORTS_JOB`                                                 | `Backend/.env`        | Optional.                                                                     | `off` keeps this server from running the weekly and monthly report job.                                                                                                                          |
| `CONCIERGE_SIGNING_SECRET`                                        | `Backend/.env`        | Using the booking concierge.                                                  | Signs quotes, acceptances and email checks. At least 32 random characters, different from `AUTH_SESSION_SECRET`; the example value is refused.                                                   |
| `CONCIERGE_AI_PROVIDER`                                           | `Backend/.env`        | Optional.                                                                     | `rules` (default, no model), `openai` (GPT OSS on Bedrock Mantle through `LLM_*`), `anthropic` (`ANTHROPIC_API_KEY`, optional `ANTHROPIC_WORKSPACE_ID`) or `bedrock` (`CONCIERGE_BEDROCK_*`).    |
| `CONCIERGE_EMAIL_MODE`                                            | `Backend/.env`        | Sending verification codes and booking emails.                                | `ses` (`CONCIERGE_SES_*`) or `console` (development only).                                                                                                                                       |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`                    | `Backend/.env`        | Taking bookings with a card.                                                  | Both from the same Stripe mode. `CONCIERGE_PAYMENT_MODE=fake` stands in during development and is ignored in production.                                                                         |
| `CONCIERGE_TEAM_EMAIL` / `CONCIERGE_TEAM_PHONE`                   | `Backend/.env`        | Optional.                                                                     | The contact shown by "Talk to a person" and used for "send this plan to our team".                                                                                                               |
| `BOOKING_JOBS`                                                    | `Backend/.env`        | Optional.                                                                     | `off` keeps this server out of the 15-minute booking job (holds, review deadlines, reminders).                                                                                                   |
| `BEDROCK_REGION` / `BEDROCK_MODEL` / `BEDROCK_API_KEY`            | `Backend/.env`        | Rewording the daily update and other model calls outside the concierge.       | Fall back to the `CONCIERGE_BEDROCK_*` values. `..._ACCESS_KEY_ID` + `..._SECRET_ACCESS_KEY` work instead of the API key. Without any, the daily update keeps the wording built from the record. |
| `NEON_S3_BUCKET`                                                  | `Backend/.env`        | Profile, pet, review and care task photo storage.                             | `petown`; this demo bucket is public and contains synthetic data only.                                                                                                                           |
| `AWS_ENDPOINT_URL_S3`                                             | `Backend/.env`        | Profile, pet, review and care task photo storage.                             | Neon S3-compatible endpoint.                                                                                                                                                                     |
| `AWS_ACCESS_KEY_ID`                                               | `Backend/.env`        | Profile, pet, review and care task photo storage.                             | Neon Object Storage access key; never commit the value.                                                                                                                                          |
| `AWS_SECRET_ACCESS_KEY`                                           | `Backend/.env`        | Profile, pet, review and care task photo storage.                             | Neon Object Storage secret; never commit the value.                                                                                                                                              |
| `AWS_REGION`                                                      | `Backend/.env`        | Profile, pet, review and care task photo storage.                             | `us-east-2` for the configured Neon bucket.                                                                                                                                                      |
| `SPEECH_PROVIDER`                                                 | `Backend/.env`        | Optional.                                                                     | `whisper` (default, local) or `transcribe` (Amazon Transcribe).                                                                                                                                  |
| `WHISPER_SERVICE_URL`                                             | `Backend/.env`        | Optional.                                                                     | Where the speech service listens. Default `http://127.0.0.1:8765`.                                                                                                                               |
| `TRANSCRIBE_AWS_REGION`                                           | `Backend/.env`        | Only with `SPEECH_PROVIDER=transcribe`.                                       | Region that serves Amazon Transcribe, for example `ap-southeast-2`.                                                                                                                              |
| `TRANSCRIBE_AWS_ACCESS_KEY_ID`                                    | `Backend/.env`        | Only with `SPEECH_PROVIDER=transcribe`.                                       | Real AWS key with `transcribe:StartStreamTranscription`; separate from the Neon `AWS_*` keys. Never commit it.                                                                                   |
| `TRANSCRIBE_AWS_SECRET_ACCESS_KEY`                                | `Backend/.env`        | Only with `SPEECH_PROVIDER=transcribe`.                                       | Secret for the key above; never commit the value.                                                                                                                                                |
| `TRANSCRIBE_LANGUAGE_CODE`                                        | `Backend/.env`        | Optional.                                                                     | Unset: the spoken language is identified among `TRANSCRIBE_LANGUAGE_OPTIONS`. Set it to force one language.                                                                                      |
| `TRANSCRIBE_LANGUAGE_OPTIONS`                                     | `Backend/.env`        | Optional.                                                                     | `en-US,en-AU,zh-CN,ko-KR,es-US`                                                                                                                                                                  |
| `TRANSCRIBE_PREFERRED_LANGUAGE`                                   | `Backend/.env`        | Optional.                                                                     | Preferred language when identifying among the options, for example `en-US`.                                                                                                                      |
| `VITE_API_BASE_URL`                                               | `Frontend/.env.local` | Only when the API is not at the same hostname on port `3000`.                 | If unset, the Frontend infers `http(s)://<current-host>:3000/api`. Include the `/api` suffix when overriding.                                                                                    |

The following variables are test-only or optional diagnostics rather than normal application setup:

| Variable                       | Used by                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `TEST_DATABASE_URL`            | Neon PostgreSQL API integration tests and the parent-feedback persistence E2E; the test target is isolated from the product database. |
| `POSTGRES_API_TEST_REQUIRED=1` | Makes the PostgreSQL API test group fail instead of skipping when `TEST_DATABASE_URL` is missing.                                     |
| `RUN_LLM_EVALS=1`              | Enables the opt-in LLM evaluation test file.                                                                                          |
| `PLAYWRIGHT_BROWSER_PATH`      | Overrides the Playwright browser executable used by the persistence E2E test.                                                         |

Use `POSTGRESQL_URL` for the normal Neon application connection and `TEST_DATABASE_URL` only for
isolated tests. `OPENAI_API_KEY` is not read by the current Backend. `DATABASE_URL` is not supported
or read by the application.

## Getting started

### Prerequisites

- Git.
- Node.js 24 is used by CI. Vite/Vitest require a modern Node version; Node 24 is the simplest
  choice for matching CI.
- AWS credentials for Amazon Transcribe only if you want voice dictation (the `TRANSCRIBE_*`
  variables above).
- A Neon PostgreSQL database with the canonical schema and required fixtures. Docker Desktop is
  optional and is used only for an isolated local database/test database.
- A configured LLM provider with the model named by `LLM_MODEL` if you want feedback submission and
  AI insights to succeed. The default local model is `qwen2.5-coder:14b`.
- A Google OAuth client ID only if you want to use Google login.

### Install dependencies

Run these commands from the repository root on both macOS and Windows PowerShell.

```bash
npm install
npm install --prefix Backend
npm install --prefix Frontend
```

Install the speech service for voice dictation. Skip this if you do not need dictation. It needs
Python 3.10 or newer.

**macOS**

```bash
python3 -m pip install -r SpeechService/requirements.txt
```

**Windows PowerShell**

```bash
python -m pip install -r SpeechService/requirements.txt
```

Create the Backend environment file with the command for your shell:

**macOS**

```bash
cp Backend/.env.example Backend/.env
```

**Windows PowerShell**

```bash
Copy-Item Backend/.env.example Backend/.env
```

Edit `Backend/.env` and replace `AUTH_SESSION_SECRET`. Set `POSTGRESQL_URL` to the team's pooled
Neon PostgreSQL connection string. Add `GOOGLE_CLIENT_ID` for Google login. Set `LLM_BASE_URL`,
`LLM_MODEL`, and `LLM_API_KEY` only when you are not using the defaults or the configured endpoint
requires a key.

### Configure MongoDB for conversation services

The Backend uses MongoDB Atlas for the conversation chatbot. MongoDB Atlas is an external service;
the local npm commands do not start a MongoDB server.

Add `MONGO_URI` to `Backend/.env` with the database name in the URI path:

```text
MONGO_URI=mongodb+srv://<db_username>:<url_encoded_password>@<cluster-host>/<database_name>
```

Use a MongoDB Database Access user, not the MongoDB Atlas website login. URL-encode username or
password characters that have a special meaning in a connection string. Keep the real connection
string in `Backend/.env`; do not commit it or put credentials in documentation.

`npm ci --prefix Backend` installs Mongoose for the Backend's shared MongoDB connection. The
Backend keeps its existing Neon PostgreSQL pool and uses a shared Mongoose connection for
conversation services. The Backend opens that connection during server startup.

`npm run dev` and `npm run dev --prefix Backend` start the application process only. They do not
start MongoDB Atlas or a local MongoDB container. The root `npm run db:up` command starts the
optional local PostgreSQL container only. The current `/api/health` endpoint checks both PostgreSQL
and the shared MongoDB connection.

If the Frontend must call an API on another host, create `Frontend/.env.local`:

```text
VITE_API_BASE_URL=http://localhost:3000/api
```

It is not needed for the normal local setup.

### Use the Neon database

The normal application path connects directly to Neon through `POSTGRESQL_URL`; do not start Docker
for ordinary development. The Neon database must already contain the canonical schema and any
required data for the flow you want to exercise. The application uses a PostgreSQL pool and does not
automatically apply `Backend/database/neon.sql` to an arbitrary Neon database.

After setting `POSTGRESQL_URL` and `MONGO_URI`, start the Backend and verify:

```text
GET http://localhost:3000/api/health
```

The health endpoint checks both the configured PostgreSQL connection and the shared MongoDB
connection. It returns `503` when either connection check fails.

### Optional local Docker database

Docker Compose remains available for isolated local development and PostgreSQL API tests. Start
Docker Desktop and run from the repository root only when you intentionally want that local database:

```bash
npm run db:up
```

It runs PostgreSQL 16 on host port `5433` and applies the optional Docker initializer only when the
named volume is new. Point `POSTGRESQL_URL` at the local URL only for that session.

### Start the services on macOS

Use two terminals, or three with voice dictation. Keep each service running in its own terminal.

**Terminal 1: Backend**

From the repository root:

```bash
npm run dev --prefix Backend
```

The API runs at `http://localhost:3000`.

The Backend also serves live dictation at `ws://localhost:3000/api/speech/stream`. See
[Test the voice dictation feature](#test-the-voice-dictation-feature).

**Terminal 2: Frontend**

From the repository root:

```bash
npm run dev --prefix Frontend
```

Open `http://localhost:5173`. The root page redirects to `/parent`.

**Terminal 3: Speech service (only for voice dictation)**

From the repository root:

```bash
npm run dev:speech
```

Wait for `Speech service listening`. The first start downloads the Whisper model.

### Start the services on Windows PowerShell

Use two PowerShell windows, or three with voice dictation. The individual `--prefix` commands work in PowerShell; the combined
root scripts that use Unix shell syntax do not.

**Terminal 1: Backend**

From the repository root:

```bash
npm run dev --prefix Backend
```

The API runs at `http://localhost:3000`.

The Backend also serves live dictation at `ws://localhost:3000/api/speech/stream`. See
[Test the voice dictation feature](#test-the-voice-dictation-feature).

**Terminal 2: Frontend**

From the repository root:

```bash
npm run dev --prefix Frontend
```

Open `http://localhost:5173`. The root page redirects to `/parent`.

**Terminal 3: Speech service (only for voice dictation)**

From the repository root:

```bash
npm run dev:speech
```

Wait for `Speech service listening`. The first start downloads the Whisper model.

### Shell-specific shortcuts

`npm run dev` starts the Backend and Frontend together through the background-process `&` syntax
in the root `package.json`. It is a macOS/Linux/Git Bash shortcut, not a PowerShell shortcut. On
Windows, use the two terminals above.

### Verify the local services

**macOS**

```bash
curl http://localhost:3000/
curl http://localhost:3000/api/health
```

Expected results are an API status response and a database-connected health response. If PostgreSQL or MongoDB is not reachable, `/api/health` returns HTTP
`503` and the affected database-backed requests will not work.

**Windows PowerShell**

```powershell
Invoke-RestMethod http://localhost:3000/
Invoke-RestMethod http://localhost:3000/api/health
```

### Test the voice dictation feature

Dictating a pet's details fills the pet form. The Frontend dictation module
(`Frontend/src/shared/dictation/`) streams the microphone to the Backend's `/api/speech/stream`
WebSocket, the Backend cuts it into utterances and sends each one to the local Whisper speech
service, the words come back live, and the finished text is turned into form fields by the
Backend.

**1. Install the speech service once.** Run `pip install -r SpeechService/requirements.txt`. No
key or cloud account is needed. The first start downloads the Whisper model (about 1.6 GB with an
NVIDIA GPU, about 0.5 GB without).

**2. Start the speech service, Backend and Frontend.** Run `npm run dev:speech` and wait for
`Speech service listening`, then start the Backend and Frontend as described above.

**3. Open the pet form.** Sign in as a pet parent, go to `/parent/profile`, and press **+ Add
pet** under _My Pets_. Editing an existing pet opens the same form and works the same way.

**4. Describe the pet.** In the _Describe your pet instead_ panel, press the microphone button
and speak (the words appear as you say them; press it again to stop), or type the same words
into the box. Any language works; the form is filled in English. On the Chinese page the review
shows the notes in Chinese so the owner can check them.
A sentence that exercises every extracted field:

> Bobo is a 3 year old desexed male Shiba Inu, 11kg, cream coloured. Allergic to beef. Vet is Dr
> Wong, 09 555 1234.

**5. Press Read it.** The button needs at least 10 characters. A draft of the fields appears for
review.

**6. Confirm and fill the form.** When the draft contains allergies or medications, a _Please
check these carefully_ box appears and **Confirm and fill the form** stays disabled until the
acknowledgement is ticked. The example above should fill name `Bobo`, species `DOG`, breed
`Shiba Inu`, sex `male`, desexed, weight `11`, colour `cream`, allergies `beef`, vet `Dr Wong`,
and vet phone `09 555 1234`. Only fields the description actually stated are filled, so anything
left unmentioned keeps its current value. **Discard** drops the draft instead.

**7. Save.** Nothing is written to the database until Save is pressed. The draft is for review
first.

Typing the description does not use the speech service at all. Use that to tell a transcription
problem apart from an extraction problem: if typing fills the form and speaking does not,
dictation is the part to check.

When dictation fails, nothing is added to the box and the message says so. Check the
`TRANSCRIBE_*` variables, the Backend log, and that the browser was allowed to use the microphone.

## Local demo authentication

The canonical schema seeds fixture users, pets, feedback, bookings, tasks, and notification rows,
but its password hashes are placeholders. Password login therefore needs a password to be provisioned
for the account you want to use.

### Parent feedback fixture

The current parent feedback page submits for pet UUID
`00000000-0000-4000-8000-000000000501`. In the canonical schema that pet belongs to
`ava.mitchell@example.test` (owner UUID `00000000-0000-4000-8000-000000000101`). To use that
protected feedback path locally:

```text
npm run auth:provision-password --prefix Backend -- --email ava.mitchell@example.test
```

Enter a password that meets the current 8 to 32 character, number, and symbol requirements, then sign
in at `/login`. The Backend derives the owner from the session and checks ownership; it does not
trust an owner UUID sent by the browser.

The `parent@example.com` identity and the Mochi/Biscuit profile data are profile-demo fixtures
created by the localStorage flow. They are not automatically connected to the
fixed feedback pet context.

### Manager-created employee account

Managers create the initial employee account from Team Management. The Backend writes the existing
`users` and `employees` records, stores a generated temporary password in the existing
`users.password_hash` column, and returns that temporary password once so the manager can share the
initial credentials. `users.created_at` remains the database-created account timestamp; no extra
account-activation column is added.

The employee signs in with those credentials and is sent to `/first-login-password`. The employee then
chooses the permanent password, which replaces the temporary hash. Later profile changes are handled
by the employee's own profile flow, while manager-controlled employment fields remain manager-owned.

### Password recovery

The Login password step links to `/forgot-password`. The request endpoint returns the same generic
message for known and unknown emails. The local/test flow exposes a short-lived reset URL for an
existing password account only when `EXPOSE_LOCAL_PASSWORD_RESET_URL=true`; production does not expose
it because this repository does not yet have an email delivery provider.

The reset page reuses the existing Set your password form. A successful reset updates the existing
`users.password_hash`, does not create a session, and returns to `/login` with
`Password reset successfully. You can now sign in.` Signup returns to the same page with
`Account created successfully. You can now sign in.` Both notices are transient router state, not
URL parameters or browser storage.

### Staff or manager profile fixture

Staff/profile requests use the existing PostgreSQL schema and do not apply runtime DDL or seed
profile records. The database must be prepared through the team's existing database process before
the profile routes are used.

Existing staff records are read from the configured Neon database. New employee accounts are
created by a manager through the existing Team Management modal; the API does not seed demo staff
or provision passwords for existing records at request time.

## Database and persistence boundaries

### Canonical schema

[`Backend/database/neon.sql`](Backend/database/neon.sql) is the final main schema. It currently defines
32 tables across these domains:

- Users, pet owners, facilities, employees, roles, and employee-role links.
- Pets and employee assignments.
- Services, bookings, booking pets/services, terms, payment methods, payments, agreements, and
  booking care information.
- Daily routines, tasks, and feeding, potty, activity, media, wellness, and beauty logs.
- Conversations and messages.
- Feedback and feedback timeline events.
- Notifications and pet-owner notification links.

The final schema file defines tables and constraints. Required test fixtures are provisioned separately
in the isolated test database; fixture rows do not by themselves prove that every domain has a runtime
API.

### Neon, Docker, and migrations

- The normal application connection is the pooled Neon URL in `POSTGRESQL_URL`.
- `npm run db:up` is optional. It starts PostgreSQL on host port `5433` for isolated local
  development or API tests; it is not part of the default Neon workflow.
- `npm run db:down` stops the optional local container while keeping its named volume.
- `npm run db:reset` removes the optional local volume and recreates the database from the Docker
  initializer schema. This deletes local database data and is intentionally destructive.
- Files under `Backend/src/data/migrations/` are migration artifacts. The current application does
  not automatically apply them to Neon, and Docker Compose does not run them automatically either.
- The application does not apply schema or data migrations at request time. If PostgreSQL is
  unavailable, database-backed profile and staff reads/writes fail explicitly; they never use
  process-local fixture fallback.

Port `5433` applies only to the optional Docker mapping. A native PostgreSQL installation, especially
on Windows, may already occupy `5432`; use the actual host and port in whichever `POSTGRESQL_URL`
you choose.

### Runtime data sources

| Surface                    | Reads/writes                                                                                                                                                                                                          | Persistence caveat                                                                                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth and session hydration | `users`, `pet_owners`, and `employees` through the auth repository.                                                                                                                                                   | Login requires PostgreSQL. The session is a signed HttpOnly cookie with an eight-hour TTL; there is no server-side session table or revocation before expiry.                                                                                              |
| Parent feedback creation   | `pets`, `pet_owners`, `feedback`, and `feedback_timeline_events`.                                                                                                                                                     | AI generation must succeed before insert. The current fixed page context is not selected from the parent profile screen.                                                                                                                                   |
| Admin feedback list/detail | PostgreSQL feedback, joins, JSON fields, timeline, and current assignment.                                                                                                                                            | Reply/email and Suggestion notification are still in-memory/mock behavior.                                                                                                                                                                                 |
| Google Review management   | `google_business_reviews`, `external_feedback`, `google_review_media_logs`, and `feedback_timeline_events`.                                                                                                           | Human creation commits the review, `review_received` receipt event, and one notification per active manager. Managers set review type and compose replies manually. No investigation marker or AI result is produced.                                      |
| Manager notifications      | Google Reviews: `notification` joined through `feedback_timeline_events`, `external_feedback`, `google_business_reviews`, and `google_business_locations`. Booking requests: `notification` rows with `booking_uuid`. | Each active manager receives an independent row. `read_at` is persisted; unread/read background shades are a Frontend projection. There is no outbox or retry worker in this scope. Removing a staff member deletes their own notification rows.           |
| Admin pet roster/profile   | `pets`, `pet_owners`, latest `booking_pets` timing, and `employee_assignments`.                                                                                                                                       | Pet profile fields and dated/shift assignments are separate PostgreSQL contracts; no scalar process-local assignee state.                                                                                                                                  |
| Staff/profile              | `users`, `employees`, and `employee_assignments`.                                                                                                                                                                     | PostgreSQL-only; unavailable database returns an explicit error and Staff assignments use real assignment rows.                                                                                                                                            |
| Parent profile/pets/stays  | `users`, `pet_owners`, `pets`, `pet_medication`, `booking_pets`/`bookings`, and `employee_assignments` through `parent.profile.repository.ts`.                                                                        | PostgreSQL-only; unavailable database returns an explicit error, never fixture data. The Frontend also caches the last-loaded profile in `localStorage` (`wagstay-parent-profile-v2`) as a per-browser convenience, not as a substitute for a failed load. |
| Parent notifications       | `notification` rows linked to the owner through `pet_owners_notification`, written by concierge checkout and the manager's booking decisions.                                                                         | Every read and write is scoped to the signed-in owner. A failed notice is logged and never undoes the request or decision. See [docs/booking-notifications.md](docs/booking-notifications.md).                                                             |
| Live care                  | React state or fixture data.                                                                                                                                                                                          | No connected runtime API for this screen.                                                                                                                                                                                                                  |

## Backend API

The Backend listens on `http://localhost:3000` by default. All API routes below include the `/api`
prefix used by the Frontend.

### Core routes

| Method | Route         | Behavior                                                                                                                                           |
| ------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/`           | Returns the API name and running status.                                                                                                           |
| `GET`  | `/api/health` | Checks PostgreSQL and the shared MongoDB connection; returns `503` when either check fails. No session is needed, so a load balancer can probe it. |

### Authentication routes

| Method | Route                               | Behavior                                                                                                             |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/auth/google/config`           | Returns the configured Google client ID.                                                                             |
| `POST` | `/api/auth/google`                  | Verifies a Google ID token; existing users receive a local session, new users receive a progressive-signup response. |
| `POST` | `/api/auth/google/signup`           | Creates a pet-parent account after Google profile completion.                                                        |
| `GET`  | `/api/auth/me`                      | Verifies the signed cookie and reloads the current user and role from PostgreSQL. Requires authentication.           |
| `POST` | `/api/auth/logout`                  | Clears the local session cookie.                                                                                     |
| `POST` | `/api/auth/check-email`             | Checks whether an email is registered.                                                                               |
| `POST` | `/api/auth/login`                   | Verifies a PostgreSQL password hash and sets the local session cookie.                                               |
| `POST` | `/api/auth/first-login-password`    | Replaces a manager-provisioned temporary password for the authenticated employee.                                    |
| `POST` | `/api/auth/password-reset/request`  | Returns a generic reset response; local/test environments may include a short-lived reset URL.                       |
| `POST` | `/api/auth/password-reset/complete` | Verifies the signed reset token and atomically replaces the existing password hash.                                  |
| `POST` | `/api/auth/signup`                  | Creates a pet-parent account and profile in one transaction.                                                         |
| `POST` | `/api/auth/signup/validate`         | Validates signup fields and email/username conflicts.                                                                |

### Google Review routes

| Method  | Route                                                        | Behavior                                                                                                                                                         |
| ------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/google-reviews?placeSlug=PetHouse`                     | Returns the public location/review projection. It contains no AI summary, type, or confidence fields.                                                            |
| `POST`  | `/api/google-reviews`                                        | Persists an app-owned human review and optional media, creates the `review_received` event plus one notification per active manager. No investigation is queued. |
| `POST`  | `/api/reviews/simulator`                                     | Persists simulator review input; requires `X-Review-Simulator-Secret`.                                                                                           |
| `GET`   | `/api/admin/google-reviews?placeSlug=PetHouse`               | Returns the employee Google Review projection, including manually selected type and sent reply.                                                                  |
| `GET`   | `/api/admin/google-reviews/dashboard?placeSlug=PetHouse`     | Returns manager dashboard metrics, including rating/count and chart data.                                                                                        |
| `PATCH` | `/api/admin/google-reviews/:id/type`                         | Saves a manager-selected review type.                                                                                                                            |
| `POST`  | `/api/admin/google-reviews/:id/reply`                        | Saves/sends a manually composed reply for supported mock reviews.                                                                                                |
| `GET`   | `/api/admin/google-review-notifications?limit=10&cursor=...` | Manager-only cursor-paginated notifications (Google Reviews and "New booking request") with the current unread count.                                            |
| `PATCH` | `/api/admin/google-review-notifications/:id/read`            | Persists one current-manager notification's `read_at`, of either kind.                                                                                           |
| `PATCH` | `/api/admin/google-review-notifications/read-all`            | Persists `read_at` for all current-manager notifications of both kinds.                                                                                          |

### Parent notification routes

Every route requires a pet-parent session and returns only the signed-in owner's notices; the two
writes also require a trusted origin. See
[docs/booking-notifications.md](docs/booking-notifications.md).

| Method  | Route                                   | Behavior                                                                                        |
| ------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET`   | `/api/petparent/notifications?limit=20` | The owner's booking notices, newest first (`limit` 1 to 50), and the unread count.              |
| `PATCH` | `/api/petparent/notifications/:id/read` | Marks one of the owner's notices read; another owner's id answers `404 NOTIFICATION_NOT_FOUND`. |
| `PATCH` | `/api/petparent/notifications/read-all` | Marks the owner's unread notices read, up to the optional `through` time the bell last showed.  |

### Parent feedback routes

| Method | Route                             | Behavior and access                                                                                                                     |
| ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/feedback/generate-insights` | Public draft insight endpoint. Uses the configured LLM provider and does not persist feedback.                                          |
| `POST` | `/api/feedback`                   | Multipart feedback submission with optional audio. Requires a pet-parent session and a trusted local origin; audio is limited to 10 MB. |

### Admin feedback routes

Every route in this group requires an authenticated employee. Detail and mutation routes also check
the trusted origin.

| Method   | Route                                         | Behavior                                                                                                                                                                    |
| -------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/admin/feedback`                         | PostgreSQL list with search, category, read state, sort, time range, rating range, and custom dates.                                                                        |
| `GET`    | `/api/admin/feedback/assignees`               | Returns employee options for assignment.                                                                                                                                    |
| `GET`    | `/api/admin/feedback/snapshot`                | Returns the full PostgreSQL-backed detail snapshot used to hydrate the normal Frontend feedback flow.                                                                       |
| `PATCH`  | `/api/admin/feedback/assignee`                | Persists one current assignee for selected feedback rows through a transaction. Reassignment updates the current `assigned` event; it does not preserve assignment history. |
| `PATCH`  | `/api/admin/feedback/read`                    | Marks selected feedback records as read transactionally.                                                                                                                    |
| `GET`    | `/api/admin/feedback/:id`                     | Reads detail and marks an unread record as read.                                                                                                                            |
| `DELETE` | `/api/admin/feedback/:id`                     | Permanently deletes one feedback and its linked notification/timeline records in a PostgreSQL transaction.                                                                  |
| `PATCH`  | `/api/admin/feedback/:id/status`              | Advances Issue feedback through `submitted` → `review_started` → `fact_checked` → `sent`.                                                                                   |
| `PATCH`  | `/api/admin/feedback/:id/suggestion-workflow` | Advances Suggestion feedback through `captured` → `under_review` → `decision_recorded` → `closed`, with decision metadata.                                                  |
| `POST`   | `/api/admin/feedback/:id/reply`               | Logs a mock email and updates the in-memory compatibility projection; it is not a real email integration.                                                                   |

### Pet routes

These routes are mounted under `/api/admin/pets`. Basic Pet profile routes remain outside a complete
route-level authorization boundary; assignment routes enforce employee/manager access.

| Method   | Route                                           | Behavior                                                                                        |
| -------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET`    | `/api/admin/pets`                               | Lists PostgreSQL-backed pets with owner and latest booking timing.                              |
| `GET`    | `/api/admin/pets/:id`                           | Reads one pet.                                                                                  |
| `PATCH`  | `/api/admin/pets/:id`                           | Updates type, gender, age, and owner name; assignment state is not part of the profile payload. |
| `GET`    | `/api/admin/pets/:id/assignments`               | Lists dated/shift assignments for the Pet; requires an authenticated employee.                  |
| `POST`   | `/api/admin/pets/:id/assignments`               | Manager creates a dated/shift or all-day assignment in `employee_assignments`.                  |
| `DELETE` | `/api/admin/pets/:id/assignments/:assignmentId` | Manager removes one assignment, matching both Pet and assignment UUIDs.                         |

### Staff and profile routes

These routes are mounted under `/api/admin/staff` and require an authenticated employee. Account
creation, account settings, and deletion require a manager; self-profile updates use the authenticated
employee identity.

| Method   | Route                              | Behavior                                                                                                                                      |
| -------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/admin/staff/me?email=...`    | Looks up a staff profile by email.                                                                                                            |
| `GET`    | `/api/admin/staff`                 | Lists staff from the existing PostgreSQL schema.                                                                                              |
| `POST`   | `/api/admin/staff`                 | Manager creates an employee account and receives the generated temporary password once.                                                       |
| `GET`    | `/api/admin/staff/:id`             | Reads one staff member.                                                                                                                       |
| `GET`    | `/api/admin/staff/:id/assignments` | Returns assigned pets from `employee_assignments` only.                                                                                       |
| `PATCH`  | `/api/admin/staff/:id`             | Manager-style staff edit.                                                                                                                     |
| `PATCH`  | `/api/admin/staff/:id/self`        | Self-service name, phone, and avatar edit.                                                                                                    |
| `DELETE` | `/api/admin/staff/:id`             | Removes a staff member after service-level conflict checks; the current controller accepts `x-acting-staff-id` as a caller-identity stand-in. |

### Admin operation routes

These routes are mounted under `/api/admin/operation` and require an authenticated employee.

| Method | Route                                | Behavior                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/admin/operation/kpi/dashboard` | Returns the KPI dashboard with 13 chart series computed from live Neon PostgreSQL data. Query params: `?range=today\|7d\|30d\|90d` (default `today`). The period is always `today`; the range controls how many days of history are returned, ending today. |

KPI daily summary, rule alert and report routes (`/api/admin/kpi/daily-summary`, `/api/admin/kpi-alerts`, `/api/admin/kpi-reports`) are listed in [docs/kpi-reports-and-alerts.md](docs/kpi-reports-and-alerts.md).

### Task routes

Mounted at `/api` via `taskRouter`. Every route requires an authenticated employee; creating,
deleting, and the Task Timeline's assign/set-time action additionally require a manager. See
[Backend README](Backend/README.md) for the full route table.

### Booking review routes

Mounted at `/api/admin/bookings`. Every route requires a manager: list every paid or confirmed
booking, approve, refuse (with a required reason), and undo either decision. Approving generates
that pet's tasks; undo deletes them. For requests made with a saved card the same routes run the
desk: record each approved pet's arrival (checking in generates its tasks), finish check-in (one
charge), and cancel or move a stay without a fee for an emergency. See
[`docs/admin-bookings-api.md`](docs/admin-bookings-api.md). A decision that changes what the
parent sees also writes a parent notice in the same transaction; see
[`docs/booking-notifications.md`](docs/booking-notifications.md).

### Staff shift routes

Mounted at `/api/admin/staff-shifts`. Every route requires a manager: list/add/edit/remove Staff
Shift Table entries, optionally filtered by staff or date range.

### Staff dashboard routes

Mounted at `/api/admin/staff-dashboard`. Every route requires a manager: team overview (tasks
done/overdue/issues, on-shift status) and one staff member's detail (completion breakdown, recent
issues, today's tasks, shift calendar).

### AI booking concierge routes

Mounted at `/api/concierge`. Guests may call every route except `last-stay`; writes require a
trusted origin and run under per-address budgets. See
[docs/ai-booking-concierge.md](docs/ai-booking-concierge.md).

| Method | Route                                          | Behavior                                                                                                                                                                                                                                                                                                             |
| ------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/catalogue`, `/rates`                         | The services with their prices, and the honest "from" price for one pet and one night.                                                                                                                                                                                                                               |
| `GET`  | `/status`, `/terms`                            | Whether email codes and card payments work here (and whether cards are a test), the team contact, the fee rules, and the current booking terms.                                                                                                                                                                      |
| `GET`  | `/last-stay`                                   | Signed-in pet parent only: the pets and services of their latest stay, for "same as last time". Dates are never copied.                                                                                                                                                                                              |
| `POST` | `/chat`                                        | One assistant turn: merges the stated needs, then returns the combos (signed quotes) and the catalogue for the stay panel.                                                                                                                                                                                           |
| `POST` | `/price`                                       | Prices and signs a stay the guest built in the panel: one room and one food per pet, any add-ons. Refuses (422 `CONCIERGE_SELECTION_INVALID`) a stay the chat would not quote: dates in the past, check-out on or before check-in, longer than 60 nights, or a pet without a species.                                |
| `POST` | `/quotes/accept`                               | Records the guest's agreement to a signed quote.                                                                                                                                                                                                                                                                     |
| `POST` | `/verification/start`, `/verification/confirm` | Emails a one-time code and checks it, before an account is created or a booking is attached to an email. An address with a password is refused (`CONCIERGE_PASSWORD_ACCOUNT`), and the page offers password sign-in instead. The booking page no longer calls these; a first-time guest sets a password at checkout. |
| `POST` | `/card-setup`, `/checkout`                     | Saves the card, then holds the price and records the booking. With `newAccount { email, password }` a first-time guest's account is made in the same step.                                                                                                                                                           |

### AI pet intake routes

Mounted on the Backend at `http://localhost:3000`. Reuses the existing `LLM_BASE_URL`,
`LLM_MODEL` and `LLM_API_KEY` configuration; it adds no environment variables of its own.

| Method | Route                     | Behavior                                                                                                                                                                                                                   |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/ai/pet-description` | Reads a pet description a signed-in owner wrote and returns a draft of the pet form. Returns only the fields the description actually stated, so an absent key means "not mentioned" rather than "cleared". Saves nothing. |

Behind `requireAuth`, `requireTrustedOrigin` and a fixed-window budget of 10 requests per minute
per caller. The budget is in memory and per process, which is enough for one API instance; a
multi-instance deployment would need a shared store.

### Live dictation socket

The Backend serves live dictation on the same port as the REST API:

| Protocol  | Route                | Behavior                                                                                                                                                                                                |
| --------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebSocket | `/api/speech/stream` | Receives 16 kHz PCM audio from `useDictation`, relays it to the local Whisper speech service (or Amazon Transcribe), and returns interim and final transcript text. The route does not store the audio. |

The handshake checks the `Origin` header against the CORS origin list and reads the signed session
cookie; guests are admitted with tighter per-address limits for the public booking concierge.

## Accessibility and theming

An accessibility toolbar is mounted on every route, for every kind of visitor including a
signed-out one. A launcher in the bottom-left corner opens it.

| Control   | Behavior                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Read      | Reads the page aloud through the browser's speech synthesis, with previous/next sentence and stop.                                         |
| Text size | Five steps from 100% to 160%. Type scales; the layout does not.                                                                            |
| Spacing   | Relaxed letter, word and line spacing.                                                                                                     |
| Ruler     | A band that follows the pointer so one line stays visually isolated.                                                                       |
| Theme     | Opens the appearance controls: for a pet parent and an employee their own settings page, and for a signed-out visitor a full-screen panel. |
| Language  | Switches the whole site between English and Chinese; the button names the other language in that language. Staff pages stay English.       |
| Reset     | Returns the theme, text size, spacing, ruler and reading colour to defaults, stops the reader and collapses the bar.                       |

Preferences persist in the browser under `tlp.accessibility.v1`. The launcher itself can be
switched off from any settings page. The language switch lives only here; the landing, booking,
portal and sign-in headers no longer carry one, and `?lang=` still works.

### Themes

Nine themes in three groups, shown in this order: romantic (Strawberry Cream, Milk Cream,
Mint Secret Garden, Moonlight Sleepover), luxury (Le Petit Palais, Maison Noir) and minimal
(Simple, Paper, Slate). Romantic and luxury themes supply a page picture and a motif. Minimal
themes are colour only, with no picture. Slate and Moonlight Sleepover are tagged as night mode and Strawberry Cream as the default.
Strawberry Cream is also the default on the staff console under `/admin`, which now uses the same
tokens, panels and shell as the pet parent pages; staff who want a plain workspace pick Simple.
No hard-coded Tailwind colour classes remain, and the drift test fails if one is added.
See [docs/brand-themes.md](docs/brand-themes.md) and [docs/ui-foundation.md](docs/ui-foundation.md).

Some things never change with the theme or follow one rule in all of them:

- The Wagstay mark, an apricot paw, is the tab icon and sits beside every "Wagstay" wordmark.
- Every bar uses the same navigation pills, with the current page as a solid pill.
- In the six decorated themes, primary buttons and package cards press down and spring back.

Each role reaches the picker on its own surface: a pet parent in Account Settings, staff on their
profile's Settings tab, a manager in Platform Settings. The theme persists under
`tlp.brandTheme.v1`.

Reading colours (Dark, Light, Yellow, Grey) and themes are mutually exclusive. Whichever control
was used last wins.

### Generated stylesheets

Three stylesheets are generated rather than hand-written, because they cover call sites a theme
token cannot reach: Tailwind arbitrary colours such as `bg-[#f1ece7]`, literal hex in plain
stylesheets, and one-off `text-[Npx]` classes. Regenerate them after changing a palette or adding
a hard-coded colour; the drift test fails if a colour escapes.

| Command (run from `Frontend/`)                   | Regenerates                                             |
| ------------------------------------------------ | ------------------------------------------------------- |
| `node scripts/generate-brand-theme-palettes.mjs` | `src/shared/theme/brand-theme-palettes.css`             |
| `node scripts/generate-theme-legacy-colours.mjs` | `src/shared/theme/brand-theme-legacy-colours.css`       |
| `node scripts/generate-a11y-text-sizes.mjs`      | `src/shared/accessibility/accessibility-text-sizes.css` |

These features add no npm dependencies. See [Accessibility toolbar](docs/accessibility-toolbar.md),
[Brand themes](docs/brand-themes.md) and [AI features](docs/ai-features.md) for the detail.

## Common commands

Run root commands from the repository root.

| Command                                                               | Purpose                                                           | Platform note                                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`                                                         | Start Backend and Frontend together.                              | macOS/Linux/Git Bash shortcut; use separate PowerShell terminals on Windows.                       |
| `npm run dev --prefix Backend`                                        | Start the Backend only.                                           | macOS and Windows PowerShell.                                                                      |
| `npm run dev --prefix Frontend`                                       | Start the Frontend only.                                          | macOS and Windows PowerShell.                                                                      |
| `npm run dev:backend`                                                 | Start the Backend only (same as the `--prefix Backend` command).  | Cross-platform npm command.                                                                        |
| `npm run build`                                                       | Build Backend and Frontend.                                       | Cross-platform npm command.                                                                        |
| `npm run build --prefix Backend`                                      | Type-check and compile Backend to `Backend/dist/`.                | Cross-platform npm command.                                                                        |
| `npm run build --prefix Frontend`                                     | Type-check and build Frontend to `Frontend/dist/`.                | Cross-platform npm command.                                                                        |
| `npm run db:up`                                                       | Start the optional local PostgreSQL test database.                | Docker Desktop required; not part of the default Neon workflow.                                    |
| `npm run db:down`                                                     | Stop the optional local PostgreSQL container and keep its volume. | Docker Desktop required.                                                                           |
| `npm run db:reset`                                                    | Delete the optional local volume and recreate PostgreSQL.         | Destructive; use only when local data can be removed.                                              |
| `npm run auth:provision-password --prefix Backend -- --email <email>` | Set a hidden password for a database user.                        | The command prompts interactively.                                                                 |
| `npm run test --prefix Backend`                                       | Run Backend Vitest tests.                                         | Focused/default Backend suite.                                                                     |
| `npm run test --prefix Frontend -- --run`                             | Run Frontend Vitest tests once.                                   | Focused/default Frontend suite.                                                                    |
| `npm run lint`                                                        | Run root ESLint with zero warnings.                               | Root quality command.                                                                              |
| `npm run format`                                                      | Format the repository with Prettier.                              | Review the resulting diff before committing.                                                       |
| `npx jscpd Backend/src Frontend/src`                                  | Scan Backend and Frontend source for duplicated code.             | Uses the root `jscpd` devDependency.                                                               |
| `npm run ci:quality`                                                  | Root lint and configured Prettier quality gate.                   | Prefer Git Bash/macOS/Linux; run the individual checks on PowerShell if shell parsing is an issue. |
| `npm run ci:frontend`                                                 | Frontend lint, Prettier, build, and tests.                        | Individual package commands are the portable fallback.                                             |
| `npm run ci:backend`                                                  | Backend build and unit tests.                                     | Individual package commands are the portable fallback.                                             |
| `npm run ci:api:postgres`                                             | Validate and run Neon PostgreSQL API read-back tests.             | Reads `TEST_DATABASE_URL` from `Backend/.env` or the environment.                                  |
| `npm run ci:local`                                                    | Runs quality, Frontend, Backend, and Neon PostgreSQL API checks.  | Full local gate; it does not start Docker or prepare a local database.                             |
| `npm run test:e2e:parent-feedback`                                    | Run the Playwright parent-feedback persistence spec.              | Requires additional database, auth, configured LLM provider, and browser setup described below.    |

## Testing and CI

### Focused checks

The smallest useful checks for the current packages are:

```text
npm run test --prefix Backend
npm run test --prefix Frontend -- --run
npm run build --prefix Backend
npm run build --prefix Frontend
npm run lint
npx prettier --check README.md Backend/.env.example Backend/README.md Frontend/README.md docs
```

The repository's product tests and quality checks are separate. A passing test suite does not replace
the build, lint, formatting, or database preparation checks.

### PostgreSQL API read-back tests

The PostgreSQL API read-back suite always uses the isolated Neon database in `TEST_DATABASE_URL`. It
validates the auth, staff and feedback tables and columns against `Backend/database/neon.sql`, checks
the required seed fixtures, serializes concurrent runs with a PostgreSQL advisory lock, injects the
test URL into the Backend's `POSTGRESQL_URL` only for the test process, and runs the three PostgreSQL
API test files. It does not start Docker, drop/create a database, apply a schema, or fall back to the
normal `POSTGRESQL_URL`.

Set `TEST_DATABASE_URL` in `Backend/.env` for local execution, or provide it through the CI
environment. The optional `db:up`, `db:down`, and `db:reset` commands remain available for manual
local PostgreSQL work but are not part of `ci:local`.

### Parent-feedback Playwright persistence test

Run:

```text
npm run test:e2e:parent-feedback
```

The spec requires:

- `TEST_DATABASE_URL` for the isolated test database. The Playwright config passes this value to the
  Backend child process as `POSTGRESQL_URL` for that test process only; it fails fast when the test
  variable is missing.
- The canonical fixed owner/pet fixture and a database prepared from `Backend/database/neon.sql` with
  the required seed rows applied.
- An available configured LLM model for the Backend insight generation path.
- A Playwright browser. The config can use macOS system Chrome or `PLAYWRIGHT_BROWSER_PATH`; other
  environments can install a Playwright browser.

The current test body calls the protected parent feedback endpoint but does not contain a login or
storage-state setup. Do not treat the existence of this spec as proof that a fresh checkout can pass
the authenticated flow without supplying the required session setup. This is a known test-boundary
gap, not a reason to weaken the Backend authorization check.

### GitHub Actions

`.github/workflows/ci.yml` runs separate quality, Frontend, Backend, and Neon PostgreSQL jobs for
pushes and pull requests targeting `main`. `.github/workflows/required-reviewer-by-author.yml`
requests and validates the required reviewer for pull requests targeting `main`.

## Troubleshooting

### The API starts but `/api/health` returns `503`

Confirm `Backend/.env` contains reachable values for both `POSTGRESQL_URL` and `MONGO_URI`. Start
Docker only if you intentionally want to use the optional local PostgreSQL database instead. The
Backend can listen without a working database, but health checks and the affected database-backed
paths cannot complete.

### `password authentication failed` for the local database

For the normal setup, check that `POSTGRESQL_URL` points to the intended Neon host and database. If
you intentionally use the optional Docker database, use its host port `5433`; a native PostgreSQL
service can already own `5432`, so the wrong local port may reach a different database server.

### Feedback submission returns `401`, `403`, or an ownership error

The parent submission requires a signed pet-parent session, a trusted origin, and ownership of the
fixed feedback pet. Provision and use `ava.mitchell@example.test` for the canonical pet UUID, or
use the current account/pet data expected by your own database setup. A newly signed-up parent is
not automatically connected to the fixed Frontend feedback context.

### Feedback analysis is unavailable

Make sure the configured LLM provider is reachable at `LLM_BASE_URL` and that `LLM_MODEL` is
available there. The Backend intentionally stops before the database insert when structured insight
generation fails.

### Voice input does not transcribe

Dictation goes through the Backend's `/api/speech/stream` WebSocket to the local speech service,
so both must be running: check that `http://127.0.0.1:8765/health` answers `"status": "ok"`. The
Backend log names the cause when the service cannot be reached. The browser must also be allowed to
use the microphone. See [Test the voice dictation feature](#test-the-voice-dictation-feature).

### PowerShell cannot run the root `npm run dev` shortcut

Do not use the root `npm run dev` shortcut in PowerShell. Use the two-terminal Windows
instructions.

### `npm ci` reports `EUSAGE` or a missing package from the lockfile

The package lockfile and `package.json` are out of sync, often after an interrupted install while a
Node dev server holds a native binary open. Stop the relevant dev servers first.

**macOS/Linux**

```bash
cd Frontend  # or Backend, whichever package is affected
rm -rf node_modules package-lock.json
npm install
npm ci
```

**Windows PowerShell**

```powershell
Set-Location Frontend  # or Backend, whichever package is affected
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm ci
```

Regenerating a lockfile is a repository change. Review it before committing.

## Documentation

| Document                                                                               | Purpose                                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Frontend README](Frontend/README.md)                                                  | Frontend routes, feature layout, and Frontend-specific boundaries.                   |
| [Backend README](Backend/README.md)                                                    | Backend setup, database behavior, and API route details.                             |
| [Admin & Pet Parent Login Guide](docs/admin-login.md)                                  | Login, signup, cookie session, and auth boundaries.                                  |
| [Feedback System](docs/feedback-system.md)                                             | Detailed feedback data flow, schema mapping, and evidence.                           |
| [Feedback workflow fixtures](docs/feedback-workflow-fixtures.md)                       | Feedback workflow fixture cases and handling notes.                                  |
| [Testing Guide](docs/testing-guide.md)                                                 | Focused tests, PostgreSQL read-back checks, Playwright, and CI.                      |
| [UI foundation](docs/ui-foundation.md)                                                 | Apricot Cream visual tokens and typography rules.                                    |
| [Admin profile data-governance bug](docs/admin-manager-profile-data-governance-bug.md) | Current-staff identity and profile ownership investigation.                          |
| [Admin feedback detail switching bug](docs/admin-feedback-detail-switching-bug.md)     | Feedback detail/timeline migration investigation.                                    |
| [Review image loading and cache bug](docs/review-image-loading-and-cache-bug.md)       | Review image transfer, caching, and cross-surface loading fix.                       |
| [Clean-code rules](docs/clean-code-rules.md)                                           | Repository coding and quality standards.                                             |
| [Final Neon schema](Backend/database/neon.sql)                                         | Final public tables and constraints.                                                 |
| [AI booking concierge](docs/ai-booking-concierge.md)                                   | Combos, the stay panel, pricing, "same as last time", checkout and the assistants.   |
| [Manager bookings API](docs/admin-bookings-api.md)                                     | Manager booking review, the check-in desk and its one charge, and no-fee exceptions. |
| [Task Timeline booking scope](docs/task-timeline-booking-scope.md)                     | How the Task Timeline groups tasks per booking, and the task-route auth split.       |

## Development version history

No release tags are defined in the current checkout. The table below records meaningful
Alan Ho-authored development milestones visible in the current `user-management-system` history,
using Pacific/Auckland commit times. Merge-only and checkpoint commits are omitted; the commit IDs
remain the audit trail for the complete changeset.

| Date/time (Pacific/Auckland) | Commit(s)                                                                                         | What changed                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-20 10:39 to 15:21    | `4e058f9`, `cab7d5b`, `dfeb93e`, `4a651a1`, `6eacd17`, `846cd45`                                  | Established the Apricot Cream UI foundation, connected the feedback Frontend to the Backend API, fixed feedback read-state timing, and aligned CI/test runtime behavior.                                                                            |
| 2026-08-21 14:24 to 14:54    | `7f33a8f`, `970f4b5`, `f961b68`, `3c59a9a`, `03a421a`                                             | Added Google login and Zustand auth integration, fixed the Google credential import/runtime issue and password-eye interaction, repaired Backend build errors, and introduced the first structured README/docs set.                                 |
| 2026-08-22 14:54 to 16:34    | `44703d3`, `05ef0b6`, `6d3012e`                                                                   | Consolidated feedback flows/admin UI, made the parent-selected feedback type authoritative, and centralized the shared visual foundation and typography.                                                                                            |
| 2026-08-23 19:18 to 22:34    | `bc14f64`, `841dc23`, `059d054`, `1ca0afd`                                                        | Separated feedback review and assignment surfaces, completed staff workflow cleanup, restored account-menu logout actions, and refactored the feedback voice/staff workflow path.                                                                   |
| 2026-08-24 12:33 to 23:36    | `dcc4f63`, `e6bcb2e`, `71d1cb4`, `a0cc6bf`, `a67b3cb`, `b53dcd1`, `6956f30`, `d8bddc4`            | Added pet-parent signup and centralized validation, created relational schema fixtures, aligned API names with the schema, persisted parent feedback, and connected staff feedback reads to PostgreSQL.                                             |
| 2026-08-25 09:18 to 18:13    | `1d21434`, `7407556`, `e0796fd`, `1e5d419`, `5acf380`, `b2ff5a0`, `3220713`, `ff766da`            | Split admin read/workflow services, persisted Issue/Suggestion progress, added feedback range/time handling and timeline backfills, retired the legacy schema path, persisted signup accounts, and enabled PostgreSQL password verification.        |
| 2026-08-26 13:19 to 23:03    | `9e388e8`, `0743cf1`, `8ad6e37`, `934e9eb`, `b9ae719`, `b11149b`, `d86cafb`, `8a61f02`, `6cd14c4` | Updated parent navigation and account interactions, redesigned manager/profile surfaces, added platform settings/auth routing, added PostgreSQL read-back coverage, stabilized current-staff identity, and unified feedback/profile loading states. |
| 2026-08-27 06:59 to 10:20    | `329d059`, `121812e`, `04416fb`, `d9d5f0a`                                                        | Added signed cookie sessions and protected feedback flows, aligned transcription accessibility coverage, added CODEOWNERS ownership, and enforced required PR review by author.                                                                     |

## Contributing

1. Create a feature branch from the current base branch.
2. Keep application, schema, environment, and documentation changes within the requested scope.
3. Run the focused checks for the files you changed; use the broader CI commands when the change
   crosses package or contract boundaries.
4. Use Conventional Commit messages such as `feat:`, `fix:`, `docs:`, `refactor:`, or `test:`.
5. Open a pull request against `main` and satisfy the repository's required-reviewer workflow.

## License

There is no root `LICENSE` file in the current checkout. Do not assume that the old README badge or
package metadata is a distribution license; confirm the project's licensing decision before
redistributing the repository.
