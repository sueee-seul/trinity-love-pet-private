import { describe, it, expect, afterAll } from 'vitest';
import { generateObject } from 'ai';
import fs from 'fs';
import path from 'path';
import { llmProvider } from '../services/llm.service.js';
import { feedbackInsightsSchema } from '../contracts/feedback.contract.js';
import { systemPrompt } from '../services/feedback.service.js';

const SINGLE_QUESTION = [
  'The feedback you can consider:\n1. What did you like most about your experience with our service?\n2. Was there anything that made you feel concerned or dissatisfied about your pet’s care?\n3. How could we improve your experience in the future?',
];

const testCases = [
  {
    id: 'ab_test_1_grooming_issue',
    activeTab: 'Issue',
    questions: SINGLE_QUESTION,
    averageRanking: 1.5,
    ratings: { Professional: 1, Service: 1, Communication: 2, Safety: 3, Cost: 2 },
    answers: [
      'Horrible experience Doesn’t have a qualified groomer so our $120 groom still required brushing the moment we picked up our dog. Terrible customer service from Matt. Our previous groom was a bad job and a credit was given to us, Matt didn’t want to apply the credit due to internal miscommunication. We ended up getting the groom for free in the end due to his anger issues. Have spoken with managers regarding this and have received an apology which I do appreciate, however this does not change the terrible experience we have had and will not be going back.',
    ],
  },
  {
    id: 'ab_test_2_farm_run_issue',
    activeTab: 'Issue',
    questions: SINGLE_QUESTION,
    averageRanking: 2,
    ratings: { Professional: 2, Service: 2, Communication: 1, Safety: 1, Cost: 2 },
    answers: [
      'We have a high energy dog who went here once per week for socialisation and exercise. We will not be taking our dog back here again. We had an issue where before he was going on the farm runs each time he went then it stopped and he came home not tired at all. We had a talk to the manager and he assured us there were no problems with him and that he would have a farm run each time he came. He went on 1 farm run since then, then obviously not the last three times (from photos and his energy levels when he came home). The last time we took him, he was scared to go in, and from the photos, we have seen some dogs on choker leads on their runs. If you think from their advertising that your dog will get to run free and have a farm run every day they are there, you are mistaken.',
    ],
  },
  {
    id: 'ab_test_3_smell_overcrowding',
    activeTab: 'Suggestion',
    questions: SINGLE_QUESTION,
    averageRanking: 2.5,
    ratings: { Professional: 4, Service: 2, Communication: 3, Safety: 2, Cost: 3 },
    answers: [
      'The place absolutely stinks!!! My customer feedback to the new owners would be to reduce the obvious overcrowding of dogs and to not have dogs opposite cats barking at the cats 24/7 as they will end up traumatized. The barking is extremely loud in the cats "room", where the cats are housed in quite small wooden boxes. Im surprised they didn’t consider the effect of dogs barking at the cats all day and night personally but there is an appearance that the facility is very dog-centric so maybe cats are not a priority. Also more work on cleanliness will help with the dreadful smell. The staff are lovely though and its very handy to get to.',
    ],
  },
  {
    id: 'ab_test_4_bitten_dog',
    activeTab: 'Issue',
    questions: SINGLE_QUESTION,
    averageRanking: 1,
    ratings: { Professional: 1, Service: 1, Communication: 1, Safety: 1, Cost: 1 },
    answers: [
      'Do not send your dog here! My dog stayed here when we were on holiday. I got a phone call from them that she was not eating and acting strangely. I asked them to separate her from the other dogs for the rest of pur trip as she was not being her normal self. They chose to ignore my requests and put her in the concrete pens with other dogs. She ended up in a fight with bite wounds. Her nail was worn down to a bloody stump. They made us pay the other dogs vet bill and no actual report of what happened. The girl when I picked her up did not know what breed my dog was and gave me explanation about alpha’s and dominance and pack order. This isn’t the wild and she is our baby. I wasn’t going to post but I came across the reviews and feel people need to know. These places are only out to make money at the expense of your loved one. They could be very miserable when you are thinking they are having a great time.',
    ],
  },
  {
    id: 'ab_test_5_cattery_critique',
    activeTab: 'Suggestion',
    questions: SINGLE_QUESTION,
    averageRanking: 3,
    ratings: { Professional: 4, Service: 3, Communication: 2, Safety: 3, Cost: 2 },
    answers: [
      'Firstly, I want to acknowledge and say how good the staff are to deal with and how lovely and clean the facilities that I saw were. My review and score only relate to the cattery. My three stars are for the staff and the cleanliness as a whole. It’s very apparently that Bark Avenue feels like a kennel, with a small cattery attached. During the 10 days I had cats staying there, there wasn’t a single photo or post on Facebook about the cats, but multiple a day about the dogs. The "deluxe unit" for two cats are small for the price (about the size of a double kitchen cupboard with two shelves on each side, which is a lot smaller than other places that charge less). Our taller, larger cat couldn’t sit up comfortably, so I’m not sure how he found using the litter tray in such a confined space . The open area is about the size of a living room. It is clean and tidy and modern looking, but I imagine when it is full it is quite crowded. I’m unsure if they alternate "yard time" (time outside their cages) or whether all cats boarding are let out at the same time. You can also definitely hear the dogs barking from inside the cattery. I will say that my cats looked lovely, and well taken care of, but unfortunately there were a few things (as above) that would likely see me not return. I do hope they take this as constructive criticism, as it is intended.',
    ],
  },
];

const results: Record<string, unknown> = {};

describe.skipIf(!process.env.RUN_LLM_EVALS)('LLM Evaluation Tests (Guardrail Adherence)', () => {
  afterAll(() => {
    const outputPath = path.resolve(__dirname, '../../llm-eval-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n✅ LLM Evaluation results saved to: ${outputPath}\n`);
  });

  testCases.forEach((testCase) => {
    it(`should successfully generate neutral bullet points for: ${testCase.id}`, async () => {
      const userPrompt = `
Feedback Type: ${testCase.activeTab}
Average Rating: ${testCase.averageRanking}/5

Ratings:
- Professionalism: ${testCase.ratings.Professional}/5
- Service: ${testCase.ratings.Service}/5
- Communication: ${testCase.ratings.Communication}/5
- Safety: ${testCase.ratings.Safety}/5
- Cost: ${testCase.ratings.Cost}/5

Open-ended feedback:
${testCase.questions.map((q, i) => `Q: ${q}\nA: ${testCase.answers[i] || 'No answer'}`).join('\n\n')}
      `;

      // Call the LLM
      const { object } = await generateObject({
        model: llmProvider,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.1,
        schema: feedbackInsightsSchema,
      });

      // Save for review
      results[testCase.id] = {
        inputQuestions: testCase.questions,
        inputAnswers: testCase.answers,
        output: object,
      };

      // Assertions
      expect(object.summary).toBeTypeOf('string');
      expect(object.summary.length).toBeGreaterThan(0);

      expect(object.insights).toBeInstanceOf(Array);
      expect(object.insights.length).toBeLessThanOrEqual(5);
      object.insights.forEach((insight) => {
        expect(typeof insight).toBe('string');
        expect(insight.length).toBeGreaterThan(0);
      });
    }, 60000); // 60 second timeout per test
  });
});

describe('LLM output contract', () => {
  it('does not instruct the LLM to infer or return a feedback type', () => {
    expect(systemPrompt).toContain('Suggestion');
    expect(systemPrompt).not.toMatch(/inferred feedback type/i);
  });

  it('accepts only summary and up to five insights', () => {
    const validOutput = { summary: 'A concise summary.', insights: ['One insight.'] };

    expect(feedbackInsightsSchema.safeParse(validOutput).success).toBe(true);
    expect(feedbackInsightsSchema.safeParse({ ...validOutput, type: 'Issue' }).success).toBe(false);
    expect(
      feedbackInsightsSchema.safeParse({
        ...validOutput,
        insights: ['1', '2', '3', '4', '5', '6'],
      }).success,
    ).toBe(false);
  });
});
