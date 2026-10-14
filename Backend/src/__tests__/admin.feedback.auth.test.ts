import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import adminFeedbackRoutes from '../routes/admin.feedback.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import { AUTH_COOKIE_NAME, createSessionToken } from '../services/auth.session.js';

const { findUserByIdMock, getFeedbackListMock, deleteFeedbackMock } = vi.hoisted(() => ({
  findUserByIdMock: vi.fn(),
  getFeedbackListMock: vi.fn(),
  deleteFeedbackMock: vi.fn(),
}));

vi.mock('../repositories/auth.repository.js', () => ({
  createPetParentAccount: vi.fn(),
  createGooglePetParentAccount: vi.fn(),
  findUserByCredentials: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: findUserByIdMock,
  findUserByUsername: vi.fn(),
}));

vi.mock('../controllers/admin.feedback.controller.js', () => {
  const unusedHandler = (_req: Request, _res: Response, next: NextFunction): void => next();
  return {
    getFeedbackList: getFeedbackListMock,
    getFeedbackAssignees: unusedHandler,
    getFeedbackSnapshot: unusedHandler,
    assignFeedbacks: unusedHandler,
    markFeedbacksAsRead: unusedHandler,
    getFeedbackDetail: unusedHandler,
    updateFeedbackStatus: unusedHandler,
    updateSuggestionWorkflow: unusedHandler,
    replyToFeedback: unusedHandler,
    deleteFeedback: deleteFeedbackMock,
  };
});

const employee = {
  id: '00000000-0000-4000-8000-000000000201',
  email: 'employee@example.test',
  username: 'employee.one',
  name: 'Employee One',
  is_employee: true,
  is_pet_owner: false,
  staff_role: 'staff',
};

const parent = {
  ...employee,
  is_employee: false,
  is_pet_owner: true,
  staff_role: null,
};

const createApp = (): express.Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/feedback', adminFeedbackRoutes);
  app.use(errorHandler);
  return app;
};

describe('admin feedback authentication boundary', () => {
  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = 'admin-route-test-secret';
    process.env.AUTH_SESSION_VERSION = '1';
    findUserByIdMock.mockReset();
    getFeedbackListMock.mockReset();
    deleteFeedbackMock.mockReset();
    getFeedbackListMock.mockImplementation((_req: Request, res: Response): void => {
      res.status(200).json({ authenticated: true });
    });
    deleteFeedbackMock.mockImplementation((_req: Request, res: Response): void => {
      res.status(204).send();
    });
  });

  it('rejects an unauthenticated admin feedback request before the controller', async () => {
    const response = await request(createApp()).get('/api/admin/feedback');

    expect(response.status).toBe(401);
    expect(getFeedbackListMock).not.toHaveBeenCalled();
  });

  it('allows an authenticated employee to reach the existing admin feedback route', async () => {
    findUserByIdMock.mockResolvedValue(employee);
    const token = await createSessionToken(employee.id);

    const response = await request(createApp())
      .get('/api/admin/feedback')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: true });
    expect(getFeedbackListMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an authenticated pet parent from the employee feedback route', async () => {
    findUserByIdMock.mockResolvedValue(parent);
    const token = await createSessionToken(parent.id);

    const response = await request(createApp())
      .get('/api/admin/feedback')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(403);
    expect(getFeedbackListMock).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated feedback deletion before the controller', async () => {
    const response = await request(createApp()).delete(
      '/api/admin/feedback/00000000-0000-4000-8000-000000000b11',
    );

    expect(response.status).toBe(401);
    expect(deleteFeedbackMock).not.toHaveBeenCalled();
  });

  it('allows an authenticated employee to reach feedback deletion', async () => {
    findUserByIdMock.mockResolvedValue(employee);
    const token = await createSessionToken(employee.id);

    const response = await request(createApp())
      .delete('/api/admin/feedback/00000000-0000-4000-8000-000000000b11')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(204);
    expect(deleteFeedbackMock).toHaveBeenCalledTimes(1);
  });
});
