# Feedback Workflow Fixtures

This is a research-only fixture set for evaluating feedback intent, operational priority, risk, and handling effort.

It is a research-only document and does not define the runtime PostgreSQL feedback dataset. The existing
records keep their original `type`; `Gold primary intent` is an owner-approved working label derived
from the review text.

## Mapping rules

| Priority | Meaning                                                                        | Default handling                                                    |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| P0       | Immediate welfare, safety, health, or serious incident risk                    | Human owner now; investigate and record remedy                      |
| P1       | Confirmed service failure, promise gap, billing dispute, or material complaint | Assigned complaint case with response and follow-up                 |
| P2       | Service improvement request without current harm                               | Batch triage by Operations or the relevant owner                    |
| P3       | Praise or low-risk positive signal                                             | Low-touch acknowledgement; batch sharing or recognition when useful |

`Gold primary intent` is derived from the review content using the definitions in [`docs/feedback-system.md`](feedback-system.md). It can differ from the parent-selected or evaluation `type` when the text contains a stronger service, welfare, or remedy signal. It is a working evaluation target, not a claim about the real provider outcome.

## Existing candidate feedback

These twelve records are research/evaluation examples. The second five come from
`Backend/src/__tests__/llm.evaluation.test.ts` and retain their original evaluation input type.

| ID                             | Source type | Gold primary intent | Secondary signals                          | Priority | Classification note                                                                                                                          |
| ------------------------------ | ----------- | ------------------- | ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `mock-1`                       | Praise      | Praise              | Positive practice                          | P3       | Strong satisfaction and appreciation for daily stories/photos. No investigation; optional team sharing.                                      |
| `mock-2`                       | Issue       | Complaint           | Grooming quality, staff conduct            | P1       | Grooming failure and dog returned wet. Review service record and consider remedy.                                                            |
| `mock-3`                       | Issue       | Complaint           | Grooming quality, staff conduct, billing   | P1       | Poor grooming experience and rude follow-up. Assign complaint owner and assess response.                                                     |
| `mock-4`                       | Praise      | Praise              | Positive care practice                     | P3       | Tailored care for a dog with arthritis is a recognition/training signal, not a complaint case.                                               |
| `mock-5`                       | Issue       | Complaint           | Suggestion, welfare, overcrowding          | P1       | Reclassified from `Suggestion`: anxiety, overcrowding, and distress are stronger than the proposed improvement. The suggestion is secondary. |
| `ab_test_1_grooming_issue`     | Issue       | Complaint           | Grooming quality, staff conduct, billing   | P1       | Grooming quality, staff conduct, and credit handling require service-recovery review.                                                        |
| `ab_test_2_farm_run_issue`     | Issue       | Complaint           | Promise gap, welfare, safety               | P1       | Promised farm-run service was not consistently delivered and the text includes trust and welfare concerns.                                   |
| `ab_test_3_smell_overcrowding` | Suggestion  | Complaint           | Suggestion, welfare, environment           | P1       | Overcrowding, persistent barking, cramped cat housing, and poor cleanliness require complaint assessment.                                    |
| `ab_test_4_bitten_dog`         | Issue       | Complaint           | Safety incident, ignored instruction       | P0       | Bite wounds, an ignored separation request, and missing incident reporting require immediate human handling.                                 |
| `ab_test_5_cattery_critique`   | Suggestion  | Complaint           | Praise, Suggestion, welfare, communication | P1       | Positive comments coexist with space/welfare concerns and a request for better cat updates. Complaint is primary under the harm-first rule.  |
| `mock-6`                       | Suggestion  | Suggestion          | Communication                              | P2       | Clean runtime Suggestion; evaluate update frequency, staff effort, and possible quick improvement.                                           |
| `mock-7`                       | Suggestion  | Suggestion          | Intake clarity                             | P2       | Clean runtime Suggestion; evaluate whether a first-day checklist is a low-effort Operations improvement.                                     |

## Staff/manager handling examples for the ten review texts

These examples apply the approved text-based intent definition to the ten existing review texts. They describe the internal admin workflow only; they do not define a parent-facing progress experience.

| ID                             | Gold primary intent | Staff/manager workflow                                            | Decision or next action                                                                               |
| ------------------------------ | ------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `mock-1`                       | Praise              | No Complaint progress. Optional positive-practice review.         | Acknowledge or share the daily-story/photo practice; no case owner required.                          |
| `mock-2`                       | Complaint           | Complaint progress: review service record and response/remedy.    | Check grooming context and determine service-recovery response.                                       |
| `mock-3`                       | Complaint           | Complaint progress: review quality, conduct, and payment context. | Assign complaint owner; assess remedy and staff follow-up.                                            |
| `mock-4`                       | Praise              | No Complaint progress. Optional recognition/training review.      | Share the activity/rest adjustment as a repeatable care practice.                                     |
| `mock-5`                       | Complaint           | Complaint progress: welfare and onboarding review.                | Investigate distress and overcrowding; retain the owner-stay idea as a secondary Suggestion.          |
| `ab_test_1_grooming_issue`     | Complaint           | Complaint progress: service recovery and billing/credit review.   | Review grooming quality, staff conduct, and credit handling.                                          |
| `ab_test_2_farm_run_issue`     | Complaint           | Complaint progress: promise-gap and welfare review.               | Compare the promised farm-run service with actual records and assign follow-up.                       |
| `ab_test_3_smell_overcrowding` | Complaint           | Complaint progress: environment and welfare review.               | Assess overcrowding, barking, cat housing, and cleanliness; do not send to Suggestion-only review.    |
| `ab_test_4_bitten_dog`         | Complaint           | Immediate safety Complaint handling.                              | Prioritise human review, incident records, separation instruction, and remedy.                        |
| `ab_test_5_cattery_critique`   | Complaint           | Complaint-first review with secondary Praise/Suggestion signals.  | Assess space and welfare concerns first; retain cat updates as a possible improvement decision later. |

### Coverage conclusion

After applying the text-based definition, the ten existing review texts contain no clean primary Suggestion example. The three records whose source/evaluation type is `Suggestion` are either Complaint-like or mixed. The three synthetic Suggestion fixtures below are therefore the current clean examples for the staff-side Suggestion workflow.

| Synthetic fixture         | Staff-side example flow                              | Decision example                                                                                |
| ------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `synthetic_suggestion_01` | Captured → Under Review → Decision Recorded → Closed | `Quick Improvement` if update-frequency options can be added without material staff burden.     |
| `synthetic_suggestion_02` | Captured → Under Review → Decision Recorded → Closed | `Quick Improvement` if a clearer intake checklist can be added to existing booking information. |
| `synthetic_suggestion_03` | Captured → Under Review → Decision Recorded → Closed | `Pilot` a quiet arrival window; record the trial scope and next review date.                    |

## Five targeted synthetic fixtures

These cases fill the missing low-effort Praise and clean Suggestion coverage. They are synthetic and should only be used for workflow and UI branch testing.

### `synthetic_praise_01`: simple appreciation

> Everyone was so kind at drop-off and pick-up. My dog came home happy and settled. Thank you for taking such good care of him.

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| Gold primary intent | Praise                                                             |
| Priority            | P3                                                                 |
| Risk                | None identified                                                    |
| Investigation       | No                                                                 |
| Remedy              | No                                                                 |
| Handling            | Automatic or templated thank-you; close or batch for weekly review |

### `synthetic_praise_02`: praise with a reusable practice

> The team noticed that my senior dog was tired after play and adjusted the rest periods without me asking. The updates were thoughtful and made me feel confident leaving her there.

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Gold primary intent | Praise                                                                    |
| Priority            | P3                                                                        |
| Risk                | None identified                                                           |
| Investigation       | No                                                                        |
| Remedy              | No                                                                        |
| Handling            | Thank the parent; optionally share the rest-period practice with the team |

### `synthetic_suggestion_01`: communication improvement

> It would be helpful if parents could choose whether they want one photo update or several updates during the stay when they make the booking.

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| Gold primary intent | Suggestion                                                                            |
| Priority            | P2                                                                                    |
| Risk                | None identified                                                                       |
| Investigation       | No                                                                                    |
| Remedy              | No                                                                                    |
| Handling            | Add to the communication-improvement queue and evaluate frequency, effort, and impact |

### `synthetic_suggestion_02`: intake improvement

> A short checklist showing what to bring for a first daycare visit would make the drop-off easier. I was not sure whether food, medication, and a favourite toy should be packed.

| Field               | Value                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Gold primary intent | Suggestion                                                                                   |
| Priority            | P2                                                                                           |
| Risk                | None identified                                                                              |
| Investigation       | No                                                                                           |
| Remedy              | No                                                                                           |
| Handling            | Route to Operations; decide whether a checklist or clearer booking information is worthwhile |

### `synthetic_suggestion_03`: service design improvement

> Could you offer a quiet arrival window for dogs that are nervous around crowds? It would make the first visit feel less overwhelming for them and for their owners.

| Field               | Value                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Gold primary intent | Suggestion                                                                                                      |
| Priority            | P2                                                                                                              |
| Risk                | No incident described                                                                                           |
| Investigation       | No, unless related incidents are found in other feedback                                                        |
| Remedy              | No                                                                                                              |
| Handling            | Batch with other onboarding and anxious-dog improvement requests; promote to P1 if repeated harm reports appear |

## Coverage after adding these fixtures

| Coverage area                   |                   Current candidate set |    After targeted fixtures |
| ------------------------------- | --------------------------------------: | -------------------------: |
| Praise                          |                                       2 |                          4 |
| Clean, low-risk Suggestion      |                                       0 |                          3 |
| Complaint / Issue               | 5 or more, including high-risk examples | Existing coverage retained |
| Mixed or misclassified feedback |                              At least 3 | Existing coverage retained |
| Low-touch P3 handling           |                        Underrepresented |         Explicitly covered |
| Batch-evaluation P2 handling    |                        Underrepresented |         Explicitly covered |

## Product boundary

This fixture set supports a raw-type and content-based intent split:

- `Source type` preserves the parent-selected or evaluation input.
- `Gold primary intent` is classified from review text using the approved boundary.
- Complaint-like records use the existing complaint progress concept.
- Clean Suggestions should enter scheduled evaluation, not `Fact Check` and `Response Sent`.
- Praise should use low-touch acknowledgement and optional recognition, not a complaint progress page.
- A parent-selected type never overrides an explicit welfare, safety, harm, or remedy signal.
