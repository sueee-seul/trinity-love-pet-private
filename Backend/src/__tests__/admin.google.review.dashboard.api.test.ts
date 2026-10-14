import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import adminGoogleReviewRoutes from '../routes/admin.google.review.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import type { AuthenticatedUser } from '../services/auth.service.js';

const { getAdminGoogleReviewDashboardMock } = vi.hoisted(() => ({
  getAdminGoogleReviewDashboardMock: vi.fn(),
}));

vi.mock('../services/admin.google.review.dashboard.service.js', () => ({
  getAdminGoogleReviewDashboard: getAdminGoogleReviewDashboardMock,
}));

vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requireEmployee: (req: Request, res: Response, next: NextFunction): void => {
    if (req.get('X-Test-Employee') !== 'true') {
      res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
      return;
    }

    req.user = {
      id: '00000000-0000-4000-8000-000000000201',
      email: 'employee@example.test',
      name: 'Test Employee',
      is_employee: true,
      is_pet_owner: false,
      employee_role: req.get('X-Test-Employee-Role') === 'manager' ? 'manager' : 'staff',
      isUsingTemporaryPassword: false,
    } satisfies AuthenticatedUser;
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
  requireTrustedOrigin: (_req: Request, _res: Response, next: NextFunction): void => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/admin/google-reviews', adminGoogleReviewRoutes);
app.use(errorHandler);

beforeEach(() => {
  getAdminGoogleReviewDashboardMock.mockReset();
});

describe('Admin Google review dashboard API', () => {
  it('allows a manager to read the PetHouse dashboard and passes the validated query', async () => {
    const dashboard = {
      scope: { placeSlug: 'PetHouse' },
      rating: { average: 4.5, reviewCount: 2 },
    };
    getAdminGoogleReviewDashboardMock.mockResolvedValueOnce(dashboard);

    const response = await request(app)
      .get('/api/admin/google-reviews/dashboard?placeSlug=PetHouse')
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'manager');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 200,
      msg: 'Google review dashboard loaded',
      data: dashboard,
    });
    expect(getAdminGoogleReviewDashboardMock).toHaveBeenCalledWith({
      placeSlug: 'PetHouse',
    });
  });

  it('rejects staff before invoking the dashboard service', async () => {
    const response = await request(app)
      .get('/api/admin/google-reviews/dashboard?placeSlug=PetHouse')
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'staff');

    expect(response.status).toBe(403);
    expect(getAdminGoogleReviewDashboardMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated and invalid dashboard queries', async () => {
    const unauthenticated = await request(app).get(
      '/api/admin/google-reviews/dashboard?placeSlug=PetHouse',
    );
    expect(unauthenticated.status).toBe(401);

    const invalidPlace = await request(app)
      .get('/api/admin/google-reviews/dashboard?placeSlug=Pet%40House')
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'manager');
    expect(invalidPlace.status).toBe(400);

    const incompletePeriod = await request(app)
      .get('/api/admin/google-reviews/dashboard?placeSlug=PetHouse&from=2026-01-01')
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'manager');
    expect(incompletePeriod.status).toBe(400);
    expect(getAdminGoogleReviewDashboardMock).not.toHaveBeenCalled();
  });

  it('does not expose the removed dashboard summary endpoint', async () => {
    const response = await request(app)
      .get('/api/admin/google-reviews/dashboard-summary?placeSlug=PetHouse')
      .set('X-Test-Employee', 'true')
      .set('X-Test-Employee-Role', 'manager');

    expect(response.status).toBe(404);
    expect(getAdminGoogleReviewDashboardMock).not.toHaveBeenCalled();
  });
});
