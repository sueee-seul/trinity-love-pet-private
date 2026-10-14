import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import {
  requireAuth,
  requireEmployee,
  requireManager,
  requirePetParent,
} from '../common/middlewares/auth.middleware.js';
import { createSessionToken, AUTH_COOKIE_NAME } from '../services/auth.session.js';

const { findUserByIdMock } = vi.hoisted(() => ({ findUserByIdMock: vi.fn() }));

vi.mock('../repositories/auth.repository.js', () => ({
  createPetParentAccount: vi.fn(),
  createGooglePetParentAccount: vi.fn(),
  findUserByCredentials: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: findUserByIdMock,
  findUserByUsername: vi.fn(),
}));

const employee = {
  id: '00000000-0000-4000-8000-000000000201',
  email: 'employee@example.test',
  username: 'employee.one',
  name: 'Employee One',
  is_employee: true,
  is_pet_owner: false,
  staff_role: 'staff',
};

const parent = { ...employee, is_employee: false, is_pet_owner: true, staff_role: null };

const createApp = (middleware: typeof requireAuth): express.Express => {
  const app = express();
  app.get('/protected', middleware, (req, res) => res.json({ user: req.user }));
  app.use(errorHandler);
  return app;
};

describe('auth middleware', () => {
  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = 'middleware-test-secret';
    process.env.AUTH_SESSION_VERSION = '1';
    findUserByIdMock.mockReset();
  });

  it('fails closed when the cookie is missing or invalid', async () => {
    const app = createApp(requireAuth);

    expect((await request(app).get('/protected')).status).toBe(401);
    expect(
      (await request(app).get('/protected').set('Cookie', `${AUTH_COOKIE_NAME}=invalid`)).status,
    ).toBe(401);
    expect(findUserByIdMock).not.toHaveBeenCalled();
  });

  it('loads the current database user and identity flags instead of trusting token claims', async () => {
    findUserByIdMock.mockResolvedValue(employee);
    const cookie = await createSessionToken(employee.id);
    const app = createApp(requireAuth);

    const response = await request(app)
      .get('/protected')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${cookie}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: employee.id,
      is_employee: true,
      is_pet_owner: false,
      employee_role: 'staff',
    });
    expect(findUserByIdMock).toHaveBeenCalledWith(employee.id);
  });

  it('allows employees and rejects pet parents on the employee gate', async () => {
    const app = createApp(requireEmployee);
    findUserByIdMock.mockResolvedValueOnce(employee);
    const employeeCookie = await createSessionToken(employee.id);
    expect(
      (await request(app).get('/protected').set('Cookie', `${AUTH_COOKIE_NAME}=${employeeCookie}`))
        .status,
    ).toBe(200);

    findUserByIdMock.mockResolvedValueOnce(parent);
    const parentCookie = await createSessionToken(parent.id);
    expect(
      (await request(app).get('/protected').set('Cookie', `${AUTH_COOKIE_NAME}=${parentCookie}`))
        .status,
    ).toBe(403);
  });

  it('allows only manager employees through the manager gate', async () => {
    const app = createApp(requireManager);

    findUserByIdMock.mockResolvedValueOnce({ ...employee, staff_role: 'manager' });
    const managerCookie = await createSessionToken(employee.id);
    expect(
      (await request(app).get('/protected').set('Cookie', `${AUTH_COOKIE_NAME}=${managerCookie}`))
        .status,
    ).toBe(200);

    findUserByIdMock.mockResolvedValueOnce(employee);
    const staffCookie = await createSessionToken(employee.id);
    expect(
      (await request(app).get('/protected').set('Cookie', `${AUTH_COOKIE_NAME}=${staffCookie}`))
        .status,
    ).toBe(403);
  });

  it('refuses an employee on the parent gate even when they are also a pet owner', async () => {
    const app = createApp(requirePetParent);
    findUserByIdMock.mockResolvedValue({ ...parent, is_employee: true });
    const cookie = await createSessionToken(parent.id);

    const response = await request(app)
      .get('/protected')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${cookie}`);
    expect(response.status).toBe(403);
  });

  it('allows only pet parents on the parent gate', async () => {
    const app = createApp(requirePetParent);
    findUserByIdMock.mockResolvedValue(parent);
    const cookie = await createSessionToken(parent.id);

    expect(
      (await request(app).get('/protected').set('Cookie', `${AUTH_COOKIE_NAME}=${cookie}`)).status,
    ).toBe(200);
  });
});
