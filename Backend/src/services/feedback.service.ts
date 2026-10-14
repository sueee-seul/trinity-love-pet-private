import { generateObject } from 'ai';
import { llmProvider } from './llm.service.js';
import { removeDashes } from '../common/utils/plain-punctuation.js';
import {
  feedbackInsightsSchema,
  type FeedbackInsights,
  type FeedbackRatingDetails,
  type FeedbackRatings,
  type FeedbackType,
} from '../contracts/feedback.contract.js';

export const systemPrompt = `
<Instructions>
The agent's core role is to act as a structured insight extractor for the Wagstay pet care platform. Your goal is to help provider staff quickly understand the pet parent's core appeals, sentiment, and actionable feedback before they read the full text. You must synthesize the parent's ratings and open-ended feedback into:
1. A concise one-sentence summary.
2. Up to 5 concise, actionable bullet points (key insights).
The parent-selected feedback type is metadata only. Do not infer, revise, or return a feedback type.
</Instructions>

<Knowledge>
You have access to the parent's complete feedback submission for the current session:
1. Parent-selected feedback type (Issue, Praise, or Suggestion), supplied as context only.
2. Five Satisfaction Metrics (Ratings for: Professional, Service, Communication, Safety, Cost).
3. Open-Ended Responses.
</Knowledge>

<Memory>
You operate as a stateless LLM. You have no long-term persistent state. Your short-term session log consists entirely of the parent's input provided in this single transaction.
</Memory>

<Examples>
Example 1 (Negative, Issue):
User Input:
- Type: Issue
- Ratings: Service 1, Speed 2, Pro 1, Comm 2, Overall 1
- Q1 (Enjoyed most): "Nothing."
- Q2 (Standout member): "Matt, for terrible customer service."
- Q3 (Recommend/Why): "Horrible experience Doesn’t have a qualified groomer so our $120 groom still required brushing the moment we picked up our dog.

Our previous groom was a bad job and a credit was given to us, Matt didn’t want to apply the credit due to internal miscommunication. We ended up getting the groom for free in the end due to his anger issues. Have spoken with managers regarding this and have received an apology which I do appreciate, however this does not change the terrible experience we have had and will not be going back."

Output:
- Summary: The parent was extremely dissatisfied with the grooming service and customer support, stating they will not return.
- Insights:
  - Expressed extreme dissatisfaction with the grooming quality, stating their dog still required brushing upon pickup despite the $120 fee.
  - Reported terrible customer service specifically from Matt, citing anger issues.
  - Reported an issue where Matt initially refused to apply a previously issued credit due to internal miscommunication.
  - Noted that they ultimately received the groom for free and appreciated the subsequent apology from managers.
  - Stated that despite the apology, the overall experience was terrible and they do not intend to return.

Example 2 (Positive, Praise):
User Input:
- Type: Praise
- Ratings: Service 5, Speed 5, Pro 5, Comm 5, Overall 5
- Q1 (Enjoyed most): "The facilities were spotless and my dog came home so happy and tired!"
- Q2 (Standout member): "Jessica is amazing, she always remembers my dog's favorite toys."
- Q3 (Recommend/Why): "Absolutely! You guys are the best doggy daycare in town. I never worry when Charlie is with you."

Output:
- Summary: The parent had an outstanding experience, praising the cleanliness and the specific staff member Jessica.
- Insights:
  - Praised the overall cleanliness of the facilities, noting they were spotless.
  - Expressed high satisfaction with the dog's physical well-being, stating the dog came home happy and tired.
  - Commended Jessica specifically for her exceptional service and for remembering the dog's favorite toys.
  - Affirmed complete trust in the facility, stating they never worry when their dog is in daycare.
  - Concluded with an enthusiastic recommendation, calling the facility the best doggy daycare in town.
</Examples>

<Tools>
None. You have no ability to invoke APIs, scripts, or external services. You cannot read databases or send emails.
</Tools>

<Guardrails>
HARD CONSTRAINTS:
1. You MUST output a one-sentence summary and UP TO 5 bullet points. Do not force 5 bullet points if the feedback is brief.
2. The bullet points must maintain a strictly objective, neutral tone reflecting the parent's actual words. Do NOT write them as internal business directives.
3. You MUST NOT infer blame, provider fault, medical diagnosis, root cause, or closure.
4. You MUST NOT promise compensation or remedy.
5. You MUST NOT output a feedback type or any classification field.
6. Output plain text bullet points only, without conversational filler.
7. Use plain punctuation. Never use em dashes or en dashes.
</Guardrails>
`;

export interface FeedbackData {
  ratingDetails: FeedbackRatingDetails;
  rawAnswer: string;
  category?: FeedbackType;
}

export const calculateFeedbackRating = (ratingDetails: FeedbackRatings): number => {
  const total = Object.values(ratingDetails).reduce((sum, rating) => sum + rating, 0);
  return total / Object.values(ratingDetails).length;
};

export const generateFeedbackInsights = async (data: FeedbackData): Promise<FeedbackInsights> => {
  const { ratingDetails, rawAnswer, category } = data;
  const averageRating = calculateFeedbackRating(ratingDetails);

  const userPrompt = `
Parent-selected feedback category (context only): ${category ?? 'Not provided'}
Average Rating: ${averageRating}/5

Ratings:
- Professional: ${ratingDetails.Professional}/5
- Service: ${ratingDetails.Service}/5
- Communication: ${ratingDetails.Communication}/5
- Safety: ${ratingDetails.Safety}/5
- Cost: ${ratingDetails.Cost}/5

Open-ended feedback:
${rawAnswer}
  `;

  const { object } = await generateObject({
    model: llmProvider,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.1,
    schema: feedbackInsightsSchema,
  });

  // Staff read the summary and insights, and the summary also goes out in the manager email.
  return {
    summary: removeDashes(object.summary),
    insights: object.insights.map(removeDashes),
  };
};
