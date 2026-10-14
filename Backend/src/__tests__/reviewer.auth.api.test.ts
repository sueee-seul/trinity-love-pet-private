import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import reviewerAuthRoutes from '../routes/reviewer-auth.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import { REVIEWER_COOKIE_NAME, createReviewerSessionToken } from '../services/reviewer.session.js';

const {
  exchangeGoogleAuthorizationCodeMock,
  verifyGoogleIdTokenMock,
  upsertReviewerIdentityMock,
  findReviewerByIdMock,
} = vi.hoisted(() => ({
  exchangeGoogleAuthorizationCodeMock: vi.fn(),
  verifyGoogleIdTokenMock: vi.fn(),
  upsertReviewerIdentityMock: vi.fn(),
  findReviewerByIdMock: vi.fn(),
}));

vi.mock('../services/google-token.verifier.js', () => ({
  exchangeGoogleAuthorizationCode: exchangeGoogleAuthorizationCodeMock,
  verifyGoogleIdToken: verifyGoogleIdTokenMock,
}));

vi.mock('../repositories/reviewer.repository.js', () => ({
  upsertReviewerIdentity: upsertReviewerIdentityMock,
  findReviewerById: findReviewerByIdMock,
}));

const app = express();
app.use(express.json());
app.use('/api/review-auth', reviewerAuthRoutes);
app.use(errorHandler);

const googleIdentity = {
  subject: 'google-reviewer-subject',
  email: 'reviewer@example.test',
  name: 'Google Reviewer',
  picture: 'https://example.test/avatar.png',
  email_verified: true,
  given_name: 'Google',
  family_name: 'Reviewer',
};

const persistedReviewer = {
  id: '00000000-0000-4000-8000-000000000901',
  provider: 'google' as const,
  provider_subject: googleIdentity.subject,
  email: googleIdentity.email,
  display_name: googleIdentity.name,
  avatar_url: googleIdentity.picture,
};

beforeEach(() => {
  exchangeGoogleAuthorizationCodeMock.mockReset();
  verifyGoogleIdTokenMock.mockReset();
  upsertReviewerIdentityMock.mockReset();
  findReviewerByIdMock.mockReset();
  process.env.NODE_ENV = 'test';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
  process.env.REVIEWER_SESSION_SECRET = 'reviewer-session-secret';
});

afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.REVIEWER_SESSION_SECRET;
});

describe('reviewer authentication APIs', () => {
  it('upserts a Google reviewer identity and returns its DB UUID', async () => {
    exchangeGoogleAuthorizationCodeMock.mockResolvedValueOnce('google-id-token');
    verifyGoogleIdTokenMock.mockResolvedValueOnce(googleIdentity);
    upsertReviewerIdentityMock.mockResolvedValueOnce(persistedReviewer);

    const response = await request(app)
      .post('/api/review-auth/google')
      .set('Origin', 'http://localhost:5173')
      .send({ authorizationCode: 'google-authorization-code' });

    expect(response.status).toBe(200);
    expect(response.body.data.reviewer).toEqual({
      id: persistedReviewer.id,
      displayName: 'Google Reviewer',
      avatarUrl: googleIdentity.picture,
    });
    expect(response.body.data.reviewer.email).toBeUndefined();
    expect(response.body.data.reviewer.role).toBeUndefined();
    expect(response.body.token).toBeUndefined();
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${REVIEWER_COOKIE_NAME}=`),
        expect.stringContaining('HttpOnly'),
      ]),
    );
    expect(response.headers['set-cookie']?.[0]).not.toContain('wagstay_session');
    expect(upsertReviewerIdentityMock).toHaveBeenCalledWith({
      provider: 'google',
      providerSubject: googleIdentity.subject,
      email: googleIdentity.email,
      displayName: googleIdentity.name,
      avatarUrl: googleIdentity.picture,
    });
    expect(exchangeGoogleAuthorizationCodeMock).toHaveBeenCalledWith(
      'google-authorization-code',
      'test-google-client',
      'test-google-secret',
      'http://localhost:5173',
    );
    expect(verifyGoogleIdTokenMock).toHaveBeenCalledWith('google-id-token', 'test-google-client');
  });

  it('rejects an unverified or incomplete Google identity without upserting it', async () => {
    exchangeGoogleAuthorizationCodeMock.mockResolvedValueOnce('google-id-token');
    verifyGoogleIdTokenMock.mockResolvedValueOnce({ ...googleIdentity, email_verified: false });

    const response = await request(app)
      .post('/api/review-auth/google')
      .set('Origin', 'http://localhost:5173')
      .send({ authorizationCode: 'google-authorization-code' });

    expect(response.status).toBe(401);
    expect(upsertReviewerIdentityMock).not.toHaveBeenCalled();
  });

  it('requires a non-empty Google subject and email claim', async () => {
    exchangeGoogleAuthorizationCodeMock.mockResolvedValueOnce('google-id-token');
    verifyGoogleIdTokenMock.mockResolvedValueOnce({
      ...googleIdentity,
      subject: ' ',
      email: null,
    });

    const response = await request(app)
      .post('/api/review-auth/google')
      .set('Origin', 'http://localhost:5173')
      .send({ authorizationCode: 'google-authorization-code' });

    expect(response.status).toBe(401);
    expect(upsertReviewerIdentityMock).not.toHaveBeenCalled();
  });

  it('reloads the reviewer profile from the reviewer cookie', async () => {
    const reviewerProfile = {
      id: persistedReviewer.id,
      displayName: 'Google Reviewer',
      avatarUrl: googleIdentity.picture,
    };
    const token = await createReviewerSessionToken(reviewerProfile);

    const response = await request(app)
      .get('/api/review-auth/me')
      .set('Cookie', `${REVIEWER_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.reviewer).toEqual({
      id: reviewerProfile.id,
      displayName: reviewerProfile.displayName,
      avatarUrl: reviewerProfile.avatarUrl,
    });
    expect(findReviewerByIdMock).not.toHaveBeenCalled();
  });

  it('clears only the reviewer cookie on logout', async () => {
    const response = await request(app).post('/api/review-auth/logout');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ loggedOut: true });
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${REVIEWER_COOKIE_NAME}=;`),
        expect.stringContaining('Expires=Thu, 01 Jan 1970 00:00:00 GMT'),
      ]),
    );
    expect(response.headers['set-cookie']?.[0]).not.toContain('wagstay_session');
  });

  it('returns unauthorized for an invalid Google token', async () => {
    exchangeGoogleAuthorizationCodeMock.mockResolvedValueOnce(null);

    const response = await request(app)
      .post('/api/review-auth/google')
      .set('Origin', 'http://localhost:5173')
      .send({ authorizationCode: 'google-authorization-code' });

    expect(response.status).toBe(401);
    expect(response.body.data).toBeNull();
  });

  it('returns a server error when the reviewer identity cannot be persisted', async () => {
    exchangeGoogleAuthorizationCodeMock.mockResolvedValueOnce('google-id-token');
    verifyGoogleIdTokenMock.mockResolvedValueOnce(googleIdentity);
    upsertReviewerIdentityMock.mockRejectedValueOnce(new Error('reviewer table is unavailable'));

    const response = await request(app)
      .post('/api/review-auth/google')
      .set('Origin', 'http://localhost:5173')
      .send({ authorizationCode: 'google-authorization-code' });

    expect(response.status).toBe(500);
    expect(upsertReviewerIdentityMock).toHaveBeenCalled();
  });
});
