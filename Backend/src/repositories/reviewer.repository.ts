import { pool } from '../config/database.js';

export type ReviewerProvider = 'google' | 'simulator';

export interface ReviewerIdentity {
  id: string;
  provider: ReviewerProvider;
  provider_subject: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
}

export interface UpsertReviewerIdentityInput {
  provider: ReviewerProvider;
  providerSubject: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export const upsertReviewerIdentity = async (
  input: UpsertReviewerIdentityInput,
): Promise<ReviewerIdentity> => {
  const result = await pool.query<ReviewerIdentity>(
    `INSERT INTO reviewer_identities (
       provider,
       provider_subject,
       email,
       display_name,
       avatar_url
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (provider, provider_subject)
     DO UPDATE SET
       email = EXCLUDED.email,
       display_name = EXCLUDED.display_name,
       avatar_url = EXCLUDED.avatar_url,
       updated_at = now()
     RETURNING
       uuid::text AS id,
       provider,
       provider_subject,
       email,
       display_name,
       avatar_url`,
    [input.provider, input.providerSubject, input.email, input.displayName, input.avatarUrl],
  );

  const reviewer = result.rows[0];
  if (!reviewer) {
    throw new Error('Reviewer identity upsert returned no identity');
  }

  return reviewer;
};

export const findReviewerById = async (id: string): Promise<ReviewerIdentity | null> => {
  const result = await pool.query<ReviewerIdentity>(
    `SELECT
       uuid::text AS id,
       provider,
       provider_subject,
       email,
       display_name,
       avatar_url
     FROM reviewer_identities
     WHERE uuid = $1::uuid
     LIMIT 1`,
    [id],
  );

  return result.rows[0] ?? null;
};
