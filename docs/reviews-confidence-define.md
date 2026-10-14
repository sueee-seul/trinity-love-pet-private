# Google Reviews: Summary and Triage Confidence Research Notes

> Version: v0.1 exploratory research
> Date: 2026-09-02
> Research Sample: About 90 readable public pet-care review texts

## 1. Scope

### Research Objective

This document defines two AI outputs for each Google review data entry:

1. Summarize the complete review into one single, untruncated summary sentence.
2. Initially triage the review into `issue`, `praise`, or `suggestion`, and assign a `high`, `medium`, or `low` confidence level.

This approach is based on how pet parents actually write reviews. The goal is not to integrate with the Google Places API's `reviewSummary`, nor to create a place-level summary of multiple reviews. Each review must be evaluated independently.

### Scope of Current Research

- Primarily focuses on public English reviews covering boarding, daycare, grooming, pet sitting, and pet hotel services.
- Focuses mainly on reviews from pet parents/customers.
- Only the text written by the reviewer is considered research material; platform-generated summaries, merchant replies, and marketing copy are excluded from the sample.
- Content identifiable as coming from a sitter, provider, or employee is not used as primary evidence for pet-parent wording.
- This is an exploratory manual review of about 90 posts, not a statistically representative sample, nor is it a model accuracy validation.

### Research Methodology and Limitations

I examined each post for rating, service type, review length, specific events, sentiment, whether improvement requests were made, whether it contained both praise and issues, and whether the reviewer explicitly stated they would use the service again or leave.

This sample has an obvious selection bias: reviews on Trustpilot represent people who proactively leave public reviews, which does not equal all customers; different platforms also have different invitation and ranking mechanisms. Reviews on marketplaces like Rover and Pawshake might also mix pet owners and sitters, so they cannot be directly treated as the same customer population. The conclusions below are only used to form the v0 prompt/rubric and do not claim to have calibrated the true probability of confidence.

## 2. Need Themes

### 2.1 Praise usually describes "peace of mind" rather than just saying the service is good

Common positive content includes:

- The pet is happy, relaxed, tired but in good condition when returning home, letting the parent know the care achieved the desired results.
- Staff are friendly, patient, and treat the pet like their own family, especially for senior, rescue, anxious, or special-needs pets.
- Photos, videos, cameras, daily updates, and response speed provide peace of mind.
- The environment is clean, safe, with plenty of activities, or grooming is done as expected.
- The booking, payment, and sitter-finding process is convenient, and the reviewer indicates they will book again or recommend it to others.

Therefore, while a simple `great service` can be judged as praise, the evidence is weak. The judgment of praise is much stronger if it also includes pet outcomes, care details, or willingness to use the service again.

### 2.2 Issues are usually "inconsistency between promises and actual outcomes"

The most common negative narratives are not abstract expressions of dissatisfaction, but descriptions of a service failure or specific consequence:

- The pet is sick, injured, very dirty, smells bad after returning home, or the parent feels health/safety was not properly handled.
- Paid grooming, baths, nail trims, playtime, medication, or feeding instructions were not completed, or the completed state is inconsistent with what was described.
- The pet cannot be seen on the camera, there are no photos/updates, or no status is provided during pickup/drop-off, causing the parent to be unable to confirm what the pet is doing.
- Staff don't answer the phone, are slow to reply, don't follow up, or their handling of a complaint makes the reviewer feel ignored.
- Booking, cancellation, pickup/drop-off, wait times, vaccine requirements, or extra charges are unclear, resulting in time or price being inconsistent with expectations.
- Issues with sitter matching, accounts, payments, verification, or app communication on the marketplace.

Issue reviews very often contain a complete timeline: when it was dropped off, what was originally paid for, what was seen/told during the stay, what was discovered upon pickup, and what response was received after contacting them. These details are more useful for triage evidence strength than the rating itself.

### 2.3 Suggestions are often hidden within an overall positive review

A suggestion is not simply a negative review, but the reviewer explicitly pointing out "what they hope will be changed in the future," such as:

- Overall very satisfied, but hope the pricing or service description is clearer.
- Staff are great, but hope for more updates, outdoor activities, camera coverage, or activity time for small dogs.
- The service itself is good, but hope to improve the app, booking process, phone response, or cancellation rules.

Common wording cues include `I wish...`, `would be better if...`, `please...`, `they should...`, `my only feedback is...`. If it only says "did not do well" without proposing a direction for improvement, it should be judged as an issue. Do not automatically judge it as a suggestion just because a negative review has a suggestive tone.

### 2.4 Mixed-intent is the norm, not the exception

The following combinations are common in the sample:

- High rating + one specific but unresolved issue.
- Low rating + a positive comment about a specific staff member.
- Praising the facility first, then saying the actual care outcome did not meet expectations.
- Saying it's overall great first, then adding a specific improvement request at the end.
- A single review discussing health, cleanliness, communication, and charging issues simultaneously.

Therefore, you cannot determine triage solely by rating, the first sentence, or the last sentence, nor can you just take the first sentence of the review for the summary.

### 2.5 Review length affects the amount of judgeable evidence, but grammar quality is not confidence

- A single sentence like `excellent service` or `never again` can show direction, but lacks sufficient context to support high confidence.
- Detailed narratives can usually identify the service target, events, outcomes, and degree of resolution, making them more suitable for high confidence.
- Spelling, grammar, emojis, colloquialisms, or emotional expressions should not directly lower confidence; as long as the main intent and events are clear, it can still be judged high.
- Only content with just a rating, blank text, extreme vagueness, sarcasm, or mutually contradictory statements falls under insufficient evidence.

### 2.6 Rating is an auxiliary signal, not a triage label

The rating can help understand the overall tendency, but cannot override the review text:

- 4 or 5 stars may still contain specific issues that need addressing.
- 1 or 2 stars may still praise a specific staff member, but the overall main intent is still an issue.
- When the rating conflicts with the text, the conflict should be preserved and confidence lowered, rather than forcefully choosing one.

## 3. Competitor Weak Points

The "weak points" here are service frictions that repeatedly appear across public review sources, not quality conclusions about any single company.

| Repeated Friction              | How reviewers typically describe it                                                                   | Meaning for triage                                                                            |
| :----------------------------- | :---------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| Care visibility                | Can't see the camera, too few photos, no daily updates, don't know if the pet is actually active      | Mostly an issue; if explicitly requesting more updates or coverage, judge as suggestion       |
| Promised vs delivered service  | Paid for grooming, playtime, bath, medication, or specific care, but results didn't match             | Specific and verifiable issue, usually can be high                                            |
| Health, cleanliness and safety | Sick, injured, smells, dirty, poor condition upon pickup                                              | Prioritize as issue; do not write the reviewer's speculation as a confirmed fact              |
| Communication and recovery     | Can't get through on the phone, slow replies, no status updates, no follow-up on complaints           | Common evidence of an issue; if only requesting better contact methods, might be a suggestion |
| Booking, pickup and pricing    | Booking failed, waiting, cancellation rules, extra fees or service prices unclear                     | Specific time/amount/process details can increase confidence                                  |
| Trust and fit                  | Whether senior, rescue, anxious, or special-needs pets are understood; whether the sitter is reliable | Often forms praise when positive; usually an issue when care needs are not met                |

## 4. Switching Triggers

### 4.1 Explicit departure signals

The following expressions are not just ordinary negative emotions, but signals that can serve as priorities for follow-up handling:

- `never again`, `will not return`, `would not recommend`.
- Canceling subsequent bookings, stopping the use of a certain plan, stating they will find another service.
- Trust broken due to health/safety, uncompleted care, or repeated communication failures.

This type of wording still needs to be preserved as the reviewer's claim. Do not write responsibility or medical causality as verified facts in the summary.

### 4.2 Retention and recommendation signals

The following expressions are usually strong evidence for praise:

- Will book again, have already repeatedly used, pet actively looks forward to returning.
- Explicitly saying staff gave them peace of mind, or the pet returned home happy, healthy, and relaxed.
- Willing to recommend to other pet parents, accompanied by specific care or communication details.

### 4.3 Suggestions are improvement signals for "not yet departed"

A review might still give a high score and express willingness to return, while simultaneously leaving requests to improve pricing, updates, activities, or processes. Such content should not be masked by the positive tone of the summary; if the improvement request is the main actionable content of the review, the triage should be judged as `suggestion`.

## 5. So What?

### 5.1 v0 triage decision order

For every review, read the entire text first, then judge in the following order. Ratings can only serve as a supplement and must not trigger classification on their own.

1. **First, look for specific negative outcomes or service failures.** If the core of the review is worsened pet condition, uncompleted paid services, important instructions not followed, or booking/communication/charging errors, judge as `issue`. Even if the same review also praises staff, focus on the primary actionable failure.
2. **When there's no major service failure, look for explicit improvement requests.** If the reviewer explicitly requests adding, modifying, or improving something in the future, judge as `suggestion`. An `I wish...` in a positive review is still a suggestion.
3. **If neither of the above signals is present and the overall experience is positive, judge as `praise`.** It's best to have at least one specific supporting point, such as pet outcomes, care details, updates/photos, staff behavior, or willingness to use again.
4. **Do not guess when evidence is insufficient.** For reviews with only a rating, blank content, incomprehensible short sentences, obvious sarcasm, or multiple intents where primary/secondary cannot be distinguished, `triageType` should be allowed to be `null` and confidence `low`, leaving it for manual handling; do not disguise an empty 5-star review directly as high-confidence praise.

### 5.2 Actual judgment method for Confidence

Confidence in v0 is not a statistical number meaning "the model has an 80% chance of being correct," but an explainable grading based on evidence sufficiency. Actual judgment relies on four signals:

- **Intent cue:** Whether the reviewer directly expresses praise, complaints, or improvement requests.
- **Concrete support:** Whether they explain the service, target, events, outcomes, or observable details.
- **Primary-intent clarity:** Whether the primary actionable point can be identified in mixed content.
- **Conflict/ambiguity:** Conflicts between rating and text, positive and negative intents being close in the same review, sarcasm, negation, or the degree of text insufficiency.

| Confidence | Judgment Conditions                                                                                                                                                | Typical Examples                                                                                                                                                                                                                                                     |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `high`     | Clear primary intent, with at least one concrete support; no conflicts sufficient to change classification                                                         | Wrote about uncompleted paid service and specific outcomes upon pickup → `issue/high`; wrote about daily photos, pet in good condition, and will book again → `praise/high`; explicitly said overall is great but hopes to add a certain feature → `suggestion/high` |
| `medium`   | Direction can be roughly inferred, but there is only one weak signal, content is very short, slight mixing of intents, or rating and text are not fully consistent | Only wrote `bad communication`; long text mostly praising but with an unclear improvement request at the end; 4 stars but text has both positive and negative details                                                                                                |
| `low`      | Insufficient text, only rating, extremely vague/sarcastic, primary intent indistinguishable, or positive/negative signals cancel each other out                    | Blank review; `fine`; `great... not` but semantics indistinguishable; simultaneously lists equal amount of issues and suggestions with no primary/secondary                                                                                                          |

### 5.3 Boundaries that prompts/outputs should maintain

The summary prompt should ask the model to:

- Use the complete review content, do not do first-sentence truncation.
- Only summarize what the reviewer actually said, do not add external knowledge, do not quote merchant replies.
- Preserve important qualifiers, such as `I think`, `seems`, `was told`, `in my experience`.
- Do not rewrite allegations, speculations, medical causality, attribution of responsibility, or legal claims as facts.
- Output only one primary summary and one initial triage per review; do not merge multiple reviews into a place-level summary.

Result shape adoptable for the first version:

```json
{
  "summary": "One sentence summarising the reviewer’s overall experience and most important supporting detail.",
  "triageType": "issue | praise | suggestion | null",
  "triageConfidence": "high | medium | low"
}
```

`triageConfidence` only indicates "whether current evidence is sufficient to support this initial classification." It is not a verified prediction accuracy rate and should not be used directly as a basis for automatic handling or determining responsibility.

### 5.4 Conclusion for this version

Currently, the most stable design is: `issue` looks at concrete failure/negative outcome, `suggestion` looks at explicit improvement requests, `praise` looks at positive experience and supporting detail; when encountering insufficient evidence, keep `null + low`, do not forcefully fill the classification using the rating.

However, this corpus of about 90 reviews is still insufficient for formal calibration. Later, if high/medium/low are to be used as reliable triage gates, a manually annotated dataset must be established at a minimum. Two reviewers should independently annotate type, primary intent, and confidence, then compare disagreements, and finally adjust prompts and thresholds.

## 6. Next Step Options

1. First, use this v0 rubric to write a prompt and establish a small set of manually annotated regression examples.
2. Later, supplement with at least 200 pet-parent reviews, then compare classification differences across different service types and ratings.
3. After accumulating internal review data, incorporate reviewer correction records of AI triage as true calibration data.
4. Maintain `low + manual review` before calibration, and do not let confidence directly trigger automatic replies, deletions, or responsibility determinations.

## References

- [Trustpilot: Pet Paradise reviews](https://www.trustpilot.com/review/petparadise.com)
- [Trustpilot: Pawshake reviews](https://www.trustpilot.com/review/pawshake.com)
- [Trustpilot: Rover.com reviews](https://www.trustpilot.com/review/rover.com)
- [Birdeye: The Grooming Room Pet Resort reviews](https://birdeye.com/the-grooming-room-pet-resort-169481691227318)
- [Birdeye: Bark & Board reviews](https://birdeye.com/bark-and-board-brookhaven-153936656938623)
- [Birdeye: Boarding & Beyond reviews](https://reviews.birdeye.com/boarding-beyond-147066149667324)
- [Pethotel: customer reviews from pet owners](https://pethotel.io/en/customer-reviews)
- [Research context: dog-hotel customer review dimensions](https://doi.org/10.1007/s11628-026-00602-z)

> The number of reviews, sorting, and visible content on the source pages will change; the research conclusions in this document should be based on the scope of this manual reading, and the aggregate score of the source pages should not be treated as the statistical result of this corpus.
