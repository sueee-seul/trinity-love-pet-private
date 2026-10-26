# AI booking concierge: issues found and fixed (2026-09-28)


---

## English

### Scope

This report covers the AI booking concierge (`/book`, `/parent/booking`) and the code written for
it: `Frontend/src/features/concierge`, `Frontend/src/shared/dictation`, `Backend/src/services/concierge`,
the concierge contract, controller, routes and repository, the speech stream service, and
`Backend/src/services/booking.pricing.ts`. Other teams' code was not changed; problems found there
are listed under "Open items".

Sources of the findings:

- **Before review**: a competitor research pass (6 research lanes plus a critic), a cold-user
  walkthrough, and my own checks while building.
- **Adversarial review**: 5 reviewers (state and recovery, security and privacy, backend logic,
  accessibility and bilingual copy, contract and tests), each finding re-checked by an independent
  verifier. 36 findings were confirmed; 31 remain after merging duplicates.

Every issue below is **fixed** and covered by an automated test unless marked otherwise. Nothing is
committed yet.

Severity: **High** = wrong price, wrong booking, security or a guest cannot finish. **Medium** =
wrong data, broken recovery, privacy or accessibility gap. **Low** = confusing but recoverable.

### A. Found before the review

| ID  | Sev.   | Problem                                                                                                                                   | Fix                                                                                                                                |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A1  | High   | Every new guest's booking failed at the last step: the server required the guest's own mobile (`contact.phone`) but the page never asked. | "Your mobile" field, checked with the same phone rule as the server; errors shown at each field.                                   |
| A2  | High   | The card said "Price held until …", but checkout refused an agreed quote if the catalogue price had changed since.                        | Checkout books at the agreed prices; it refuses only if a quoted service no longer exists.                                         |
| A3  | High   | In production no email code can be sent, so new guests hit a dead end only after planning and agreeing.                                   | `GET /api/concierge/status`; the page says so up front and offers "Send this plan to our team" (mail app, copy, phone).            |
| A4  | High   | "Two dogs, one needs medication" charged medication for both dogs; "12 to 15 October" (the chat box's own example) was not understood.    | English month names, ordinals and durations; a detail that could belong to any pet is asked about ("Which pet takes medication?"). |
| A5  | High   | A reload (for example a phone discarding the tab while the guest reads the code) lost the whole plan; browser Back left the booking.      | Plan kept in `sessionStorage` for the tab (no contact details); each step has its own history entry.                               |
| A6  | Medium | The assistant told guests their health notes would reach staff, but chat notes were never sent with the booking.                          | Notes are carried into the details step's care notes, visible and editable.                                                        |
| A7  | Medium | The terms summary promised a card-hold process and free cancellation that nobody had approved.                                            | Copy limited to what the system does today; policy items listed as business decisions.                                             |
| A8  | Medium | Buttons were greyed out with no reason; keyboard users could not find out what was missing.                                               | Buttons stay enabled; pressing lists what is missing and moves focus to the first problem.                                         |
| A9  | Medium | Errors, screen-reader labels and dictation errors were English on the Chinese page.                                                       | Errors mapped by server code to EN/ZH; all labels translated.                                                                      |
| A10 | Medium | The in-place email re-check sat inside the booking form (forms cannot nest): Enter in its field would submit the booking form.            | Moved outside the form.                                                                                                            |
| A11 | Low    | A dog's size held back the price although size changes no price.                                                                          | Size is asked once after the options appear.                                                                                       |
| A12 | Low    | "One is large, one is small" gave both dogs the same size.                                                                                | Two sizes, or one dog singled out of several, is left for the guest to set.                                                        |
| A13 | Low    | After verifying, focus went to the page title instead of the step heading; a lapsed email check bounced the guest back a screen.          | Focus waits one frame for the heading; the details step renews the check in place.                                                 |

### B. Adversarial review findings

**Prices and quotes**

| ID  | Sev.   | Problem                                                                                                                                         | Fix                                                                                                          |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| B1  | High   | If a re-price failed after the guest changed the plan, the old packages stayed agreeable: the server would book the old dates at the old price. | The store remembers which plan the packages were priced for; stale packages lock Agree and show "Try again". |
| B2  | High   | Editing the checklist while Agree was in flight accepted the old quote, while the details, confirmation and calendar file showed the new dates. | An agreement that returns after the plan changed is discarded; details and confirmation use the agreed plan. |
| B3  | Medium | A checklist tick during a chat reply cancelled the reply and dropped the details it had read; a tick during a re-price could be overwritten.    | Checklist pauses while the assistant replies; ticks made during a re-price are kept and priced next.         |
| B4  | Low    | A plan restored with expired prices, or reached again from a later step, could show no options at all.                                          | Options are re-priced whenever they do not match the plan (once per version of the plan, no loops).          |

**Rules assistant (reading what guests type)**

| ID  | Sev.   | Problem                                                                                                                       | Fix                                                                                          |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| B5  | High   | "She doesn't need any medication" (and the same in Chinese) was read as a yes and charged every pet.                                     | Negations are never a yes; clear "no" phrases apply to all pets.                             |
| B6  | High   | "My dog needs medication" (dog + cat) charged the cat too.                                                                    | "my/our dog(s)", pet names and plurals pick the pet; anything unclear is asked.              |
| B7  | High   | "1/2 cup" in a feeding note replaced the chosen dates; "2026/11/01" and "12/10/2027" were misread; "24/7 care" became a date. | Guards for fractions, years and 24/7; chosen dates change only for a message about the stay. |
| B8  | High   | "And the other one is a cat" shrank a two-pet plan to one cat and quoted it.                                                  | Open species are filled in; the pet list is never shrunk by a mention.                       |
| B9  | High   | A Chinese date range with years ("12 October 2026 to 15 October 2026") was read as 12 to 20 October.                                                                | Chinese dates with years are read correctly.                                                 |
| B10 | Medium | "October 12 to 15 November" became 12-15 November; "2 October - 3 dogs, 4 nights" became a 1-night stay.                      | Mixed month order supported; counts after a date are not read as the end day.                |
| B11 | Medium | The Chinese "OK" was never understood as yes, and a "yes" after a "didn't catch that" reply looped forever.                             | Chinese yes words recognised; the service question is matched at the end of the reply.       |
| B12 | Low    | The "which pet?" question said "tap it below" when there was no such button; the natural answer "the cat" was not understood. | Copy points to the checklist; "the cat", "pet 2", "both", "none" are understood.             |

**Booking data**

| ID  | Sev.   | Problem                                                                                                                         | Fix                                                                                                         |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| B13 | Medium | Saved-pet links followed list position: after a plan change a different saved pet (even another species) could be booked.       | Links are kept only while the position still holds that pet; the details rows rebuild when the pets change. |
| B14 | Low    | The server never compared a saved pet's species with the quoted pet.                                                            | Refused with `CONCIERGE_PET_SPECIES_MISMATCH`; the page only offers saved pets of the same kind.            |
| B15 | Medium | The size and medication flag the concierge collected were thrown away at checkout.                                              | Written to existing fields staff read (medication instructions, care notes). No column change.              |
| B16 | Medium | An emergency number such as "+64 (0) 21 - 555 - 0101" passed validation but is longer than `VARCHAR(20)`: 500 at the last step. | Numbers stored without spaces or brackets; length checked on the page.                                      |
| B17 | Medium | A saved pet name over 60 characters made every chat and re-price fail.                                                          | Names shortened to the server limit in the plan.                                                            |
| B18 | Medium | Long dictation could exceed the 2,000-character message limit, after which every turn failed until Start over.                  | Messages capped at 2,000 characters for typing and dictation.                                               |
| B19 | Low    | The page did not check maximum lengths; a too-long breed showed its error on the name field.                                    | Maximum lengths mirrored from the server; breed errors shown on the breed field.                            |

**Security and privacy**

| ID  | Sev.   | Problem                                                                                                                                                                               | Fix                                                                                                    |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| B20 | High   | Normal sign-up does not verify email. Someone could register a victim's email with their own password; the victim's email code then signed them into that account and booked onto it. | A code never signs into, or books onto, an account that has a password (`CONCIERGE_PASSWORD_ACCOUNT`). |
| B21 | Medium | The privacy note said saved progress is cleared after sending, but the chat, notes, pet names and email stayed in the tab.                                                            | After sending only the reference and dates stay; the note says exactly that.                           |
| B22 | Medium | The fallback contact `bookings@example.co.nz` is a domain anyone can register, and the plan hand-off sent guests' plans there.                                                        | No fallback address; email is offered only when a real one is configured.                              |
| B23 | Low    | Anyone could lock a victim's email for 24 hours with about a dozen requests.                                                                                                          | Spent codes keep the resend cooldown; locks start at 15 minutes and double up to 24 hours.             |
| B24 | Medium | After a successful booking, a failed session refresh showed the booking as failed (a resend could create a second booking).                                                           | The confirmation is shown first; a session refresh failure is ignored.                                 |

**Accessibility and bilingual copy**

| ID  | Sev.   | Problem                                                                                                | Fix                                                                                               |
| --- | ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| B25 | Medium | Keyboard focus fell to the page body after a chip tap, Start over and code sign-in.                    | Focus moves to the next question, the chat heading or the dialog's Close button.                  |
| B26 | Medium | Price units other than "per night" appeared in English on the Chinese page.                            | Units translated; an unknown unit shows nothing rather than raw English.                          |
| B27 | Medium | The tab title stayed "Plan your pet's stay" on every portal page afterwards.                           | Original title restored when the page closes.                                                     |
| B28 | Medium | "Do it now" links for vet consent, temperament and vet details went to a page that cannot do them.     | Only vaccination links to its page; the others say the team will go through them before drop-off. |
| B29 | Medium | The sticky "See your options" bar was broken inside the parent portal on phones.                       | Shown only on the public page.                                                                    |
| B30 | Low    | Every checklist tick announced "The assistant is thinking" and showed "Sending…" though no reply came. | Only chat messages and tapped answers show that.                                                  |
| B31 | Low    | Browser Back from the details step needed two presses.                                                 | Back walks to the nearest step that still applies; signed-in owners skip the verify entry.        |

### C. Open items (not changed)

| ID  | Where                             | Item                                                                                                                                              | Owner         |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| C1  | Shared `createBooking` repository | Test payments are recorded as succeeded/`paid`, so the portal may show "payment completed". The concierge confirmation says no payment was taken. | Booking owner |
| C2  | Auth                              | Sign-up does not verify email; forgot-password refuses passwordless accounts.                                                                     | Auth owner    |
| C3  | Repository history                | Commit `4265ca3` put real credentials in `Backend/.env.example`. Rotate those keys.                                                               | Team          |
| C4  | Concierge                         | Verification codes and the one-booking-per-agreement registry are in memory: one API instance only.                                               | Us, later     |
| C5  | Business                          | Handover hours, cancellation policy, reply time, meet-and-greet, real team email/phone, email provider (SES), payments (Stripe).                  | Facility      |
| C6  | Other teams' tests                | 5 tests were already failing: Frontend `AdminNavbar`, `FeedbackSidebarList`; Backend `feedback.api` (3).                                          | Their owners  |

### Verification

- Backend: 805 tests pass (187 for the concierge and speech); type check and ESLint clean.
- Frontend: 892 tests pass (60 for the concierge); type check, oxlint and ESLint clean; production build succeeds.
- Browser (local preview): full flow from tap-to-answer to confirmation; reload during the code step; Back from the
  confirmation; phone width; a failed re-price locks Agree and recovers with "Try again".
