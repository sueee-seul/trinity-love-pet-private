import { beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import {
  requireReviewer,
  requireReviewSimulatorSecret,
} from '../common/middlewares/reviewer.middleware.js';
import { AUTH_COOKIE_NAME } from '../services/auth.session.js';
import { REVIEWER_COOKIE_NAME, createReviewerSessionToken } from '../services/reviewer.session.js';

const reviewer = {
  id: 'google:google-subject',
  displayName: 'Google Reviewer',
  avatarUrl: null,
};

const createApp = (): express.Express => {
  const app = express();
  app.get('/protected', requireReviewer, (req, res) => res.json({ reviewer: req.reviewer }));
  app.use(errorHandler);
  return app;
};

beforeEach(() => {
  process.env.REVIEWER_SESSION_SECRET = 'reviewer-session-secret';
  process.env.AUTH_SESSION_SECRET = 'auth-session-secret';
});

describe('reviewer middleware', () => {
  it('loads a reviewer only from maps_reviewer_session', async () => {
    const token = await createReviewerSessionToken(reviewer);

    const response = await request(createApp())
      .get('/protected')
      .set('Cookie', `${REVIEWER_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.reviewer).toEqual({
      id: reviewer.id,
      displayName: reviewer.displayName,
      avatarUrl: reviewer.avatarUrl,
    });
  });

  it('rejects a wagstay_session even when the website auth secret is valid', async () => {
    const { createSessionToken } = await import('../services/auth.session.js');
    const websiteToken = await createSessionToken(reviewer.id);

    const response = await request(createApp())
      .get('/protected')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${websiteToken}`);

    expect(response.status).toBe(401);
  });

  it('rejects a reviewer token signed with AUTH_SESSION_SECRET', async () => {
    const { createSessionToken } = await import('../services/auth.session.js');
    const websiteToken = await createSessionToken(reviewer.id);

    const response = await request(createApp())
      .get('/protected')
      .set('Cookie', `${REVIEWER_COOKIE_NAME}=${websiteToken}`);

    expect(response.status).toBe(401);
  });

  it('fails closed when the simulator secret is missing or wrong', async () => {
    const app = express();
    app.post('/simulator', requireReviewSimulatorSecret, (_req, res) => res.sendStatus(204));
    app.use(errorHandler);

    delete process.env.REVIEW_SIMULATOR_SECRET;
    const missing = await request(app).post('/simulator');
    process.env.REVIEW_SIMULATOR_SECRET = 'simulator-secret';
    const wrong = await request(app)
      .post('/simulator')
      .set('X-Review-Simulator-Secret', 'wrong-secret');

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
  });

  it('accepts the simulator secret only when it is configured and matches', async () => {
    const app = express();
    app.post('/simulator', requireReviewSimulatorSecret, (_req, res) => res.sendStatus(204));
    process.env.REVIEW_SIMULATOR_SECRET = 'simulator-secret';

    const response = await request(app)
      .post('/simulator')
      .set('X-Review-Simulator-Secret', 'simulator-secret');

    expect(response.status).toBe(204);
  });

  it('does not fall back to AUTH_SESSION_SECRET for reviewer sessions', async () => {
    delete process.env.REVIEWER_SESSION_SECRET;

    await expect(createReviewerSessionToken(reviewer)).rejects.toThrow(
      'REVIEWER_SESSION_SECRET is not configured',
    );
  });
});
