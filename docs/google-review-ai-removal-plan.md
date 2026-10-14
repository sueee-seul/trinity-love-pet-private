# Google Review AI Removal Plan

**Owner:** @Sorokillz

**Planned date:** 2026-09-28

**Estimate:** 16 hours

**Sprint:** 5

**Status:** Implemented; retired agent package cleanup completed 2026-10-02

## Follow-up cleanup

The retired `google-review-investigation-agent` local package and its Backend install dependency
were removed on 2026-10-02. The unused MongoDB reply-guidance seed and correction-memory subsystem
were removed with it. Manager-selected review types continue to persist in the PostgreSQL manager
correction timeline. No database schema or historical records were changed.

## Goal

Remove AI-generated per-review analysis from **Admin → Feedback → Google Reviews** and remove the
generated-text portion of the **Admin → Operation → AI Review Summary** card. Keep the Operation
card's Average Rating and review count. Reduce review-related AI work and requests while retaining
the staff review-handling workflow.

## Product rationale

The product rationale is that most pet-boarding facilities receive relatively few Google reviews
over the long term. At the review volumes expected for this workflow, managers can read individual
reviews directly; AI summaries and evidence analysis add processing and UI complexity without
enough review volume to justify them.

## Agreed scope

### Remove

- The per-review Agent Analysis UI, including the AI summary, AI triage/confidence display,
  reviewer-match result, and Evidence Check details and states.
- Frontend loading, caching, validation, and live-update subscriptions used only for per-review
  investigation results.
- Backend routes and result/event read paths used only to expose per-review investigation results.
- Automatic dispatch and background execution of per-review investigations, including the
  `investigation_requested` queue marker created for that purpose.
- Generated AI summary text in the Operation card.
- The Operation dashboard summary-bundle request and the service work used only to produce that
  bundle. The dashboard's existing rating and review-count projection remains.
- Obsolete tests, types, and UI states that exist only for the removed per-review analysis or
  Operation summary bundle.

### Keep

- Average Rating and review count in the Operation dashboard card.
- Review ingestion/creation, review text, ratings, photos, public review projection, filters,
  navigation, and review refresh events.
- Manager notifications and their persisted read state.
- Manual review-type editing, reviewer assignment, manual reply composition/sending, and review metrics and
  charts, unless source inspection finds a dependency that makes a narrower adjustment necessary.
- AI features outside this scope, including parent feedback insights.
- Existing stored investigation timeline records and database schema. This plan does not call for
  data cleanup, a migration, or any edit to `Backend/database/neon.sql`.

## Environment-variable impact

**No environment keys are expected to be removed by this design.** The removed investigation and
dashboard-summary paths used the shared `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` configuration;
those keys remain in use by retained AI behavior such as parent feedback/intake processing. Google
Review reply drafts are removed; managers compose replies manually. There are no dedicated keys for the removed
summary bundle or evidence-check feature.

| Key            | Action | Why                                                                                                                  |
| -------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `LLM_BASE_URL` | Keep   | Shared provider endpoint used by retained LLM features.                                                              |
| `LLM_MODEL`    | Keep   | Shared model selection used by retained LLM features.                                                                |
| `LLM_API_KEY`  | Keep   | Shared provider credential for configured OpenAI-compatible endpoints; local Ollama uses its configured placeholder. |
| `MONGO_URI`    | Keep   | MongoDB remains used by retained application conversation services.                                                  |

During implementation, recheck all environment-variable references before changing any env example.
Remove a key only if every retained runtime path and supported local workflow no longer reads it.

## Current flow and affected boundaries

The Google Review detail page obtains a review projection and separately loads a manager-only
investigation result through `useGoogleReviewInvestigation`. The panel renders the summary, triage,
identity match, evidence status, and evidence details. Review cards and the detail sidebar also
project summary/triage/confidence fields.

When an app-owned review is created, the Backend persists the review and manager notification
receipt records, and currently also writes an `investigation_requested` event. A background worker
claims that event and saves an investigation result. The review-created event bus also refreshes
review views; keep that independent event path and the notification records.

The Operation dashboard gets rating/count and chart data from its dashboard projection. It also
fetches a separate AI summary bundle. Remove only the summary bundle path while preserving the
dashboard projection and Average Rating display.

## Implementation workflow: exact steps

### Phase 1: Confirm dependencies before editing

1. Recheck `git status` and preserve the existing user change in `Backend/.env.example`.
2. Search all imports and callers of the investigation hook/store, result and event APIs, result
   contracts, investigation worker, dispatch event constant, dashboard-summary API, and agent
   summary runner.
3. Separate modules that are exclusive to the removed features from shared infrastructure. Do not
   remove the Google Review event bus, notification event stream, MongoDB facilities, or agent
   package pieces that still serve reply guidance or another retained feature.
4. Confirm that the existing `/api/admin/google-reviews/dashboard` projection contains the rating
   and review count needed by the Operation card after summary removal.
5. Inventory environment-variable references for removed and retained features. Do not remove shared
   LLM or MongoDB keys unless repository-wide call-site inspection proves they are unused.

### Phase 2: Remove per-review analysis from the Frontend

6. In `Frontend/src/features/admin/pages/AdminGoogleReviewDetailPage.tsx`, remove the investigation
   hook call and investigation prop; preserve review hydration, back navigation, store updates, and
   reply behavior.
7. In `Frontend/src/features/admin/components/feedback/detail/GoogleReviewDetailContent.tsx`, remove
   the analysis panel while preserving original review content, photos, and manual reply editor.
8. Remove `GoogleReviewAnalysisPanel.tsx` and `InvestigationEvidenceDetails.tsx` if no retained
   feature imports them.
9. Remove `useGoogleReviewInvestigation.ts`, the investigation-only client store/event subscription,
   API calls, response validators, and types only after confirming there are no retained consumers.
10. In `GoogleReviewCard.tsx`, `GoogleReviewSidebarList.tsx`, and `GoogleReviewsPanel.tsx`, remove
    generated AI summary and confidence presentation and any summary-only search behavior. Preserve
    manual type controls and verify the type filter continues to use the intended user-editable type.
11. Update review list/detail types and presentation utilities to remove fields that are no longer
    part of the Admin contract. Keep any field still needed by a retained function.

### Phase 3: Keep only Average Rating in the Operation summary card

12. Refactor `AiReviewSummaryPlaceholder.tsx` into an Average Rating card (or use the repository's
    existing naming pattern) that displays the dashboard rating and review count only. Remove AI
    loading/error/text states and summary wording from visual help.
13. Update `GoogleReviewDashboard.tsx` and `useAdminGoogleReviewDashboard.ts` to stop consuming
    summary state while preserving dashboard period selection, refresh, rating/count, and charts.
14. Remove the summary-bundle fetch/cache/status from `googleReviewStore.ts` and
    `googleReviewDashboardApi.ts` once no caller remains.
15. Remove the manager-only `dashboard-summary` route/controller/service and the Agent summary call
    used only by this endpoint. Keep the regular dashboard API and rating calculation.
16. Retain shared agent code if other live consumers remain; delete only now-unused summary-specific
    code and dependencies.

### Phase 4: Stop per-review investigation processing on the Backend

17. In `Backend/src/repositories/review.repository.ts` and `Backend/src/services/review.service.ts`,
    stop creating and publishing per-review investigation dispatch work. Preserve the review row,
    review media, `review_received` receipt event, manager notification fan-out, and ordinary
    review-created invalidation event.
18. Remove the investigation worker startup from `Backend/src/server.ts` and remove worker/service,
    result-read and investigation-event routes/controllers/repositories only when all remaining
    call sites have been removed.
19. Remove `investigation_requested`-specific subscriptions or event stream code only if they are
    dedicated to the removed analysis. Keep `google-review-updated` / ordinary review SSE behavior
    used to refresh the review list and notifications.
20. Simplify the Admin review projection and SQL to stop reading generated summary/confidence fields
    if those fields have no retained consumer. Preserve manual triage and assignment fields if their
    edit workflow remains.
21. Do not delete historical investigation rows or modify schema as part of this change.

### Phase 5: Tests and documentation

22. Update Frontend tests for Google Review cards, list/sidebar, detail page, and Operation dashboard.
    Assert that analysis/evidence UI and summary-bundle loading are absent, while Average Rating,
    review count, review content, photos, manual type changes, replies, and dashboard charts remain.
23. Update Backend focused tests for review creation and manager notification behavior. Assert that
    review creation no longer queues investigation work and still commits a review receipt and
    manager notifications.
24. Update/remove API and worker tests only for routes and processing that are intentionally removed;
    retain coverage for review reads, mutation APIs, manager notifications, and ordinary SSE refresh.
25. Update `README.md` feature status, API route list, persistence/runtime notes, and test instructions
    to describe the lean review workflow and Average Rating-only Operation card.
26. Update `docs/manager-google-review-notifications.md` to remove the old investigation dispatch
    step from the notification lifecycle while documenting that notifications are independent of
    AI processing. Add or link a concise workflow description from the README.

### Phase 6: Verification and review

27. Run the focused Frontend tests for changed Google Review detail/list/dashboard behavior.
28. Run the focused Backend unit/API tests for review creation, review projections, and notifications.
    Use the repository's test runner conventions; run PostgreSQL API tests only when their isolated
    database prerequisites are available and the changed boundary needs them.
29. Run applicable quality checks separately: `npm run lint`, `npm run format` (or its check mode
    where appropriate), `npm run prepare`, Frontend build, Backend build, and `git diff --check`.
30. Measure before/after behavior in the same local environment and record the conditions. Verify:
    - opening a Google Review detail no longer requests the investigation-result or
      investigation-events endpoints;
    - creating a review makes zero per-review AI/investigation dispatches and still creates the
      expected manager notification(s);
    - opening or refreshing Operation makes zero dashboard-summary requests/LLM summary calls;
    - the dashboard rating and review count still render from the normal dashboard response.
    - manual reply composition/sending remains available and no reply-draft LLM call occurs.
31. Record request counts and comparable page/API timings before and after. Report the reduction in
    requests and AI calls exactly; only claim a latency improvement if repeatable measurements
    support it. Record test commands/results, skipped checks and reasons, and any remaining risks.
32. Review the final diff for accidental changes, verify the pre-existing `.env.example` edit is
    untouched, and request owner review.

## Acceptance criteria

## Updated review workflow

1. A public or simulator review is persisted with its text, rating, photos, and ordinary refresh event.
   Human submissions still create the review receipt and manager notifications in the same
   transaction; neither path creates AI work.
2. The Admin review list loads the base review data, sent replies, notification/read state, and any
   manager-selected type. No investigation or summary endpoint is called.
3. A manager can set a type manually. The Backend stores that choice as a `manager_correction`
   timeline event with no source AI run; assignment remains available after classification.
4. Staff can review the original content and compose a reply from a blank editor. Sending uses the
   existing manual reply endpoint. No generated draft is loaded or requested.
5. Operation loads its regular dashboard metrics. The Google Review card shows average rating and
   review count; existing charts and period controls continue to use dashboard data.

- No AI summary, AI confidence, reviewer-match, or Evidence Check is shown for an individual Google
  Review in Admin Feedback.
- The Operation card shows Average Rating and review count, with no AI-generated summary text,
  loading state, or summary error state.
- The per-review investigation and dashboard summary bundle are no longer requested or generated.
- Review creation, public review display, staff review content/photos, filtering, manual type editing,
  assignment, replies, manager notifications, review refresh, dashboard rating, and charts continue to
  work.
- Documentation accurately describes the final workflow and remaining boundaries.
- Focused test and quality results and performance evidence are recorded for owner review.

## Validation record

- Backend and Frontend production builds completed successfully.
- Focused Backend coverage passed: 9 files, 76 tests. It covers manual type persistence/assignment,
  reply handling, review creation, API routes, and manager notifications.
- Focused Frontend coverage passed: 11 files, 63 tests. It covers the lean review contract, manual
  replies/types, ordinary review refresh, detail content, and Average Rating card.
- ESLint, Prettier checks, and the repository `prepare` script passed. The prepare script needed
  the approved local Git configuration access to install hooks.
- Runtime work reduction was validated by the absence of summary/investigation/draft API calls,
  removal of the review dispatch marker and worker startup, and removal of the operation summary
  request. No before/after latency benchmark was captured, so this records reduced calls and model
  work rather than a measured page-speed improvement.
- PostgreSQL integration tests were not run because this change was verified through focused unit
  tests and did not change the database schema; no database behavior was required to validate the
  removed dispatch path.

## Explicit non-goals

- Removing unrelated AI capabilities.
- Removing AI-generated parent feedback insights.
- Removing dashboard metrics/charts or the Average Rating and review count.
- Changing database columns, applying migrations, deleting historical records, or editing
  `Backend/database/neon.sql`.
- Altering unrelated changes already present in the worktree.

## Clean-code checklist for implementation

- Keep UI, API, service, repository, and agent changes within their existing boundaries.
- Remove dead imports, types, state, tests, routes, and processing left unused by this scope.
- Preserve explicit error handling and strict TypeScript types; do not introduce `any`.
- Keep tests focused on the changed behavior and treat product tests, builds, lint, formatting, and
  preparation as separate evidence.
- Re-read the final diff and report deviations, skipped checks, and performance evidence.
