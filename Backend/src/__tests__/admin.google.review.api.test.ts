import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import adminGoogleReviewRoutes from '../routes/admin.google.review.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import type { AuthenticatedUser } from '../services/auth.service.js';

const {
  assignGoogleReviewsMock,
  getAdminGoogleReviewsMock,
  replyToGoogleReviewMock,
  updateGoogleReviewTriageMock,
} = vi.hoisted(() => ({
  assignGoogleReviewsMock: vi.fn(),
  getAdminGoogleReviewsMock: vi.fn(),
  replyToGoogleReviewMock: vi.fn(),
  updateGoogleReviewTriageMock: vi.fn(),
}));

vi.mock('../services/admin.google.review.service.js', () => ({
  assignGoogleReviews: assignGoogleReviewsMock,
  getAdminGoogleReviews: getAdminGoogleReviewsMock,
  replyToGoogleReview: replyToGoogleReviewMock,
  updateGoogleReviewTriage: updateGoogleReviewTriageMock,
}));

vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requireEmployee: (req: Request, res: Response, next: NextFunction): void => {
    if (req.get('X-Test-Employee') === 'true') {
      req.user = {
        id: req.get('X-Test-Employee-Id') ?? '00000000-0000-4000-8000-000000000202',
        email: 'employee@example.test',
        name: 'Test Employee',
        is_employee: true,
        is_pet_owner: false,
        employee_role: req.get('X-Test-Employee-Role') === 'manager' ? 'manager' : 'staff',
        isUsingTemporaryPassword: false,
      } satisfies AuthenticatedUser;
      next();
      return;
    }

    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
  },
  requireTrustedOrigin: (req: Request, res: Response, next: NextFunction): void => {
    if (req.get('Origin') === 'https://untrusted.example') {
      res.status(403).json({
        error: { code: 'UNTRUSTED_ORIGIN', message: 'Request origin is not allowed' },
      });
      return;
    }
    next();
  },
  requireManager: (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.employee_role === 'manager') {
      next();
      return;
    }
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' },
    });
  },
}));

const app = express();
app.use(express.json());
app.use('/api/admin/google-reviews', adminGoogleReviewRoutes);
app.use(errorHandler);

beforeEach(() => {
  assignGoogleReviewsMock.mockReset();
  getAdminGoogleReviewsMock.mockReset();
  replyToGoogleReviewMock.mockReset();
  updateGoogleReviewTriageMock.mockReset();
});

describe('Admin Google review API', () => {
  describe('PATCH /:id/type', () => {
    const reviewId = '00000000-0000-4000-8000-000000000901';
    const updatedReview = { id: reviewId, triageType: 'issue' };

    it('allows a manager with a trusted origin to update the type', async () => {
      updateGoogleReviewTriageMock.mockResolvedValueOnce(updatedReview);

      const response = await request(app)
        .patch(`/api/admin/google-reviews/${reviewId}/type`)
        .set('X-Test-Employee', 'true')
        .set('X-Test-Employee-Role', 'manager')
        .set('Origin', 'http://localhost:5173')
        .send({ triageType: 'issue' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        code: 200,
        msg: 'Google review type updated',
        data: updatedReview,
      });
      expect(updateGoogleReviewTriageMock).toHaveBeenCalledWith(reviewId, 'issue', {
        id: '00000000-0000-4000-8000-000000000202',
        role: 'manager',
      });
    });

    it.each([
      ['staff', 'http://localhost:5173'],
      ['manager', 'https://untrusted.example'],
    ])('rejects %s or untrusted-origin requests before the service', async (role, origin) => {
      const response = await request(app)
        .patch(`/api/admin/google-reviews/${reviewId}/type`)
        .set('X-Test-Employee', 'true')
        .set('X-Test-Employee-Role', role)
        .set('Origin', origin)
        .send({ triageType: 'issue' });

      expect(response.status).toBe(403);
      expect(updateGoogleReviewTriageMock).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated, invalid UUID, and invalid type requests', async () => {
      const unauthenticated = await request(app)
        .patch(`/api/admin/google-reviews/${reviewId}/type`)
        .send({ triageType: 'issue' });
      expect(unauthenticated.status).toBe(401);

      const invalidUuid = await request(app)
        .patch('/api/admin/google-reviews/not-a-uuid/type')
        .set('X-Test-Employee', 'true')
        .set('X-Test-Employee-Role', 'manager')
        .send({ triageType: 'issue' });
      expect(invalidUuid.status).toBe(400);

      const invalidType = await request(app)
        .patch(`/api/admin/google-reviews/${reviewId}/type`)
        .set('X-Test-Employee', 'true')
        .set('X-Test-Employee-Role', 'manager')
        .send({ triageType: 'undecided' });
      expect(invalidType.status).toBe(400);
      expect(updateGoogleReviewTriageMock).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /assignee', () => {
    const reviewUuids = [
      '00000000-0000-4000-8000-000000000901',
      '00000000-0000-4000-8000-000000000902',
    ];
    const assigneeId = '00000000-0000-4000-8000-000000000201';

    it('allows a manager with a trusted origin to assign reviews', async () => {
      const data = { updatedUuids: reviewUuids, assigneeId };
      assignGoogleReviewsMock.mockResolvedValueOnce(data);

      const response = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('X-Test-Employee', 'true')
        .set('X-Test-Employee-Role', 'manager')
        .set('Origin', 'http://localhost:5173')
        .send({ reviewUuids, assigneeId });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        code: 200,
        msg: 'Google reviews assigned',
        data,
      });
      expect(assignGoogleReviewsMock).toHaveBeenCalledWith(reviewUuids, assigneeId);
    });

    it('rejects staff assignment before calling the service', async () => {
      const response = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('X-Test-Employee', 'true')
        .set('Origin', 'http://localhost:5173')
        .send({ reviewUuids, assigneeId });

      expect(response.status).toBe(403);
      expect(assignGoogleReviewsMock).not.toHaveBeenCalled();
    });

    it('rejects invalid assignment input before calling the service', async () => {
      const response = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('X-Test-Employee', 'true')
        .set('X-Test-Employee-Role', 'manager')
        .set('Origin', 'http://localhost:5173')
        .send({ reviewUuids: ['not-a-uuid'], assigneeId: 'not-an-employee' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(assignGoogleReviewsMock).not.toHaveBeenCalled();
    });

    it('rejects an empty review selection before calling the service', async () => {
      const response = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('X-Test-Employee', 'true')
        .set('X-Test-Employee-Role', 'manager')
        .set('Origin', 'http://localhost:5173')
        .send({ reviewUuids: [], assigneeId });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(assignGoogleReviewsMock).not.toHaveBeenCalled();
    });

    it('preserves unauthenticated and untrusted-origin boundaries', async () => {
      const unauthenticated = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('Origin', 'http://localhost:5173')
        .send({ reviewUuids, assigneeId });
      expect(unauthenticated.status).toBe(401);

      const untrusted = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('X-Test-Employee', 'true')
        .set('X-Test-Employee-Role', 'manager')
        .set('Origin', 'https://untrusted.example')
        .send({ reviewUuids, assigneeId });
      expect(untrusted.status).toBe(403);
      expect(assignGoogleReviewsMock).not.toHaveBeenCalled();
    });
  });

  it('returns the employee Google review projection', async () => {
    const data = {
      reviews: [
        {
          id: '00000000-0000-4000-8000-000000000901',
          reviewerName: 'Andrew',
          reviewerEmail: 'andrew@example.test',
          reviewerAvatarUrl: null,
          reviewerIsAnonymous: false,
          rating: 5,
          reviewText: 'Great care.',
          photoUrls: [],
          createdAt: '2026-08-10T00:00:00.000Z',
          updatedAt: '2026-08-10T00:00:00.000Z',
          ownerReply: null,
          ownerReplyUpdatedAt: null,
          aiSummary: 'The reviewer praised the care provided to their pet.',
          triageType: 'praise',
          triageConfidence: 'high',
          isRead: false,
          currentStatus: 'received',
          assignedEmployeeUuid: null,
        },
      ],
    };
    getAdminGoogleReviewsMock.mockResolvedValueOnce(data);

    const response = await request(app)
      .get('/api/admin/google-reviews?placeSlug=PetHouse')
      .set('X-Test-Employee', 'true');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 200,
      msg: 'Google reviews loaded',
      data,
    });
    expect(getAdminGoogleReviewsMock).toHaveBeenCalledWith('PetHouse', {
      id: '00000000-0000-4000-8000-000000000202',
      role: 'staff',
    });
  });

  it('saves a reply for an authenticated employee and returns the updated review', async () => {
    const reviewId = '00000000-0000-4000-8000-000000000901';
    const updatedReview = {
      id: reviewId,
      reviewerName: 'Andrew',
      reviewerEmail: 'andrew@example.test',
      reviewerAvatarUrl: null,
      reviewerIsAnonymous: false,
      rating: 5,
      reviewText: 'Great care.',
      photoUrls: [],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      ownerReply: 'Thank you for sharing this.',
      ownerReplyUpdatedAt: '2026-09-02T01:00:00.000Z',
      aiSummary: 'The reviewer praised the care provided to their pet.',
      triageType: 'praise',
      triageConfidence: 'high',
      isRead: false,
      currentStatus: 'received',
      assignedEmployeeUuid: null,
    };
    replyToGoogleReviewMock.mockResolvedValueOnce(updatedReview);

    const response = await request(app)
      .post(`/api/admin/google-reviews/${reviewId}/reply`)
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'manager')
      .set('Origin', 'http://localhost:5173')
      .send({ replyBody: '  Thank you for sharing this.  ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 200,
      msg: 'Google review reply saved',
      data: updatedReview,
    });
    expect(replyToGoogleReviewMock).toHaveBeenCalledWith(reviewId, 'Thank you for sharing this.', {
      id: '00000000-0000-4000-8000-000000000202',
      role: 'manager',
    });
  });

  it('rejects an invalid reply request before calling the service', async () => {
    const response = await request(app)
      .post('/api/admin/google-reviews/not-a-uuid/reply')
      .set('X-Test-Employee', 'true')
      .send({ replyBody: '   ' });

    expect(response.status).toBe(400);
    expect(replyToGoogleReviewMock).not.toHaveBeenCalled();
  });

  it('does not expose a generated reply draft route', async () => {
    const response = await request(app)
      .post('/api/admin/google-reviews/00000000-0000-4000-8000-000000000901/reply/draft')
      .set('X-Test-Employee', 'true')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(404);
  });

  it('requires employee authentication for replies', async () => {
    const response = await request(app)
      .post('/api/admin/google-reviews/00000000-0000-4000-8000-000000000901/reply')
      .send({ replyBody: 'Thank you.' });

    expect(response.status).toBe(401);
    expect(replyToGoogleReviewMock).not.toHaveBeenCalled();
  });

  it('rejects an untrusted origin before calling the reply service', async () => {
    const response = await request(app)
      .post('/api/admin/google-reviews/00000000-0000-4000-8000-000000000901/reply')
      .set('X-Test-Employee', 'true')
      .set('Origin', 'https://untrusted.example')
      .send({ replyBody: 'Thank you.' });

    expect(response.status).toBe(403);
    expect(replyToGoogleReviewMock).not.toHaveBeenCalled();
  });

  it('requires employee authentication', async () => {
    const response = await request(app).get('/api/admin/google-reviews?placeSlug=PetHouse');

    expect(response.status).toBe(401);
    expect(getAdminGoogleReviewsMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid place slug before calling the service', async () => {
    const response = await request(app)
      .get('/api/admin/google-reviews?placeSlug=not%20a%20slug')
      .set('X-Test-Employee', 'true');

    expect(response.status).toBe(400);
    expect(getAdminGoogleReviewsMock).not.toHaveBeenCalled();
  });
});
