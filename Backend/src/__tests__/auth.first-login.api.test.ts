import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import authRoutes from '../routes/auth.routes.js';
import { AUTH_COOKIE_NAME, createSessionToken } from '../services/auth.session.js';

const repository = vi.hoisted(() => ({
  createGooglePetParentAccount: vi.fn(),
  createPetParentAccount: vi.fn(),
  findUserByCredentials: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  findUserByUsername: vi.fn(),
  updateUserPasswordFromTemporary: vi.fn(),
}));

vi.mock('../repositories/auth.repository.js', () => repository);

const pendingEmployee = {
  id: '00000000-0000-4000-8000-000000000901',
  email: 'new.carer@example.test',
  username: 'new.carer',
  name: 'New Carer',
  is_employee: true,
  is_pet_owner: false,
  staff_role: 'staff',
  is_temporary_password: true,
};

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

describe('first-login password API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SESSION_SECRET = 'first-login-test-secret';
    process.env.AUTH_SESSION_VERSION = '1';
    repository.findUserById.mockResolvedValue(pendingEmployee);
    repository.updateUserPasswordFromTemporary.mockResolvedValue({
      id: pendingEmployee.id,
      email: pendingEmployee.email,
    });
  });

  it('changes the password only for a pending employee session', async () => {
    const cookie = await createSessionToken(pendingEmployee.id);
    const response = await request(app)
      .post('/api/auth/first-login-password')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${cookie}`)
      .send({ password: 'NewSecure1!', confirmPassword: 'NewSecure1!' });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ passwordChanged: true });
    expect(repository.updateUserPasswordFromTemporary).toHaveBeenCalledWith(
      pendingEmployee.id,
      'NewSecure1!',
    );
  });

  it('rejects a password confirmation mismatch before changing the password', async () => {
    const cookie = await createSessionToken(pendingEmployee.id);
    const response = await request(app)
      .post('/api/auth/first-login-password')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${cookie}`)
      .send({ password: 'NewSecure1!', confirmPassword: 'Different1!' });

    expect(response.status).toBe(400);
    expect(repository.updateUserPasswordFromTemporary).not.toHaveBeenCalled();
  });

  it('rejects a session that no longer requires first-login activation', async () => {
    repository.findUserById.mockResolvedValueOnce({
      ...pendingEmployee,
      is_temporary_password: false,
    });
    const cookie = await createSessionToken(pendingEmployee.id);
    const response = await request(app)
      .post('/api/auth/first-login-password')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${cookie}`)
      .send({ password: 'NewSecure1!', confirmPassword: 'NewSecure1!' });

    expect(response.status).toBe(409);
    expect(repository.updateUserPasswordFromTemporary).not.toHaveBeenCalled();
  });
});
