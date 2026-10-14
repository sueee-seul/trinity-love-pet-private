# Review Workflow Failure Matrix

> Historical workflow specification. The Google Review investigation workflow described here has
> been retired; see [the removal record](google-review-ai-removal-plan.md) for current behavior.

Status: expected-behaviour matrix for #355. Execution evidence belongs to #356; reviewed
documentation packaging belongs to #430. A row marked `expected` or `blocked` is not a passed test.

## Purpose and boundary

The Review Management Sprint Goal (#388) must remain safe when a dependency fails. A missing
review, unavailable evidence reader, ambiguous booking, provider failure, or stale notification must
not appear to the manager as a successful investigation or a confident factual conclusion.

This matrix defines the expected failure behaviour at the manager-facing Review Management boundary:

```text
review notification -> review detail -> investigation -> triage -> identity match
-> booking comparison / Evidence Check -> manager result -> manager-controlled reply
```

The matrix consumes upstream results from booking, Live Care, providers, persistence, and
notification producers. It does not implement or repair those upstream systems. When an upstream
prerequisite is not ready, the row records the safe manager state, the owning boundary, and the
blocker instead of treating the scenario as passed.

## Reading the matrix

- `Expected` means the safe behaviour that #356 must execute or classify.
- `Blocked` means a prerequisite is not available; #356 must record the exact owner and prerequisite.
- `Implemented boundary` means the current source contains the relevant contract or guard. It is
  not runtime proof that the complete workflow has passed.
- `reviewUuid`, `runId`, `eventUuid`, and `notificationId` remain separate identities. A row must
  not use one identity as a substitute for another.
- Missing or unavailable evidence is not evidence that the review claim is false.

## Failure rows

### Review, identity, and investigation lifecycle

| ID         | Trigger                                                                                         | Expected persisted/API state                                                                                                                  | Manager UI and safe action                                                                | Retry / manual-review rule                                                                            | Owner and correlation                                                            | Verification status                                                |
| ---------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| FM-REV-001 | The bound review is missing, deleted, or no longer available to the investigation context.      | Investigation cannot produce a normal result; API returns the existing unavailable/not-ready boundary rather than a fabricated review result. | Show an explicit unavailable state; do not display an evidence conclusion.                | Retry only when the current review read is retryable; otherwise classify the missing review and stop. | Review Management / review repository; `reviewUuid`, `runId`.                    | Expected; #356 to execute or block with a review fixture.          |
| FM-REV-002 | The review, location, facility, actor, or run identity does not match the server-bound context. | Fail closed before retrieval or analysis; preserve the typed failure boundary.                                                                | Show analysis unavailable or an explicit safe failure, not another review's result.       | No client-side retry with substituted IDs.                                                            | Context/authorization boundary; `reviewUuid`, `runId`, actor and facility scope. | Implemented boundary; integrated execution pending in #356.        |
| FM-REV-003 | A duplicate, stale, or already-settled investigation run is claimed.                            | Keep the durable result/run fence; do not overwrite a newer result or rerun a settled run.                                                    | Show the latest durable result or an explicit stale-run state.                            | Retry only through the worker's current run/recovery policy.                                          | Investigation dispatch/result repository; `eventUuid`, `runId`, `reviewUuid`.    | Expected; execution owner is #356 / investigation lifecycle owner. |
| FM-REV-004 | The investigation has no review claims.                                                         | Terminal `no_claims_extracted`; no branch investigation or Evidence Check.                                                                    | Explain that no actionable claim was extracted; do not show a completed evidence finding. | No Evidence Check retry unless the source review changes.                                             | Triage boundary; `reviewUuid`, `runId`.                                          | Implemented contract; focused execution evidence still required.   |
| FM-REV-005 | Triage is unclear or has no usable branch.                                                      | Terminal `unclear_triage` / manager-review-required result; no retrieval tools.                                                               | Show manager-review-required wording without pretending that Evidence Check ran.          | No automatic branch retry beyond the current bounded policy.                                          | Triage/branch gate; `reviewUuid`, `runId`.                                       | Implemented contract; #356 to attach UI/API evidence.              |

### Notification and detail navigation

| ID            | Trigger                                                                                               | Expected persisted/API state                                                                                                                                                       | Manager UI and safe action                                                                      | Retry / manual-review rule                                                                           | Owner and correlation                                                                                 | Verification status                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| FM-NOTIFY-001 | Review creation commits, but the active-manager notification cannot be created.                       | The notification transaction must not be presented as successful delivery; preserve the review event and classify the notification failure according to the notification boundary. | The manager must not be told that a notification was delivered when no notification row exists. | Follow the current notification retry/owner policy; do not invent an outbox or retry worker in #355. | Notification producer/consumer boundary; review event, `reviewUuid`, `notificationId` when available. | Expected; execute with a controlled notification fixture or mark upstream blocker. |
| FM-NOTIFY-002 | A notification is missing, duplicated, assigned to the wrong manager, or has the wrong review target. | Preserve recipient, event, and review identity mismatch as a separate failure; do not silently select another notification.                                                        | Hide or mark the unsafe target; manager must not open another review as a substitute.           | Manual owner review for target/recipient mismatch; no automatic cross-user correction.               | #425 / notification repository; `notificationId`, `reviewUuid`, recipient identity.                   | Expected; #356 owns execution.                                                     |
| FM-NOTIFY-003 | Notification target is stale or the manager is unauthorized for the target review.                    | API returns the current authorization/not-found boundary; no review detail or evidence payload is exposed.                                                                         | Show an unavailable or unauthorized state and keep the user on a safe page.                     | No retry with a different review ID or manager identity.                                             | Notification/detail authorization boundary; `notificationId`, authenticated manager ID, `reviewUuid`. | Expected; #356 to attach API/browser evidence.                                     |

### Agent and provider failures

| ID           | Trigger                                                                                                              | Expected persisted/API state                                                                                            | Manager UI and safe action                                                               | Retry / manual-review rule                                                                        | Owner and correlation                                         | Verification status                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| FM-AGENT-001 | Configured model/provider is unavailable or times out.                                                               | Typed provider failure with safe message; do not write fabricated analysis.                                             | `Evidence unavailable` or equivalent analysis-failure state; preserve the review itself. | Honour the contract's `retryable` value and bounded worker policy; no unbounded retry.            | Backend model factory / Agent runtime; `reviewUuid`, `runId`. | Implemented failure contract; #356 to execute provider failure/timeout rows. |
| FM-AGENT-002 | Model output is malformed, references an unknown evidence ID, requests an invalid tool, or exceeds the bounded loop. | Typed invalid-model/tool failure or unresolved result; no invented IDs or free-form result is persisted.                | Show an unavailable or unresolved state, not a claim assessment.                         | Retry only when the current failure policy allows it; otherwise hand off the exact failure owner. | Agent contract/runtime; `reviewUuid`, `runId`, tool call ID.  | Implemented contract; runtime execution pending in #356.                     |
| FM-AGENT-003 | Review or retrieved evidence contains agent-control instructions or unsafe external-action requests.                 | Input guardrail blocks the affected phase with a safe typed failure; raw content is not copied into the manager result. | Show safe processing failure; do not expose prompts, credentials, or tool traces.        | No retry with the same blocked content unless the source is corrected.                            | Agent input guardrail; `reviewUuid`, `runId`.                 | Implemented boundary; #356 to attach the focused guardrail test.             |

### Identity and booking candidate comparison

| ID           | Trigger                                                                                             | Expected persisted/API state                                                                                                       | Manager UI and safe action                                                                 | Retry / manual-review rule                                                                                                     | Owner and correlation                                                   | Verification status                                                           |
| ------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| FM-MATCH-001 | Reviewer identity resolves to an app user but no reliable pet-parent/pet/stay chain exists.         | Preliminary `no_reliable_match`; `evidenceStatus = not_available`; do not unlock stay retrieval.                                   | `No confirmed pet-parent match`; do not show booking-specific evidence.                    | No booking search retry with invented IDs; manager may handle the review through the normal business process.                  | Identity match / #219; `reviewUuid`, `runId`.                           | Implemented contract; focused evidence exists, #356 owns matrix row.          |
| FM-MATCH-002 | Multiple authorized booking candidates remain plausible and no single candidate has unique support. | `unresolved`; no selected booking-specific Evidence Check read.                                                                    | `No unique stay identified`; explain that candidate comparison did not establish one stay. | Do not pick first/latest booking. Manual intervention is exceptional and must not be represented as an Agent-selected booking. | #434 candidate comparison / #219 Evidence Check; `reviewUuid`, `runId`. | Implemented semantic test boundary; #356 must execute the manager-facing row. |
| FM-MATCH-003 | Candidate inventory exceeds the bounded comparison budget.                                          | Explicit candidate truncation gap; unresolved result; no selected stay read.                                                       | Explain that the candidate set was incomplete; do not claim a complete historical scan.    | No automatic selection from the partial set; owner must provide a bounded retrieval/pagination decision.                       | #434 retrieval boundary; `reviewUuid`, `runId`.                         | Implemented guard; execution evidence pending in #356.                        |
| FM-MATCH-004 | Review has no usable booking-level clue and no candidate can be uniquely linked.                    | `no-matching-stay` or unresolved semantic outcome, depending on whether any eligible candidate exists; no unrelated care-log read. | State that no unique stay was identified; preserve uncertainty.                            | No retry that changes the candidate order or selects the newest booking.                                                       | #434 / #219; `reviewUuid`, `runId`.                                     | Implemented semantic test boundary; #356 to verify expected UI/API wording.   |

### Booking and Evidence Check failures

| ID              | Trigger                                                                                                                             | Expected persisted/API state                                                                                                                             | Manager UI and safe action                                                                                           | Retry / manual-review rule                                                             | Owner and correlation                                                                           | Verification status                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| FM-EVIDENCE-001 | A uniquely supported booking is no longer `paid`/`approved`, is stale, or is outside the authorized candidate set when revalidated. | Stay tool returns an explicit out-of-scope/ineligible failure; Evidence Check does not analyze that stay.                                                | Evidence unavailable/incomplete; do not use stale booking evidence.                                                  | Re-run only through a new authorized investigation context; never bypass revalidation. | #219 / booking evidence boundary; `reviewUuid`, `runId`, selected `bookingPetsUuid` internally. | Implemented server guard; #356 to execute stale/ineligible cases.        |
| FM-EVIDENCE-002 | Selected booking expectation exists but task/care reader returns missing or partial records.                                        | Preserve `partial`/`none` completeness and explicit evidence gaps.                                                                                       | Show incomplete evidence and the manager action hint; missing rows are not contradictions.                           | No retry should silently promote missing data to complete evidence.                    | #219 Evidence Check; `reviewUuid`, `runId`, evidence/gap IDs.                                   | Implemented contract; focused tests exist, integrated execution pending. |
| FM-EVIDENCE-003 | Communication, task, media, or other authorized reader is unavailable.                                                              | Reader-unavailable gap and typed tool/provider failure where applicable; do not claim that no communication/care occurred.                               | Show unavailable records and uncertainty.                                                                            | Retry only according to reader/provider policy; otherwise keep the gap visible.        | Reader owner / #219; `reviewUuid`, `runId`, gap ID.                                             | Implemented gap semantics; #356 to attach actual failure evidence.       |
| FM-EVIDENCE-004 | Review claim conflicts with an explicit execution record, or records are merely missing.                                            | Explicit conflicting evidence may support `contradicted`; missing/unavailable evidence must remain `insufficient_evidence`, `missing`, or `unavailable`. | Show claim-level status and provenance; never convert absence into contradiction.                                    | No manager-facing automatic truth judgement; manager makes the business finding.       | #219 Evidence Check; review claim ID and evidence/gap IDs.                                      | Implemented semantic contract; #356 verifies representative rows.        |
| FM-EVIDENCE-005 | Upstream manager-side task generation or Live Care records are not ready.                                                           | Mark the row blocked with owner/prerequisite; do not present the absence as a passed no-care result.                                                     | Show unavailable/insufficient evidence if the current UI can consume it; otherwise record a blocked UI prerequisite. | No workaround that fabricates task or care records.                                    | Upstream booking/Live Care owner; review/run identity where available.                          | Blocked until the upstream task-generation path is ready.                |

### Persistence, reply, and manager handoff

| ID             | Trigger                                                                                                  | Expected persisted/API state                                                                          | Manager UI and safe action                                                                                  | Retry / manual-review rule                                                                          | Owner and correlation                                                                   | Verification status                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| FM-PERSIST-001 | Preliminary or final investigation result cannot be persisted.                                           | Preserve the dispatch/run failure; do not report a durable result that was not written.               | Show analysis unavailable/not-ready and keep the review accessible without a fabricated result.             | Follow worker recovery policy; a notification or UI refresh must not rerun a settled phase blindly. | Result repository/worker; `eventUuid`, `runId`, `reviewUuid`.                           | Expected; #356 to execute persistence failure or record blocker.                       |
| FM-PERSIST-002 | Duplicate, stale, or conflicting result is read by the manager API.                                      | Validate the result contract and reject malformed/conflicting payloads; keep durable identity checks. | Show unavailable or stale-result state rather than mixing results.                                          | No client-side merge of conflicting results.                                                        | Result read/API boundary; `reviewUuid`, `runId`.                                        | Implemented validation boundary; integrated execution pending.                         |
| FM-REPLY-001   | Manager reply action is unavailable, targets a different review, or the send result cannot be confirmed. | Do not claim publication; preserve the review identity and manager-controlled action boundary.        | Keep reply unsent or show explicit send failure; manager may retry only through the supported reply action. | No automatic Agent reply publication or cross-review retry.                                         | Review reply owner / #388 manager module; `reviewUuid`, authenticated manager identity. | Expected; owner/verification path to be confirmed by #356 or the manager-module issue. |

## Semantic outcome rules

These rules apply across rows:

1. `missing`, `unavailable`, `truncated`, and `insufficient_evidence` are not synonyms for
   `contradicted`.
2. An Agent best-effort identity match is not a confirmed customer identity.
3. A parent booking request proves what was requested or selected; it does not prove execution.
4. A task or care record without a direct `booking_pets` foreign key must retain its bounded-window
   limitation in the evidence meaning.
5. No booking-specific care log may be read after an ambiguous, unresolved, unauthorized, stale, or
   truncated booking comparison.
6. Manager intervention is an exceptional business-review path; it is not a substitute for the
   Agent's bounded candidate comparison.
7. A planned row is not passed until #356 attaches execution evidence or an explicit blocker and
   owner.

## Handoff to #356

#356 should execute each applicable row and add an expected-versus-actual record containing:

- row ID;
- command, fixture, API request, browser path, or evaluation invocation;
- persisted state observed;
- API response observed;
- visible UI state observed;
- identity/correlation values;
- actual retry/manual-review behaviour;
- pass, mismatch, or blocked decision;
- owner and follow-up issue for a mismatch.

If an actual result differs from the expected row, #356 should not silently rewrite the expected
behaviour. It should record the mismatch and hand the producer, provider, persistence, booking,
task, or manager-module fix to its owning issue.

## Handoff to #430

#430 should review this matrix after #356 adds execution evidence, preserve blocked rows, and publish
the reviewed document with links to the focused tests, API/browser evidence, reviewer comments, and
accepted or merged PR state.

## Sources of truth

- Sprint Goal and manager journey: [#388](https://github.com/CS778-S2-2026-AWS-Challenge/Tropical_love_pet/issues/388)
- Failure-state parent: [#352](https://github.com/CS778-S2-2026-AWS-Challenge/Tropical_love_pet/issues/352)
- Matrix task: [#355](https://github.com/CS778-S2-2026-AWS-Challenge/Tropical_love_pet/issues/355)
- Execution child: [#356](https://github.com/CS778-S2-2026-AWS-Challenge/Tropical_love_pet/issues/356)
- Documentation child: [#430](https://github.com/CS778-S2-2026-AWS-Challenge/Tropical_love_pet/issues/430)
- Evidence Check module: [#219](https://github.com/CS778-S2-2026-AWS-Challenge/Tropical_love_pet/issues/219)
- Booking comparison card: [#434](https://github.com/CS778-S2-2026-AWS-Challenge/Tropical_love_pet/issues/434)
- Notification implementation boundary: [docs/manager-google-review-notifications.md](manager-google-review-notifications.md)
- Retired workflow and current Google Review behavior: [Google Review AI removal record](google-review-ai-removal-plan.md)
