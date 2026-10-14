import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import type { AuthenticatedUser } from '../services/auth.service.js';
import notificationRoutes from '../routes/admin.google.review.notification.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';

const {
  getManagerGoogleReviewNotificationsMock,
  markManagerGoogleReviewNotificationAsReadMock,
  readAllManagerGoogleReviewNotificationsMock,
} = vi.hoisted(() => ({
  getManagerGoogleReviewNotificationsMock: vi.fn(),
  markManagerGoogleReviewNotificationAsReadMock: vi.fn(),
  readAllManagerGoogleReviewNotificationsMock: vi.fn(),
}));

vi.mock('../services/admin.google.review.notification.service.js', () => ({
  getManagerGoogleReviewNotifications: getManagerGoogleReviewNotificationsMock,
  markManagerGoogleReviewNotificationAsRead: markManagerGoogleReviewNotificationAsReadMock,
  parseGoogleReviewNotificationQuery: (query: unknown): unknown => {
    return z
      .object({
        limit: z.coerce.number().int().min(1).max(20).default(10),
        cursor: z.string().trim().min(1).max(256).optional(),
      })
      .strict()
      .parse(query);
  },
  readAllManagerGoogleReviewNotifications: readAllManagerGoogleReviewNotificationsMock,
}));

vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requireManager: (req: Request, res: Response, next: NextFunction): void => {
    const role = req.get('X-Test-Employee-Role');
    if (!req.get('X-Test-Employee')) {
      res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
      return;
    }
    if (role !== 'manager') {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' },
      });
      return;
    }
    req.user = {
      id: req.get('X-Test-Employee-Id') ?? '00000000-0000-4000-8000-000000000202',
      email: 'manager@example.test',
      name: 'Test Manager',
      is_employee: true,
      is_pet_owner: false,
      employee_role: 'manager',
      isUsingTemporaryPassword: false,
    } satisfies AuthenticatedUser;
    next();
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
}));

const app = express();
app.use(express.json());
app.use('/api/admin/google-review-notifications', notificationRoutes);
app.use(errorHandler);

const MANAGER_ID = '00000000-0000-4000-8000-000000000202';
const NOTIFICATION_ID = '00000000-0000-4000-8000-000000000911';

beforeEach(() => {
  getManagerGoogleReviewNotificationsMock.mockReset();
  markManagerGoogleReviewNotificationAsReadMock.mockReset();
  readAllManagerGoogleReviewNotificationsMock.mockReset();
});

describe('Admin Google Review notification API', () => {
  it('returns the current manager notification projection', async () => {
    const data = {
      items: [],
      unreadCount: 0,
      nextCursor: null,
    };
    getManagerGoogleReviewNotificationsMock.mockResolvedValueOnce(data);

    const response = await request(app)
      .get('/api/admin/google-review-notifications?limit=10')
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'manager');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 200,
      msg: 'Google review notifications loaded',
      data,
    });
    expect(getManagerGoogleReviewNotificationsMock).toHaveBeenCalledWith(MANAGER_ID, { limit: 10 });
  });

  it('rejects staff and unauthenticated notification reads before the service', async () => {
    const unauthenticated = await request(app).get('/api/admin/google-review-notifications');
    expect(unauthenticated.status).toBe(401);

    const staff = await request(app)
      .get('/api/admin/google-review-notifications')
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'staff');
    expect(staff.status).toBe(403);
    expect(getManagerGoogleReviewNotificationsMock).not.toHaveBeenCalled();
  });

  it('marks one notification read for the authenticated manager', async () => {
    const data = { id: NOTIFICATION_ID, readAt: '2026-09-11T00:00:00.000Z' };
    markManagerGoogleReviewNotificationAsReadMock.mockResolvedValueOnce(data);

    const response = await request(app)
      .patch(`/api/admin/google-review-notifications/${NOTIFICATION_ID}/read`)
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'manager')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 200,
      msg: 'Google review notification read',
      data,
    });
    expect(markManagerGoogleReviewNotificationAsReadMock).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      MANAGER_ID,
    );
  });

  it('reads all Google Review notifications with the short UI action', async () => {
    const data = {
      updatedIds: [NOTIFICATION_ID],
      readAt: '2026-09-11T00:00:00.000Z',
    };
    readAllManagerGoogleReviewNotificationsMock.mockResolvedValueOnce(data);

    const response = await request(app)
      .patch('/api/admin/google-review-notifications/read-all')
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'manager')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 200,
      msg: 'Google review notifications read',
      data,
    });
    expect(readAllManagerGoogleReviewNotificationsMock).toHaveBeenCalledWith(MANAGER_ID);
  });

  it('rejects invalid notification input and untrusted origins', async () => {
    const invalidUuid = await request(app)
      .patch('/api/admin/google-review-notifications/not-a-uuid/read')
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'manager')
      .set('Origin', 'http://localhost:5173');
    expect(invalidUuid.status).toBe(400);

    const untrusted = await request(app)
      .patch(`/api/admin/google-review-notifications/${NOTIFICATION_ID}/read`)
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'manager')
      .set('Origin', 'https://untrusted.example');
    expect(untrusted.status).toBe(403);
    expect(markManagerGoogleReviewNotificationAsReadMock).not.toHaveBeenCalled();
  });
});
