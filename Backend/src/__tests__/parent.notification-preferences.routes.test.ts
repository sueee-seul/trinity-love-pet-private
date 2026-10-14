import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Request, type Response } from 'express';
import parentProfileRoutes from '../routes/parent.profile.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import {
  readNotificationPreferences,
  upsertNotificationPreferences,
} from '../repositories/notification-preferences.repository.js';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../contracts/notification.preferences.contract.js';

const { parentUser } = vi.hoisted(() => ({
  parentUser: {
    id: '00000000-0000-4000-8000-000000000101',
    email: 'parent@example.com',
    name: 'Ava Mitchell',
    is_employee: false,
    is_pet_owner: true,
    employee_role: null,
    isUsingTemporaryPassword: false,
  },
}));

vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requirePetParent: (req: Request, _res: Response, next: NextFunction): void => {
    req.user = parentUser;
    next();
  },
  requireEmployee: (_req: Request, _res: Response, next: NextFunction): void => next(),
  requireManager: (_req: Request, _res: Response, next: NextFunction): void => next(),
}));

vi.mock('../config/database.js', () => ({ pool: { connect: vi.fn(), query: vi.fn() } }));

vi.mock('../repositories/notification-preferences.repository.js', () => ({
  readNotificationPreferences: vi.fn(async () => null),
  upsertNotificationPreferences: vi.fn(async (_owner: string, update: Record<string, unknown>) => ({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...update,
  })),
}));

const app = express();
app.use(express.json());
app.use('/api/parent/profile', parentProfileRoutes);
app.use(errorHandler);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notification preferences routes', () => {
  it('reads the signed-in owner’s preferences, defaults when none were saved', async () => {
    const response = await request(app).get('/api/parent/profile/notification-preferences');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ preferences: DEFAULT_NOTIFICATION_PREFERENCES, saved: false });
    expect(readNotificationPreferences).toHaveBeenCalledWith(parentUser.id);
  });

  it('saves only the changed fields for the signed-in owner, never for an owner in the body', async () => {
    const response = await request(app)
      .put('/api/parent/profile/notification-preferences')
      .send({ locale: 'zh', digestHour: 19 });
    expect(response.status).toBe(200);
    expect(response.body.preferences).toMatchObject({ locale: 'zh', digestHour: 19 });
    expect(upsertNotificationPreferences).toHaveBeenCalledWith(parentUser.id, {
      locale: 'zh',
      digestHour: 19,
    });
  });

  it('refuses an hour outside the day, an unknown language, an unknown field and an empty change', async () => {
    for (const body of [
      { digestHour: 24 },
      { locale: 'fr' },
      { ownerId: 'someone-else', locale: 'en' },
      {},
    ]) {
      const response = await request(app)
        .put('/api/parent/profile/notification-preferences')
        .send(body);
      expect(response.status).toBe(400);
    }
    expect(upsertNotificationPreferences).not.toHaveBeenCalled();
  });
});
