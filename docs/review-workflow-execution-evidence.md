# Review Workflow Execution Evidence

Status: working evidence register for #356. This document records executed
evidence separately from the expected-behaviour contract in
`docs/review-workflow-failure-matrix.md`. A `pending` or `deferred` row is not
passed.

## Current execution boundary

- Real AI runtime uses local Ollama only: `qwen2.5-coder:14b` at
  `http://127.0.0.1:11434/api`.
- OpenAI is explicitly out of scope for this task.
- `TEST_DATABASE_URL` and the current PostgreSQL test harness are not part of
  this execution slice. RDS migration owns later persistence and API read-back
  verification.
- Synthetic tool/evidence fixtures may be used with the real Ollama model to
  verify Agent decisions without presenting synthetic data as production data.
- This artifact does not change the expected behaviour defined by #355.

## Evidence records

### EX-OLLAMA-001: synthetic multi-booking Agent probe

- Rows: FM-MATCH-002, FM-MATCH-004
- Provider: local Ollama, `qwen2.5-coder:14b`
- Command:

  ```bash
  LLM_BASE_URL=http://127.0.0.1:11434/api \
  LLM_MODEL=qwen2.5-coder:14b \
  LLM_API_KEY=ollama \
  RUN_MULTI_BOOKING_AGENT_MATCH=1 \
  node node_modules/vitest/vitest.mjs run \
    src/__tests__/google.review.investigation.agent.multi.booking.test.ts
  ```

- Result: 1 test file passed, 2 tests passed, duration 37.12 seconds.
- Observed behaviour:
  - uniquely supported booking candidate was selected;
  - a review without a booking-level clue remained `unresolved`;
  - the subject probe did not read stay records.
- Evidence class: real local provider with synthetic tool fixtures.
- Limitation: manager API persistence and manager UI read-back were not part of
  this probe.

### EX-OLLAMA-002: current PetHouse subject-match fixture

- Rows: FM-MATCH-001
- Provider: local Ollama, `qwen2.5-coder:14b`
- Command:

  ```bash
  LLM_BASE_URL=http://127.0.0.1:11434/api \
  LLM_MODEL=qwen2.5-coder:14b \
  LLM_API_KEY=ollama \
  RUN_PETHOUSE_AGENT_MATCH=1 \
  PETHOUSE_REVIEW_UUID=00000000-0000-4000-8000-000000000606 \
  node node_modules/vitest/vitest.mjs run \
    src/__tests__/google.review.investigation.agent.match.postgres.test.ts
  ```

- Result: the real Agent returned `no_reliable_match`; the existing test
  expected `best_effort_match` and failed.
- Read-only data check for the same review:
  - `pet_count = 1`;
  - `has_pet_owner = true`;
  - `eligible_booking_pet_count = 0`;
  - `has_eligible_stay = false`.
- Interpretation: the current paid-and-approved Evidence Check boundary does
  not support the existing test expectation. This is tracked in
  [#440](https://github.com/CS778-S2-2026-AWS-Challenge/Tropical_love_pet/issues/440).
- Evidence class: real local provider plus current read-only database state.
- Limitation: this is not a manager API/UI journey; #440 is a test fixture/
  expectation follow-up, not a request to weaken the server guard.

### EX-OLLAMA-003: current PetHouse non-pet-parent fixture

- Rows: FM-MATCH-001
- Provider: local Ollama, `qwen2.5-coder:14b`
- Command:

  ```bash
  LLM_BASE_URL=http://127.0.0.1:11434/api \
  LLM_MODEL=qwen2.5-coder:14b \
  LLM_API_KEY=ollama \
  RUN_PETHOUSE_AGENT_MATCH=1 \
  PETHOUSE_REVIEW_UUID=00000000-0000-4000-8000-000000000951 \
  node node_modules/vitest/vitest.mjs run \
    src/__tests__/google.review.investigation.agent.match.postgres.test.ts
  ```

- Result: 1 test file passed, 1 test passed. The fixture expected a non-pet-parent
  outcome and the Agent returned `no_reliable_match`.
- Evidence class: real local provider plus current read-only database state.
- Limitation: this is subject matching evidence only; it does not prove persistence,
  manager API, or manager UI behaviour.

### EX-OLLAMA-004: synthetic partial Evidence Check

- Rows: FM-EVIDENCE-002, FM-EVIDENCE-003, FM-EVIDENCE-004
- Provider: local Ollama, `qwen2.5-coder:14b`
- Invocation: one-off Node runner using Backend `createToolModel()` and the
  Agent `runGoogleReviewEvidenceCheck()` with a synthetic authorized stay,
  partial evidence, and a `communications-reader-unavailable` gap.
- Result: `outcome = success`, `evidenceCompleteness = partial`, duration about
  16 seconds.
- Observed behaviour:
  - the model returned an `issue` analysis;
  - the claim was `insufficient_evidence`, not `contradicted`;
  - the evidence assessment preserved the communication-reader gap;
  - no fabricated execution evidence was produced.
- Evidence class: real local provider with synthetic Evidence Check input.
- Limitation: persistence, manager API, and manager UI read-back were not part
  of this invocation. The explicit-opposite-record `contradicted` branch still
  needs a separate execution.

### EX-OLLAMA-005: synthetic explicit conflicting execution record

- Rows: FM-EVIDENCE-004
- Provider: local Ollama, `qwen2.5-coder:14b`
- Invocation: one-off Node runner using Backend `createToolModel()` and the
  Agent `runGoogleReviewEvidenceCheck()` with a review claim that the routine
  was not followed and a conflicting task record stating that it was completed.
- Result: two repeated runs returned `outcome = success` and
  `evidenceCompleteness = complete` with the same semantic mismatch:
  `claimStatus = contradicted`, while
  `evidenceAssessment.recommendedStatus = insufficient_evidence`.
- Evidence class: real local provider with synthetic Evidence Check input.
- Tracking: a follow-up issue for the inconsistent claim-level and
  assessment-level statuses is required before this row can be fully verified.

### EX-OLLAMA-006: controlled local provider outage

- Rows: FM-AGENT-001
- Provider boundary: Ollama adapter configured with an intentionally unavailable
  local endpoint at `http://127.0.0.1:1/api`; OpenAI was not used.
- Invocation: Agent subject-match probe with synthetic runtime and tool context.
- Result: typed failure with `reason = transport_error`, `retryable = true`, and
  the safe message `The subject matching provider failed before a bounded decision was produced.`
- Evidence class: real provider adapter failure with synthetic input.
- Limitation: this proves the Agent boundary mapping, not worker persistence or
  manager API read-back.

## FM row register

| Row             | Current evidence status    | Next evidence or dependency                                                                                                                                                        |
| --------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FM-REV-001      | partial boundary           | Deterministic missing/deleted context checks; persistence remains RDS-deferred.                                                                                                    |
| FM-REV-002      | partial boundary           | Context and scope mismatch contracts/tests; full runtime execution remains pending.                                                                                                |
| FM-REV-003      | partial boundary           | Dispatch stale/duplicate tests; persistence read-back remains RDS-deferred.                                                                                                        |
| FM-REV-004      | partial deterministic      | No-claims terminal Agent/worker boundary tests; manager projection read-back pending.                                                                                              |
| FM-REV-005      | partial deterministic      | Unclear-triage Agent/worker/UI boundary tests; manager API read-back pending.                                                                                                      |
| FM-NOTIFY-001   | deferred                   | RDS-backed transaction/read-back; no current DB harness work.                                                                                                                      |
| FM-NOTIFY-002   | partial contract/UI        | Notification target/recipient focused evidence; RDS read-back remains deferred.                                                                                                    |
| FM-NOTIFY-003   | deferred                   | RDS-backed authorization/read-back; focused route/UI evidence remains separate.                                                                                                    |
| FM-AGENT-001    | partial runtime            | Controlled local Ollama outage returned typed retryable transport_error; worker/API read-back remains deferred.                                                                    |
| FM-AGENT-002    | partial deterministic      | Malformed/invalid-tool failure tests; worker/API persistence read-back remains deferred.                                                                                           |
| FM-AGENT-003    | partial guardrail          | Review/evidence guardrail tests; full Ollama worker path remains pending.                                                                                                          |
| FM-MATCH-001    | mismatch: test expectation | #440 tracks fixture/expectation alignment; preserve fail-closed product boundary.                                                                                                  |
| FM-MATCH-002    | partial pass               | Real Ollama synthetic ambiguous/no-clue probe passed; API/UI read-back pending.                                                                                                    |
| FM-MATCH-003    | pending                    | Temporary real-Ollama 21-candidate diagnostic hit provider failure before a bounded decision; no pass claimed. Existing deterministic truncation tests remain supporting evidence. |
| FM-MATCH-004    | partial pass               | Real Ollama synthetic no-clue probe passed; API/UI read-back pending.                                                                                                              |
| FM-EVIDENCE-001 | deferred                   | RDS-backed stale/ineligible booking transition.                                                                                                                                    |
| FM-EVIDENCE-002 | partial pass               | Real Ollama partial Evidence Check preserved completeness and evidence gaps.                                                                                                       |
| FM-EVIDENCE-003 | partial pass               | Real Ollama preserved communications-reader-unavailable as a gap.                                                                                                                  |
| FM-EVIDENCE-004 | mismatch candidate         | Real Ollama consistently returned contradicted claim plus insufficient_evidence assessment; follow-up issue required.                                                              |
| FM-EVIDENCE-005 | blocked                    | Upstream manager task-generation/Live Care prerequisite.                                                                                                                           |
| FM-PERSIST-001  | deferred                   | RDS-backed preliminary/final persistence and recovery.                                                                                                                             |
| FM-PERSIST-002  | deferred                   | RDS-backed duplicate/stale/conflicting result read.                                                                                                                                |
| FM-REPLY-001    | deferred                   | RDS-backed reply persistence/read-back; current app-owned mock boundary remains documented.                                                                                        |

## Supporting focused checks

These checks support the row execution but do not replace real Ollama or
RDS-backed evidence:

- Agent package `npm test`: 93 contract tests and 82 runtime tests passed.
- Backend investigation/notification/reply focused run: 12 files, 77 tests passed.
- Backend notification/reply/API focused run: 5 files, 53 tests passed.
- Frontend investigation/detail/notification focused run: 4 files, 24 tests passed.
- Frontend notification/detail/SSE/store focused run: 5 files, 44 tests passed.
- Evidence artifact formatting and `git diff --check` passed.

## Tracking rule

- Confirmed actual-versus-expected mismatch: open a focused bug issue and link
  the affected FM rows and #356.
- Missing non-RDS prerequisite: open a blocker or test-gap issue with owner and
  prerequisite.
- RDS migration and later Bedrock provider integration are deferred handoffs,
  not current #356 product bugs.
- Do not mark a row passed from source inspection, a mock, or a pending run.
