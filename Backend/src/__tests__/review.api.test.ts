import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import reviewRoutes, { reviewSimulatorRoutes } from '../routes/review.routes.js';
import { AppError, errorHandler } from '../common/middlewares/error.middleware.js';

const {
  createHumanReviewMock,
  createSimulatorReviewMock,
  deleteMockGoogleBusinessReviewMock,
  getGoogleReviewPageMock,
  setReviewLikeMock,
} = vi.hoisted(() => ({
  createHumanReviewMock: vi.fn(),
  createSimulatorReviewMock: vi.fn(),
  deleteMockGoogleBusinessReviewMock: vi.fn(),
  getGoogleReviewPageMock: vi.fn(),
  setReviewLikeMock: vi.fn(),
}));

const reviewer = {
  id: '00000000-0000-4000-8000-000000000901',
  displayName: 'Google Reviewer',
  avatarUrl: null,
};

vi.mock('../services/review.service.js', () => ({
  ReviewService: {
    createHumanReview: createHumanReviewMock,
    createSimulatorReview: createSimulatorReviewMock,
    deleteMockGoogleBusinessReview: deleteMockGoogleBusinessReviewMock,
    getGoogleReviewPage: getGoogleReviewPageMock,
    setReviewLike: setReviewLikeMock,
  },
}));

// Mirrors the optional session on the public page: tests set this to the reviewer they want
// the request to arrive with, or leave it null for an anonymous visitor.
let attachedReviewer: typeof reviewer | null = null;

vi.mock('../common/middlewares/reviewer.middleware.js', () => ({
  requireReviewer: (req: Request, _res: Response, next: NextFunction): void => {
    req.reviewer = reviewer;
    next();
  },
  attachReviewerIfPresent: (req: Request, _res: Response, next: NextFunction): void => {
    if (attachedReviewer) {
      req.reviewer = attachedReviewer;
    }
    next();
  },
  requireReviewSimulatorSecret: (req: Request, res: Response, next: NextFunction): void => {
    if (req.get('X-Review-Simulator-Secret') === process.env.REVIEW_SIMULATOR_SECRET) {
      next();
      return;
    }
    res
      .status(401)
      .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
  },
}));

vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requireTrustedOrigin: (_req: Request, _res: Response, next: NextFunction): void => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/google-reviews', reviewRoutes);
app.use('/api/reviews/simulator', reviewSimulatorRoutes);
app.use(errorHandler);

const createdReview = {
  id: '00000000-0000-4000-8000-000000000902',
  reviewerId: reviewer.id,
  placeSlug: 'boarding_title',
  rating: 5,
  reviewText: 'Great care.',
  source: 'human' as const,
  serviceUserMatchStatus: 'pending' as const,
  createdAt: '2026-08-31T00:00:00.000Z',
};

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  createHumanReviewMock.mockReset();
  createSimulatorReviewMock.mockReset();
  deleteMockGoogleBusinessReviewMock.mockReset();
  getGoogleReviewPageMock.mockReset();
  setReviewLikeMock.mockReset();
  attachedReviewer = null;
  process.env.REVIEW_SIMULATOR_SECRET = 'simulator-secret';
});

describe('Maps review APIs', () => {
  it('loads the provider-shaped review page for a valid place slug', async () => {
    const reviewPage = {
      location: {
        id: '00000000-0000-4000-8000-000000000401',
        displayName: 'PetHouse',
        formattedAddress: '18 PetHouse Lane, Grey Lynn, Auckland 1021',
        googleMapsUri: null,
        averageRating: null,
        totalReviews: 0,
        ratingBreakdown: [
          { stars: 1, count: 0 },
          { stars: 2, count: 0 },
          { stars: 3, count: 0 },
          { stars: 4, count: 0 },
          { stars: 5, count: 0 },
        ],
      },
      reviews: [],
    };
    getGoogleReviewPageMock.mockResolvedValueOnce(reviewPage);

    const response = await request(app).get('/api/google-reviews?placeSlug=PetHouse');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(reviewPage);
    expect(getGoogleReviewPageMock).toHaveBeenCalledWith('PetHouse', null);
  });

  it('passes the signed-in reviewer to the review page so their likes come back marked', async () => {
    attachedReviewer = reviewer;
    getGoogleReviewPageMock.mockResolvedValueOnce({ location: {}, reviews: [] });

    const response = await request(app).get('/api/google-reviews?placeSlug=PetHouse');

    expect(response.status).toBe(200);
    expect(getGoogleReviewPageMock).toHaveBeenCalledWith('PetHouse', reviewer.id);
  });

  it('validates the review page place slug before loading data', async () => {
    const response = await request(app).get('/api/google-reviews?placeSlug=not%20a%20slug');

    expect(response.status).toBe(400);
    expect(getGoogleReviewPageMock).not.toHaveBeenCalled();
  });

  it('accepts a review from a reviewer without requiring pet-owner registration', async () => {
    createHumanReviewMock.mockResolvedValueOnce(createdReview);

    const response = await request(app).post('/api/google-reviews').send({
      placeSlug: ' boarding_title ',
      rating: 5,
      reviewText: '  Great care.  ',
    });

    expect(response.status).toBe(201);
    expect(createHumanReviewMock).toHaveBeenCalledWith(
      reviewer,
      {
        placeSlug: 'boarding_title',
        rating: 5,
        reviewText: 'Great care.',
      },
      undefined,
    );
  });

  it('parses a multipart review payload and passes photo files to the service', async () => {
    createHumanReviewMock.mockResolvedValueOnce(createdReview);

    const response = await request(app)
      .post('/api/google-reviews')
      .field(
        'payload',
        JSON.stringify({ placeSlug: 'PetHouse', rating: 5, reviewText: 'Great care.' }),
      )
      .attach('photos', Buffer.from('jpeg-bytes'), {
        filename: 'cat.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(201);
    expect(createHumanReviewMock).toHaveBeenCalledWith(
      reviewer,
      { placeSlug: 'PetHouse', rating: 5, reviewText: 'Great care.' },
      [
        expect.objectContaining({
          originalname: 'cat.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('jpeg-bytes'),
        }),
      ],
    );
  });

  it('validates rating and place slug before creating a review', async () => {
    const response = await request(app).post('/api/google-reviews').send({
      placeSlug: 'not a slug',
      rating: 6,
    });

    expect(response.status).toBe(400);
    expect(createHumanReviewMock).not.toHaveBeenCalled();
  });

  it('deletes a mock review without requiring a reviewer session', async () => {
    const reviewId = '00000000-0000-4000-8000-000000000902';

    const response = await request(app).delete(`/api/google-reviews/${reviewId}`);

    expect(response.status).toBe(204);
    expect(deleteMockGoogleBusinessReviewMock).toHaveBeenCalledWith(reviewId);
  });

  it('hides the mock cleanup route in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const response = await request(app).delete(
        '/api/google-reviews/00000000-0000-4000-8000-000000000902',
      );

      expect(response.status).toBe(404);
      expect(deleteMockGoogleBusinessReviewMock).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('returns 404 when the review does not exist', async () => {
    deleteMockGoogleBusinessReviewMock.mockRejectedValueOnce(
      new AppError('Review not found', 'NOT_FOUND', 404),
    );

    const response = await request(app).delete(
      '/api/google-reviews/00000000-0000-4000-8000-000000000903',
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not allow a caller to choose the human source on the simulator route', async () => {
    const response = await request(app)
      .post('/api/reviews/simulator')
      .set('X-Review-Simulator-Secret', 'simulator-secret')
      .send({
        authorKey: 'fixture-reviewer',
        displayName: 'Fixture Reviewer',
        placeSlug: 'boarding_title',
        rating: 4,
        reviewText: 'Fixture review',
        source: 'human',
      });

    expect(response.status).toBe(400);
    expect(createSimulatorReviewMock).not.toHaveBeenCalled();
  });

  it('requires the server-side secret for simulator ingestion', async () => {
    const missing = await request(app).post('/api/reviews/simulator').send({
      authorKey: 'fixture-reviewer',
      displayName: 'Fixture Reviewer',
      placeSlug: 'boarding_title',
      rating: 4,
    });
    const wrong = await request(app)
      .post('/api/reviews/simulator')
      .set('X-Review-Simulator-Secret', 'wrong-secret')
      .send({
        authorKey: 'fixture-reviewer',
        displayName: 'Fixture Reviewer',
        placeSlug: 'boarding_title',
        rating: 4,
      });

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(createSimulatorReviewMock).not.toHaveBeenCalled();
  });

  it('sends valid simulator input to the service without a client-controlled source', async () => {
    createSimulatorReviewMock.mockResolvedValueOnce({
      ...createdReview,
      source: 'simulator',
    });

    const response = await request(app)
      .post('/api/reviews/simulator')
      .set('X-Review-Simulator-Secret', 'simulator-secret')
      .send({
        authorKey: 'fixture-reviewer',
        displayName: 'Fixture Reviewer',
        avatarUrl: 'https://example.test/avatar.png',
        email: 'fixture@example.test',
        placeSlug: 'boarding_title',
        rating: 4,
        reviewText: '  Fixture review  ',
      });

    expect(response.status).toBe(201);
    expect(createSimulatorReviewMock).toHaveBeenCalledWith({
      authorKey: 'fixture-reviewer',
      displayName: 'Fixture Reviewer',
      avatarUrl: 'https://example.test/avatar.png',
      email: 'fixture@example.test',
      placeSlug: 'boarding_title',
      rating: 4,
      reviewText: 'Fixture review',
    });
  });

  it('stores a like for the signed-in reviewer and returns the updated count', async () => {
    const reviewId = '00000000-0000-4000-8000-000000000902';
    const likeState = { reviewId, likeCount: 3, viewerHasLiked: true };
    setReviewLikeMock.mockResolvedValueOnce(likeState);

    const response = await request(app).put(`/api/google-reviews/${reviewId}/like`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ like: likeState });
    expect(setReviewLikeMock).toHaveBeenCalledWith(reviewer.id, reviewId, true);
  });

  it('removes a like when the same reviewer taps the button again', async () => {
    const reviewId = '00000000-0000-4000-8000-000000000902';
    setReviewLikeMock.mockResolvedValueOnce({ reviewId, likeCount: 2, viewerHasLiked: false });

    const response = await request(app).delete(`/api/google-reviews/${reviewId}/like`);

    expect(response.status).toBe(200);
    expect(setReviewLikeMock).toHaveBeenCalledWith(reviewer.id, reviewId, false);
  });

  it('validates the review UUID before touching like state', async () => {
    const response = await request(app).put('/api/google-reviews/not-a-uuid/like');

    expect(response.status).toBe(400);
    expect(setReviewLikeMock).not.toHaveBeenCalled();
  });

  it('reports a missing review when the service cannot find it', async () => {
    const reviewId = '00000000-0000-4000-8000-000000000902';
    setReviewLikeMock.mockRejectedValueOnce(new AppError('Review not found', 'NOT_FOUND', 404));

    const response = await request(app).put(`/api/google-reviews/${reviewId}/like`);

    expect(response.status).toBe(404);
  });
});
