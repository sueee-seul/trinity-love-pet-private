import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { Pool } from 'pg';

if (existsSync('.env.local')) {
  process.loadEnvFile?.('.env.local');
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for the parent feedback persistence E2E');
}

const pool = new Pool({
  connectionString: testDatabaseUrl,
  max: 2,
  connectionTimeoutMillis: 5_000,
});

const parentContext = {
  petUuid: '00000000-0000-4000-8000-000000000501',
  petOwnerUuid: '00000000-0000-4000-8000-000000000101',
};

const ratingDetails = {
  Professional: 5,
  Service: 4,
  Communication: 3,
  Safety: 4,
  Cost: 4,
};

interface FeedbackApiResponse {
  uuid: string;
  pet_uuid: string;
  pet_owners_uuid: string;
  category: string;
  rating: number;
  rating_details: typeof ratingDetails;
  raw_answer: string;
  transcript: string | null;
  audio_url: string | null;
  ai_insights: {
    summary: string;
    insights: string[];
  };
}

interface FeedbackDatabaseRow {
  uuid: string;
  pet_uuid: string;
  pet_owners_uuid: string;
  category: string;
  current_status: string;
  rating: string;
  rating_details: typeof ratingDetails;
  raw_answer: string;
  transcript: string | null;
  audio_url: string | null;
  ai_insights: FeedbackApiResponse['ai_insights'];
}

const chooseRating = async (
  page: Page,
  category: keyof typeof ratingDetails,
  value: number,
): Promise<void> => {
  const row = page.getByText(category, { exact: true }).locator('..');
  await row
    .locator('svg')
    .nth(value - 1)
    .click();
};

const findFeedbackIds = async (
  feedbackUuid: string | undefined,
  rawAnswer: string,
): Promise<string[]> => {
  const result = await pool.query<{ uuid: string }>(
    `SELECT uuid::text AS uuid
     FROM feedback
     WHERE (
       NULLIF($1, '') IS NOT NULL AND uuid::text = $1
     ) OR (
       pet_uuid = $2::uuid
       AND pet_owners_uuid = $3::uuid
       AND raw_answer = $4
     )`,
    [feedbackUuid ?? '', parentContext.petUuid, parentContext.petOwnerUuid, rawAnswer],
  );

  return result.rows.map((row) => row.uuid);
};

const cleanupFeedback = async (
  feedbackUuid: string | undefined,
  rawAnswer: string,
): Promise<void> => {
  const client = await pool.connect();
  let deletedIds: string[] = [];

  try {
    await client.query('BEGIN');
    const targets = await client.query<{ uuid: string }>(
      `SELECT uuid::text AS uuid
       FROM feedback
       WHERE (
         NULLIF($1, '') IS NOT NULL AND uuid::text = $1
       ) OR (
         pet_uuid = $2::uuid
         AND pet_owners_uuid = $3::uuid
         AND raw_answer = $4
       )
       FOR UPDATE`,
      [feedbackUuid ?? '', parentContext.petUuid, parentContext.petOwnerUuid, rawAnswer],
    );
    deletedIds = targets.rows.map((row) => row.uuid);

    for (const targetUuid of deletedIds) {
      await client.query('DELETE FROM notification WHERE feedback_uuid = $1::uuid', [targetUuid]);
      await client.query('DELETE FROM feedback_timeline_events WHERE feedback_uuid = $1::uuid', [
        targetUuid,
      ]);
      await client.query('DELETE FROM feedback WHERE uuid = $1::uuid', [targetUuid]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const remainingFeedbackIds = await findFeedbackIds(feedbackUuid, rawAnswer);
  if (remainingFeedbackIds.length > 0) {
    throw new Error(`Feedback cleanup left rows: ${remainingFeedbackIds.join(', ')}`);
  }

  for (const targetUuid of deletedIds) {
    const remainingChildren = await pool.query<{
      timeline_count: string;
      notification_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM feedback_timeline_events WHERE feedback_uuid = $1::uuid) AS timeline_count,
         (SELECT COUNT(*)::text FROM notification WHERE feedback_uuid = $1::uuid) AS notification_count`,
      [targetUuid],
    );
    const childCounts = remainingChildren.rows[0];
    if (childCounts?.timeline_count !== '0' || childCounts.notification_count !== '0') {
      throw new Error(`Feedback cleanup left child rows for ${targetUuid}`);
    }
  }
};

test('parent can submit feedback through local Ollama and persist the complete row', async ({
  page,
}) => {
  const rawAnswer = `E2E parent submit ${randomUUID()}: Biscuit enjoyed the stay and the handover was clear.`;
  let createdFeedbackUuid: string | undefined;

  try {
    await page.goto('/parent/feedback');

    await chooseRating(page, 'Professional', ratingDetails.Professional);
    await chooseRating(page, 'Service', ratingDetails.Service);
    await chooseRating(page, 'Communication', ratingDetails.Communication);
    await chooseRating(page, 'Safety', ratingDetails.Safety);
    await chooseRating(page, 'Cost', ratingDetails.Cost);
    const praiseRadio = page.getByRole('radio', { name: 'Praise' });
    await page.getByText('Praise', { exact: true }).click();
    await expect(praiseRadio).toBeChecked();
    await page.getByRole('textbox').fill(rawAnswer);

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url() === 'http://localhost:3000/api/feedback' &&
        response.request().method() === 'POST',
      { timeout: 150_000 },
    );
    await page.getByRole('button', { name: 'Submit Feedback' }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const responseBody = (await response.json()) as FeedbackApiResponse;
    createdFeedbackUuid = responseBody.uuid;

    const submitButton = page.getByRole('button', { name: 'Submit Feedback' });
    const confirmation = page.getByRole('status');
    await expect(confirmation).toHaveText('Your feedback has been sent to the provider.');
    await expect(submitButton.locator('..')).toContainText(
      'Your feedback has been sent to the provider.',
    );
    expect(responseBody.uuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(responseBody.pet_uuid).toBe(parentContext.petUuid);
    expect(responseBody.pet_owners_uuid).toBe(parentContext.petOwnerUuid);
    expect(responseBody.category).toBe('Praise');
    expect(responseBody.rating).toBe(4);
    expect(responseBody.rating_details).toEqual(ratingDetails);
    expect(responseBody.raw_answer).toBe(rawAnswer);
    expect(responseBody.transcript).toBeNull();
    expect(responseBody.audio_url).toBeNull();
    expect(responseBody.ai_insights.summary.length).toBeGreaterThan(0);
    expect(responseBody.ai_insights.insights.length).toBeLessThanOrEqual(5);

    const databaseResult = await pool.query<FeedbackDatabaseRow>(
      `SELECT
         uuid::text AS uuid,
         pet_uuid::text AS pet_uuid,
         pet_owners_uuid::text AS pet_owners_uuid,
         category,
         current_status,
         rating::text AS rating,
         rating_details,
         raw_answer,
         transcript,
         audio_url,
         ai_insights
       FROM feedback
       WHERE uuid = $1::uuid`,
      [createdFeedbackUuid],
    );
    const databaseRow = databaseResult.rows[0];

    expect(databaseRow).toBeDefined();
    expect(databaseRow).toMatchObject({
      uuid: responseBody.uuid,
      pet_uuid: parentContext.petUuid,
      pet_owners_uuid: parentContext.petOwnerUuid,
      category: 'Praise',
      current_status: 'submitted',
      rating_details: ratingDetails,
      raw_answer: rawAnswer,
      transcript: null,
      audio_url: null,
      ai_insights: responseBody.ai_insights,
    });
    expect(Number(databaseRow?.rating)).toBe(4);
  } finally {
    try {
      await cleanupFeedback(createdFeedbackUuid, rawAnswer);
    } finally {
      await pool.end();
    }
  }
});
