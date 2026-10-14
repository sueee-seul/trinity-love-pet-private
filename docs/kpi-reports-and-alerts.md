# KPI Reports and Alerts

Manager-facing summaries, reports and alerts built on the KPI task data. Task figures are read from
PostgreSQL; generated text and logs are stored in a separate MongoDB (`KPI_MONGO_URI`). The
PostgreSQL schema is unchanged.

All times follow the KPI rules: Auckland time, `scheduled_at` read as Auckland wall-clock time, and a
task is overdue only after its scheduled time + 30 minutes. Tasks with no time set (stored 00:00) are
never overdue.

## Daily summary

- **When:** a job inside the API server checks every 15 minutes. From 09:00 Auckland (start of NZ
  business hours) it creates the
  summary for yesterday (Auckland midnight to midnight) if it is not saved yet, so a restart catches up.
- **Figures (code):** tasks scheduled yesterday (cancelled excluded), completed, completion rate,
  overdue, still open at the end of the day, and overdue / assigned per staff member. The summary
  only describes yesterday; comparisons with earlier periods are in the weekly and monthly reports.
- **Text (LLM):** one Gemini call writes a one or two sentence takeaway from the team totals only.
  Staff names and dates are not sent.
- **Storage:** `daily_summaries` (date, status, text, figures, llmModel, attempts).
  - No tasks scheduled → saved as `empty` without an LLM call.
  - LLM error → saved as `failed`; retried on later runs, up to 3 attempts.
  - Missing LLM settings → nothing saved, so the next run retries once settings are added.
- **Card:** below the KPI filter bar, "Yesterday's summary (30 Sep)". It shows the figures, staff with
  overdue tasks (top 3) and the takeaway. It reads the saved summary and never calls the LLM. It is
  shown on the Today tab; the other range tabs show a saved report instead (see "Range tab summaries").

### API

| Method | Route                          | Behavior                                                                                            |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/admin/kpi/daily-summary` | Manager only. Returns `{ date, status: ready \| empty \| not_ready, text, figures }` for yesterday. |

### Configuration (`Backend/.env`)

| Variable              | Purpose                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `KPI_MONGO_URI`       | MongoDB for KPI reports, including the database name. Separate from `MONGO_URI`. The feature is off without it. |
| `KPI_LLM_MODEL`       | Gemini model name, e.g. a free-tier model listed in Google AI Studio.                                           |
| `KPI_LLM_API_KEY`     | Google AI Studio API key.                                                                                       |
| `KPI_LLM_BASE_URL`    | Optional. Defaults to Gemini's OpenAI-compatible endpoint.                                                      |
| `KPI_SUMMARY_JOB=off` | Optional. Keeps this server from running the summary job.                                                       |

### Limitations

- The Gemini free tier may use prompts to improve Google's products. Only team totals are sent, but
  switch to a paid tier before real data is used.
- The card refreshes only when the page is reloaded.

## Range tab summaries

The summary card follows the selected range tab and only reads saved reports, so opening a tab never
calls the LLM. Each report is written once by the reports job, and every day of the following period
shows the same saved text.

| Tab     | Shows                                 | Example on Mon 5 Oct to Sun 11 Oct |
| ------- | ------------------------------------- | ---------------------------------- |
| Today   | Yesterday's summary                   | The day before                     |
| 7 days  | Last week's report (Monday to Sunday) | 28 Sep to 4 Oct                    |
| 30 days | Last calendar month's report          | September                          |
| 90 days | Last calendar quarter's report        | Jul to Sep                         |

When a period has several reports (scheduled and manual), the newest one with LLM text is shown; a
report whose LLM call failed is shown with its figures only. Before the period's report exists (for
example Monday before 09:00) the card says the summary is not ready.

| Method | Route                                              | Behavior                                                                                                                             |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/admin/kpi/period-summary?range=7d\|30d\|90d` | Manager only. Returns `{ range, type, period, periodLabel, status: ready \| no_text \| not_ready, reportId, headline, keyNumbers }`. |

## Rule alerts

Code-only checks with no LLM cost. A job inside the API server runs every 30 minutes (and once
shortly after start) over today's tasks (Auckland date, cancelled excluded).

| Rule                  | Condition (defaults)                                                              | Alert example                                     |
| --------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| Overdue rate          | Among today's tasks past their deadline, at least 30% overdue and at least 3      | "Team overdue 40% (6/15)"                         |
| Staff overdue         | Per staff member (Unassigned counted as one), at least 50% overdue and at least 2 | "aria.singh overdue 60% (3/5)"                    |
| Critical task overdue | A high or urgent priority task, or a Medical task, becomes overdue                | "Medical task overdue: Medication Administration" |
| Time not set          | From 08:00, a task scheduled today is still stored at 00:00                       | "3 tasks today have no time set"                  |

- **Deadline:** real scheduled time + 30 minutes, judged to the minute as shown on screen: scheduled
  09:00 is on time until 09:30:59 and overdue from 09:31.
  - **Category:** a routine task's `tasks.category` (feeding, medication, grooming, exercise → Walking,
    enrichment → Playtime, potty, wellness); booking tasks (`custom`) by their booking title; else Other.
- **Medical:** the booking title "Medication Administration", or any title starting with "Medication"
  (for example "Medication: Carprofen"). The KPI category charts are unchanged.
- **Thresholds:** code defaults in `KPI_ALERT_THRESHOLDS`; there is no settings screen yet.
- **Staff workload (dropped):** the plan's "remaining tasks at least 2x the team average" rule is not
  used. Counting tasks ignores each staff member's shift, so a staff member who starts later looks
  free, and with two staff it can only fire when the other has no tasks. Balancing work is left to the
  reassignment agent, which can use shift data.

### Duplicates and read state

- Saved to `alert_logs` (date, rule, subject, severity, title, body, readBy, reportId). Report-ready alerts (rule `report-ready`) carry the `reportId` of the report they announce.
- The same rule and subject (team, staff name or task) alert once per Auckland date, and again only
  when it got worse (higher count).
- Read state is per manager: reading an alert does not mark it read for other managers.

### Where managers see them

- The existing notification bell shows a **KPI Alerts** section at the top of the same window, above
  Google Reviews. The badge counts both. It checks for new alerts every minute.
- The API is list-shaped (cursor and limit) so a future notifications page can reuse it.

### API

| Method  | Route                                  | Behavior                                                                                        |
| ------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET`   | `/api/admin/kpi-alerts?limit=&cursor=` | Manager only. Newest alerts first with `read` for this manager, `unreadCount` and `nextCursor`. |
| `PATCH` | `/api/admin/kpi-alerts/:alertId/read`  | Marks one alert read for this manager.                                                          |
| `PATCH` | `/api/admin/kpi-alerts/read-all`       | Marks all alerts read for this manager.                                                         |

### Configuration

| Variable             | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `KPI_MONGO_URI`      | Required, shared with the daily summary.                |
| `KPI_ALERTS_JOB=off` | Optional. Keeps this server from running the alert job. |

### Limitations

- Shift hours are stored (`employees.shift_details`) but not used yet, so a task held by a staff
  member who is off shift can still be flagged.
- Alerts appear when a manager has the app open; alerts raised while it is closed wait in the list.

## Weekly, monthly and quarterly reports

Change since the previous period, not a copy of the dashboard charts. Figures use the same rules as
the dashboard: tasks belong to their Auckland scheduled date (cancelled excluded), and overdue starts
after scheduled time + 30 minutes, to the minute.

| Report    | Runs (Auckland)                          | Period                       | Compared with      | Trend window |
| --------- | ---------------------------------------- | ---------------------------- | ------------------ | ------------ |
| Weekly    | Monday from 09:00                        | Last week (Monday to Sunday) | The week before    | 4 weeks      |
| Monthly   | 1st of month from 09:00                  | Last calendar month          | The month before   | 4 months     |
| Quarterly | 1 Jan, 1 Apr, 1 Jul and 1 Oct from 09:00 | Last calendar quarter        | The quarter before | 4 quarters   |

A job inside the API server checks every 15 minutes and creates any missing scheduled report, so a
restart catches up. A manager can also run a report for the last or current period (for testing).

### What a report contains

| Order | Section            | Made by | Content                                                                                               |
| ----- | ------------------ | ------- | ----------------------------------------------------------------------------------------------------- |
| 1     | Trend warnings     | Code    | A metric that got worse three periods in a row, e.g. "Average completion time up 3 weeks in a row"    |
| 2     | Summary            | LLM     | 2 or 3 sentences on what changed most; rate changes are written as points                             |
| 3     | Key numbers        | Code    | Completion, overdue and on-time rates, average completion time and delay, tasks scheduled and created |
| 4     | Biggest changes    | Code    | Up to three: category overdue, priority on-time rate, category volume                                 |
| 5     | Staff              | Code    | Scheduled, completion rate and overdue per staff member                                               |
| 6     | Main delay reasons | LLM     | Staff-written delay reasons (`tasks.issue`) grouped into themes                                       |

- **One LLM call per report.** The LLM writes the summary and assigns each delay reason to a theme;
  the theme counts are computed by code. Staff names are not sent.
- If the LLM call fails, the report is still saved with every code section; the summary and themes are
  left empty and the error is kept in `llmError`.

### Delivery

- **Storage:** `report_logs` (type, period, trigger `schedule` or `manual`, content, llmModel,
  llmError, email). The email and the in-app view read the same saved content.
- **In the app:** a "Weekly report ready (21 Sep to 27 Sep)" alert appears in the notification bell. Clicking it marks it read and opens the report page at `/admin/kpi-reports/:id` (manager only;staff are sent back to `/admin`). This is temporary until the notifications page exists.
- **Email:** sent to employees with `staff_role = 'manager'`. The outcome (`sent`, `failed` or
  `skipped`, intended recipients and actual recipients) is saved on the report; an email failure does
  not remove the report or the alert.
  - `console` mode (default, **current setup**) prints the email in the Backend log instead of
    sending it. The team has no company domain yet, so reports are not emailed for real.
  - `resend` mode sends through Resend. The team has no verified domain, and Resend then delivers only
    to the account's own email, so `KPI_REPORT_TEST_RECIPIENT` sends every report there and lists the
    intended managers at the top of the email. The seeded manager emails use `.test` addresses, which
    cannot receive mail.

### API

| Method | Route                              | Behavior                                                                                                |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/admin/kpi-reports/run`       | Manager only. Body `{ type: weekly \| monthly \| quarterly, period: last \| current }`. Returns the id. |
| `GET`  | `/api/admin/kpi-reports/:reportId` | Manager only. Returns the saved report content.                                                         |

### Configuration

| Variable                    | Purpose                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `KPI_EMAIL_MODE`            | `console` (default) or `resend`.                                                          |
| `RESEND_API_KEY`            | Required for `resend`.                                                                    |
| `KPI_REPORT_FROM`           | Optional. Defaults to `onboarding@resend.dev`.                                            |
| `KPI_REPORT_TEST_RECIPIENT` | Optional. Sends every report to this address instead of the managers.                     |
| `KPI_REPORT_APP_URL`        | Optional. Base URL for the report link in the email. Defaults to `http://localhost:5173`. |
| `KPI_REPORTS_JOB=off`       | Optional. Keeps this server from running the report job.                                  |

### Temporary choices

| Now                                                   | Why                                                                    | Later                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The report-ready alert opens `/admin/kpi-reports/:id` | There is no notifications page yet                                     | Open reports from the notifications page; the alert API is already list-shaped for it                 |
| Email runs in `console` mode                          | No company domain, and the seeded manager emails are `.test` addresses | Verify a domain, set `KPI_EMAIL_MODE=resend` and `RESEND_API_KEY`, remove `KPI_REPORT_TEST_RECIPIENT` |

### Limitations

- Average delay is a mean, so a few tasks completed days late (common in seeded data) can make it
  very large.
- A manual run for the current period compares a partial week or month with the full previous one.
