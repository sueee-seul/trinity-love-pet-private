import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { SignJWT } from 'jose';
import request, { type Response as SupertestResponse } from 'supertest';
import express from 'express';
import { pool } from '../config/database.js';
import authRoutes from '../routes/auth.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import { AUTH_COOKIE_NAME } from '../services/auth.session.js';
import { resetRateLimits } from '../common/middlewares/rate-limit.middleware.js';

vi.mock('../config/database.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

const { verifyIdTokenMock } = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class MockOAuth2Client {
    public verifyIdToken(...args: unknown[]): unknown {
      return verifyIdTokenMock(...args);
    }
  },
}));

const databaseUser = {
  id: '00000000-0000-4000-8000-000000000201',
  email: 'employee@example.test',
  username: 'employee.one',
  name: 'Employee One',
  is_employee: true,
  is_pet_owner: false,
  staff_role: 'staff',
  is_temporary_password: false,
};

const originalLocalResetExposure = process.env.EXPOSE_LOCAL_PASSWORD_RESET_URL;

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

beforeEach(() => {
  resetRateLimits();
  vi.mocked(pool.query).mockReset();
  vi.mocked(pool.connect).mockReset();
  verifyIdTokenMock.mockReset();
  process.env.NODE_ENV = 'test';
  process.env.EXPOSE_LOCAL_PASSWORD_RESET_URL = 'true';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
  process.env.AUTH_SESSION_SECRET = 'test-session-secret';
  process.env.AUTH_SESSION_VERSION = '1';
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalLocalResetExposure === undefined) {
    delete process.env.EXPOSE_LOCAL_PASSWORD_RESET_URL;
  } else {
    process.env.EXPOSE_LOCAL_PASSWORD_RESET_URL = originalLocalResetExposure;
  }
});

describe('Auth APIs', () => {
  describe('POST /api/auth/check-email', () => {
    it('should return 200 for a registered email', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [databaseUser] } as never);

      const res = await request(app)
        .post('/api/auth/check-email')
        .send({ email: databaseUser.email });

      expect(res.status).toBe(200);
      expect(res.body.msg).toBe('Email exists');
      expect(res.body.data.email).toBe(databaseUser.email);
    });

    it('should return 404 for an unregistered email', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

      const res = await request(app)
        .post('/api/auth/check-email')
        .send({ email: 'unregistered@example.com' });

      expect(res.status).toBe(404);
      expect(res.body.msg).toBe('Email not registered.');
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app).post('/api/auth/check-email').send({});

      expect(res.status).toBe(400);
      expect(res.body.msg).toBe('Email is required');
    });
  });

  describe('POST /api/auth/password-reset/request', () => {
    it('returns a generic response for known and unknown emails', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: databaseUser.id,
              password_hash: 'stored-password-hash',
            },
          ],
        } as never)
        .mockResolvedValueOnce({ rows: [] } as never);

      const knownEmailResponse = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: databaseUser.email });
      const unknownEmailResponse = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: 'unknown@example.test' });

      expect(knownEmailResponse.status).toBe(200);
      expect(unknownEmailResponse.status).toBe(200);
      expect(knownEmailResponse.body.msg).toBe(unknownEmailResponse.body.msg);
      expect(knownEmailResponse.body.data.resetUrl).toContain('/reset-password?token=');
      expect(unknownEmailResponse.body.data).toEqual({});
    });

    it('does not expose a reset link in production', async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{ id: databaseUser.id, password_hash: 'stored-password-hash' }],
      } as never);

      try {
        const response = await request(app)
          .post('/api/auth/password-reset/request')
          .send({ email: databaseUser.email });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({});
        expect(JSON.stringify(response.body)).not.toContain('token');
      } finally {
        process.env.NODE_ENV = previousNodeEnv;
      }
    });

    it('does not expose a reset link without explicit local opt-in', async () => {
      delete process.env.EXPOSE_LOCAL_PASSWORD_RESET_URL;
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{ id: databaseUser.id, password_hash: 'stored-password-hash' }],
      } as never);

      const response = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: databaseUser.email });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({});
      expect(JSON.stringify(response.body)).not.toContain('token');
    });

    it('rejects an invalid email before querying the database', async () => {
      const response = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/password-reset/complete', () => {
    it('updates the password without creating an auth session', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [{ id: databaseUser.id, password_hash: 'stored-password-hash' }],
        } as never)
        .mockResolvedValueOnce({ rows: [{ password_hash: 'stored-password-hash' }] } as never)
        .mockResolvedValueOnce({ rows: [{ id: databaseUser.id }] } as never);

      const requestResponse = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: databaseUser.email });
      const resetUrl = requestResponse.body.data.resetUrl as string;
      const token = new URL(resetUrl).searchParams.get('token');

      const response = await request(app)
        .post('/api/auth/password-reset/complete')
        .send({ token, password: 'NewSecure1!', confirmPassword: 'NewSecure1!' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ passwordChanged: true });
      expect(response.headers['set-cookie']).toBeUndefined();

      const [query, values] = vi.mocked(pool.query).mock.calls[2] ?? [];
      expect(String(query)).toContain('UPDATE users');
      expect(String(query)).toContain('AND password_hash = $3');
      expect(values).toEqual(['NewSecure1!', databaseUser.id, 'stored-password-hash']);
    });

    it('rejects a reset token after the password hash has changed', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [{ id: databaseUser.id, password_hash: 'stored-password-hash' }],
        } as never)
        .mockResolvedValueOnce({ rows: [{ password_hash: 'new-password-hash' }] } as never);

      const requestResponse = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: databaseUser.email });
      const token = new URL(requestResponse.body.data.resetUrl).searchParams.get('token');

      const response = await request(app)
        .post('/api/auth/password-reset/complete')
        .send({ token, password: 'NewSecure1!', confirmPassword: 'NewSecure1!' });

      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('This password reset link is invalid or has expired.');
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('rejects an expired token without updating the database', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiredToken = await new SignJWT({
        purpose: 'password-reset',
        pv: 'unused-fingerprint',
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(databaseUser.id)
        .setIssuedAt(nowSeconds - 1200)
        .setExpirationTime(nowSeconds - 600)
        .sign(new TextEncoder().encode(process.env.AUTH_SESSION_SECRET));

      const response = await request(app).post('/api/auth/password-reset/complete').send({
        token: expiredToken,
        password: 'NewSecure1!',
        confirmPassword: 'NewSecure1!',
      });

      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('This password reset link is invalid or has expired.');
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should set an HttpOnly signed cookie without exposing a token', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [databaseUser] } as never);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: databaseUser.email, password: 'Database1!' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(databaseUser.id);
      expect(res.body.data.user.email).toBe(databaseUser.email);
      expect(res.body.data.user.name).toBe(databaseUser.name);
      expect(res.body.data.user.is_employee).toBe(true);
      expect(res.body.data.user.is_pet_owner).toBe(false);
      expect(res.body.data.user.employee_role).toBe('staff');
      expect(res.body.data.token).toBeUndefined();
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`${AUTH_COOKIE_NAME}=`),
          expect.stringContaining('HttpOnly'),
        ]),
      );
    });

    it('preserves the manager staff role reported by the employee row', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{ ...databaseUser, staff_role: 'manager' }],
      } as never);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: databaseUser.email, password: 'Database1!' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.is_employee).toBe(true);
      expect(res.body.data.user.employee_role).toBe('manager');
    });

    it('does not promote an employee with an unknown staff role', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{ ...databaseUser, staff_role: 'supervisor' }],
      } as never);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: databaseUser.email, password: 'Database1!' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.is_employee).toBe(true);
      expect(res.body.data.user.employee_role).toBeNull();
    });

    it('should map a pet_owner identity flag to the existing pet-parent role', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{ ...databaseUser, is_employee: false, is_pet_owner: true, staff_role: null }],
      } as never);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: databaseUser.email, password: 'Database1!' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(databaseUser.id);
      expect(res.body.data.user.is_employee).toBe(false);
      expect(res.body.data.user.is_pet_owner).toBe(true);
      expect(res.body.data.user.employee_role).toBeNull();
    });

    it('uses the same identity and staff role mapping for an existing Google employee', async () => {
      verifyIdTokenMock.mockResolvedValueOnce({
        getPayload: () => ({
          email: databaseUser.email,
          email_verified: true,
          given_name: 'Employee',
          family_name: 'One',
        }),
      });
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{ ...databaseUser, staff_role: 'manager' }],
      } as never);

      const res = await request(app).post('/api/auth/google').send({ idToken: 'google-id-token' });

      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({
        id: databaseUser.id,
        is_employee: true,
        is_pet_owner: false,
        employee_role: 'manager',
      });
      expect(res.body.data.token).toBeUndefined();
      expect(verifyIdTokenMock).toHaveBeenCalledWith({
        idToken: 'google-id-token',
        audience: 'test-google-client',
      });
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining(`${AUTH_COOKIE_NAME}=`)]),
      );
    });

    it('should reject invalid credentials', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: databaseUser.email, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.msg).toBe('Wrong password. Try again.');
    });

    it('should reject malformed credential types before querying the database', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ['employee@example.test'], password: 'Database1!' });

      expect(res.status).toBe(400);
      expect(res.body.msg).toBe('Email and password are required');
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should return 500 when the database lookup fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(pool.query).mockRejectedValueOnce(new Error('database unavailable'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: databaseUser.email, password: 'Database1!' });

      expect(res.status).toBe(500);
      expect(res.body.msg).toBe('Internal server error');
    });

    it('refuses the eleventh attempt on one account within the window', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
      // Case and spaces differ from the stored email; the budget still belongs to one account.
      const attempt = async (): Promise<SupertestResponse> =>
        request(app)
          .post('/api/auth/login')
          .send({ email: ' Employee@Example.test ', password: 'wrong-password' });

      for (let tries = 0; tries < 10; tries += 1) {
        expect((await attempt()).status).toBe(401);
      }
      const blocked = await attempt();

      expect(blocked.status).toBe(429);
      expect(blocked.headers['retry-after']).toBeDefined();
    });

    it('refuses a sign-in posted from another site', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'https://attacker.example')
        .send({ email: databaseUser.email, password: 'Database1!' });

      expect(res.status).toBe(403);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/google', () => {
    it('refuses an address Google has not verified and sets no cookie', async () => {
      verifyIdTokenMock.mockResolvedValueOnce({
        getPayload: () => ({
          email: databaseUser.email,
          email_verified: false,
          given_name: 'Employee',
          family_name: 'One',
        }),
      });

      const res = await request(app).post('/api/auth/google').send({ idToken: 'google-id-token' });

      expect(res.status).toBe(401);
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should reject a missing Google token', async () => {
      const res = await request(app).post('/api/auth/google').send({});

      expect(res.status).toBe(400);
      expect(res.body.msg).toBe('ID token is required');
    });
  });

  describe('GET /api/auth/me and POST /api/auth/logout', () => {
    it('resolves the current user and database role from the signed cookie', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [databaseUser] } as never);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: databaseUser.email, password: 'Database1!' });
      const cookies = loginResponse.headers['set-cookie']?.[0]?.split(';')[0] ?? '';

      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{ ...databaseUser, staff_role: 'manager' }],
      } as never);
      const meResponse = await request(app).get('/api/auth/me').set('Cookie', cookies);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user).toMatchObject({
        id: databaseUser.id,
        email: databaseUser.email,
        is_employee: true,
        is_pet_owner: false,
        employee_role: 'manager',
      });
    });

    it('clears only the browser cookie on logout', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ loggedOut: true });
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`${AUTH_COOKIE_NAME}=;`),
          expect.stringContaining('Expires=Thu, 01 Jan 1970 00:00:00 GMT'),
        ]),
      );
    });

    it('rejects a missing or malformed session cookie', async () => {
      await expect(request(app).get('/api/auth/me')).resolves.toMatchObject({ status: 401 });
      await expect(
        request(app).get('/api/auth/me').set('Cookie', `${AUTH_COOKIE_NAME}=not-a-signed-token`),
      ).resolves.toMatchObject({ status: 401 });
    });
  });

  describe('POST /api/auth/google/signup', () => {
    it('refuses to create an account for an address Google has not verified', async () => {
      verifyIdTokenMock.mockResolvedValueOnce({
        getPayload: () => ({
          email: 'google.parent@example.test',
          email_verified: false,
          given_name: 'Google',
          family_name: 'Parent',
        }),
      });

      const res = await request(app).post('/api/auth/google/signup').send({
        idToken: 'google-id-token',
        emergencyContactNumber: '+64 21 555 0001',
        firstName: 'Google',
        lastName: 'Parent',
        address: '2 Google Street, Auckland',
        dateOfBirth: '1991-02-02',
      });

      expect(res.status).toBe(401);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('creates a Google pet parent account through the transaction boundary', async () => {
      verifyIdTokenMock.mockResolvedValueOnce({
        getPayload: () => ({
          email: 'google.parent@example.test',
          email_verified: true,
          given_name: 'Google',
          family_name: 'Parent',
        }),
      });

      const client = {
        query: vi.fn(),
        release: vi.fn(),
      };
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
      vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
      client.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              id: '00000000-0000-4000-8000-000000000302',
              email: 'google.parent@example.test',
              username: 'google.parent',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ first_name: 'Google', last_name: 'Parent' }] })
        .mockResolvedValueOnce({});

      const res = await request(app).post('/api/auth/google/signup').send({
        idToken: 'google-id-token',
        emergencyContactNumber: '  +64 21 555 0001  ',
        firstName: '  Google  ',
        lastName: ' Parent ',
        address: ' 2 Google Street, Auckland ',
        dateOfBirth: '1991-02-02',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user).toEqual({
        id: '00000000-0000-4000-8000-000000000302',
        email: 'google.parent@example.test',
        name: 'Google Parent',
        is_employee: false,
        is_pet_owner: true,
        employee_role: null,
        isUsingTemporaryPassword: false,
      });
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith('COMMIT');
      expect(client.release).toHaveBeenCalledTimes(1);
      const [, ownerValues] = client.query.mock.calls[2] ?? [];
      expect(ownerValues).toEqual([
        '00000000-0000-4000-8000-000000000302',
        '+64 21 555 0001',
        'Google',
        'Parent',
        '2 Google Street, Auckland',
        '1991-02-02',
      ]);
    });
  });

  describe('POST /api/auth/signup', () => {
    it('creates a pet parent user and profile in one transaction', async () => {
      const client = {
        query: vi.fn(),
        release: vi.fn(),
      };
      vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
      client.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              id: '00000000-0000-4000-8000-000000000301',
              email: 'new.parent@example.test',
              username: 'new-parent',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ first_name: 'New', last_name: 'Parent' }],
        })
        .mockResolvedValueOnce({});

      const res = await request(app).post('/api/auth/signup').send({
        step: 'profile',
        email: 'new.parent@example.test',
        username: 'new-parent',
        password: 'Sunrise1!',
        confirmPassword: 'Sunrise1!',
        emergencyContactNumber: '+64 21 555 0000',
        firstName: 'New',
        lastName: 'Parent',
        address: '1 New Street, Auckland',
        dateOfBirth: '1990-01-01',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user).toEqual({
        id: '00000000-0000-4000-8000-000000000301',
        email: 'new.parent@example.test',
        name: 'New Parent',
        is_employee: false,
        is_pet_owner: true,
        employee_role: null,
        isUsingTemporaryPassword: false,
      });
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('passwordHash');
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenLastCalledWith('COMMIT');
      expect(client.release).toHaveBeenCalledTimes(1);

      const [userQuery, userValues] = client.query.mock.calls[1] ?? [];
      expect(String(userQuery)).toContain("crypt($3, gen_salt('bf', 12))");
      expect(String(userQuery)).not.toContain('Sunrise1!');
      expect(userValues).toEqual(['new-parent', 'new.parent@example.test', 'Sunrise1!']);

      const [ownerQuery, ownerValues] = client.query.mock.calls[2] ?? [];
      expect(String(ownerQuery)).toContain('INSERT INTO pet_owners');
      expect(ownerValues).toEqual([
        '00000000-0000-4000-8000-000000000301',
        '+64 21 555 0000',
        'New',
        'Parent',
        '1 New Street, Auckland',
        '1990-01-01',
      ]);
    });

    it('creates an account without the optional details, storing nothing for them', async () => {
      const client = { query: vi.fn(), release: vi.fn() };
      vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
      client.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              id: '00000000-0000-4000-8000-000000000301',
              email: 'new.parent@example.test',
              username: 'new-parent',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ first_name: 'New', last_name: 'Parent' }] })
        .mockResolvedValueOnce({});

      // Privacy Act IPP 1: emergency contact, address and date of birth are not needed to book.
      const res = await request(app).post('/api/auth/signup').send({
        step: 'profile',
        email: 'new.parent@example.test',
        username: 'new-parent',
        password: 'Sunrise1!',
        confirmPassword: 'Sunrise1!',
        emergencyContactNumber: '  ',
        firstName: 'New',
        lastName: 'Parent',
      });

      expect(res.status).toBe(201);
      const [, ownerValues] = client.query.mock.calls[2] ?? [];
      expect(ownerValues).toEqual([
        '00000000-0000-4000-8000-000000000301',
        null,
        'New',
        'Parent',
        null,
        null,
      ]);
    });

    it('still checks an optional detail that is given', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        step: 'profile',
        email: 'new.parent@example.test',
        username: 'new-parent',
        password: 'Sunrise1!',
        confirmPassword: 'Sunrise1!',
        emergencyContactNumber: 'call me',
        firstName: 'New',
        lastName: 'Parent',
        dateOfBirth: '2999-01-01',
      });

      expect(res.status).toBe(400);
      expect(res.body.data.fieldErrors.emergencyContactNumber).toBeDefined();
      expect(res.body.data.fieldErrors.dateOfBirth).toBeDefined();
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('returns a field conflict when the email already exists', async () => {
      const client = {
        query: vi.fn(),
        release: vi.fn(),
      };
      const duplicateError = Object.assign(new Error('duplicate email'), {
        code: '23505',
        constraint: 'users_email_key',
      });
      vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
      client.query.mockResolvedValueOnce({}).mockRejectedValueOnce(duplicateError);

      const res = await request(app).post('/api/auth/signup').send({
        step: 'profile',
        email: 'new.parent@example.test',
        username: 'new-parent',
        password: 'Sunrise1!',
        confirmPassword: 'Sunrise1!',
        emergencyContactNumber: '+64 21 555 0000',
        firstName: 'New',
        lastName: 'Parent',
        address: '1 New Street, Auckland',
        dateOfBirth: '1990-01-01',
      });

      expect(res.status).toBe(409);
      expect(res.body.data.fieldErrors.email).toEqual([
        { code: 'EMAIL_ALREADY_REGISTERED', message: 'This email is already registered.' },
      ]);
      expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/auth/signup/validate', () => {
    it('accepts a valid account step', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
      const res = await request(app).post('/api/auth/signup/validate').send({
        step: 'account',
        email: 'parent@example.com',
        username: 'parent',
        password: 'Sunrise1!',
        confirmPassword: 'Sunrise1!',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.fieldErrors).toEqual({});
    });

    it('returns separate password errors for a missing number and symbol', async () => {
      const res = await request(app).post('/api/auth/signup/validate').send({
        step: 'account',
        email: 'parent@example.com',
        username: 'parent',
        password: 'abcdefgh',
        confirmPassword: 'abcdefgh',
      });

      expect(res.status).toBe(400);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.fieldErrors.password).toEqual([
        {
          code: 'PASSWORD_MISSING_NUMBER',
          message: 'Password must contain at least one number.',
        },
        {
          code: 'PASSWORD_MISSING_SYMBOL',
          message: 'Password must contain at least one symbol.',
        },
      ]);
    });

    it('returns a password mismatch error from the backend', async () => {
      const res = await request(app).post('/api/auth/signup/validate').send({
        step: 'account',
        email: 'parent@example.com',
        username: 'parent',
        password: 'Sunrise1!',
        confirmPassword: 'Sunrise2!',
      });

      expect(res.status).toBe(400);
      expect(res.body.data.fieldErrors.confirmPassword).toEqual([
        {
          code: 'PASSWORD_MISMATCH',
          message: 'Passwords do not match.',
        },
      ]);
    });

    it('validates profile personal information and date boundaries', async () => {
      const personalInformationResponse = await request(app)
        .post('/api/auth/signup/validate')
        .send({
          step: 'profile',
          email: 'parent@example.com',
          username: 'parent',
          password: 'parent1!!',
          confirmPassword: 'parent1!!',
          emergencyContactNumber: '+64 21 555 0000',
          firstName: 'David',
          lastName: 'Parent',
          address: '1 New Street, Auckland',
          dateOfBirth: '1990-01-01',
        });

      expect(personalInformationResponse.status).toBe(400);
      expect(personalInformationResponse.body.data.fieldErrors.password).toEqual([
        {
          code: 'PASSWORD_PERSONAL_INFORMATION',
          message: 'Password should not include your personal information.',
        },
      ]);

      const futureDateResponse = await request(app).post('/api/auth/signup/validate').send({
        step: 'profile',
        email: 'parent@example.com',
        username: 'parent',
        password: 'Sunrise1!',
        confirmPassword: 'Sunrise1!',
        emergencyContactNumber: '+64 21 555 0000',
        firstName: 'David',
        lastName: 'Parent',
        address: '1 New Street, Auckland',
        dateOfBirth: '2999-01-01',
      });

      expect(futureDateResponse.status).toBe(400);
      expect(futureDateResponse.body.data.fieldErrors.dateOfBirth).toEqual([
        {
          code: 'VALIDATION_ERROR',
          message: 'Date of birth cannot be in the future.',
        },
      ]);
    });
  });
});
