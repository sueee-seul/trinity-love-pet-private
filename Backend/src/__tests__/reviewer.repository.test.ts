import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import { findReviewerById, upsertReviewerIdentity } from '../repositories/reviewer.repository.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

const reviewer = {
  id: '00000000-0000-4000-8000-000000000901',
  provider: 'google' as const,
  provider_subject: 'google-subject',
  email: 'reviewer@example.test',
  display_name: 'Google Reviewer',
  avatar_url: null,
};

describe('reviewer repository', () => {
  beforeEach(() => vi.mocked(pool.query).mockReset());

  it('upserts provider identity without involving the website users table', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [reviewer] } as never);

    await expect(
      upsertReviewerIdentity({
        provider: 'google',
        providerSubject: 'google-subject',
        email: 'reviewer@example.test',
        displayName: 'Google Reviewer',
        avatarUrl: null,
      }),
    ).resolves.toEqual(reviewer);

    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain('INSERT INTO reviewer_identities');
    expect(String(query)).toContain('ON CONFLICT (provider, provider_subject)');
    expect(String(query)).not.toContain('INSERT INTO users');
    expect(values).toEqual([
      'google',
      'google-subject',
      'reviewer@example.test',
      'Google Reviewer',
      null,
    ]);
  });

  it('reloads only the requested reviewer identity', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [reviewer] } as never);

    await expect(findReviewerById(reviewer.id)).resolves.toEqual(reviewer);

    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain('FROM reviewer_identities');
    expect(String(query)).toContain('uuid = $1::uuid');
    expect(values).toEqual([reviewer.id]);
  });
});
