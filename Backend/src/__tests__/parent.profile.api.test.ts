import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Request, type Response } from 'express';
import { pool } from '../config/database.js';
import parentProfileRoutes from '../routes/parent.profile.routes.js';
import facilityRoutes from '../routes/facility.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';

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

// `parent.profile.routes` requires a signed-in pet owner on every route. The
// session cookie itself belongs to `auth.middleware.test.ts`; here the caller
// is always `parentUser`, which is what lets the ownership checks below run.
vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requirePetParent: (req: Request, _res: Response, next: NextFunction): void => {
    req.user = parentUser;
    next();
  },
  // The facility routes mounted below are employee-only, and this suite is
  // about validation and database failure, not about who is signed in.
  requireEmployee: (_req: Request, _res: Response, next: NextFunction): void => next(),
  requireManager: (_req: Request, _res: Response, next: NextFunction): void => next(),
}));

/**
 * Parent profile and facility repositories only ever read PostgreSQL now.
 * There is no in-memory fixture to fall back to. `pool.connect` is mocked to
 * always reject, so every test here runs the same way a teammate with no
 * database configured would see it: validation happens before any database
 * call and still answers normally, and anything that would reach the database
 * fails closed with an explicit 503 rather than a fixture-shaped 200.
 *
 * Real read/write behaviour against a schema-complete database belongs in the
 * `api.postgres.*` integration suite, not here.
 */
vi.mock('../config/database.js', () => ({
  pool: { connect: vi.fn() },
}));

const app = express();
app.use(express.json());
app.use('/api/parent/profile', parentProfileRoutes);
app.use('/api/admin/facilities', facilityRoutes);
app.use(errorHandler);

const connectMock = pool.connect as ReturnType<typeof vi.fn>;

beforeEach(() => {
  connectMock.mockReset();
  connectMock.mockRejectedValue(new Error('connection refused'));
});

const DEMO_EMAIL = 'parent@example.com';

describe('GET /api/parent/profile', () => {
  it('fails closed with 503 rather than returning fixture data', async () => {
    const response = await request(app).get('/api/parent/profile').query({ email: DEMO_EMAIL });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });
});

describe('parent profile ownership', () => {
  it('refuses to edit a profile that is not the signed-in owner', async () => {
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000999')
      .send({ fullName: 'Someone Else' });

    expect(response.status).toBe(403);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('refuses to add a pet to a profile that is not the signed-in owner', async () => {
    const response = await request(app)
      .post('/api/parent/profile/00000000-0000-4000-8000-000000000999/pets')
      .send(NEW_PET);

    expect(response.status).toBe(403);
    expect(connectMock).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/parent/profile/:ownerId', () => {
  it('rejects a base64 avatar rather than accepting image bytes in the JSON body', async () => {
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000101')
      .send({ avatarUrl: 'data:image/png;base64,ZmFrZQ==' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('object storage');
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('refuses to change the email, because that is the account identity, before touching the database', async () => {
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000101')
      .send({ email: 'someone.else@example.com' });

    expect(response.status).toBe(400);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('rejects a blank name rather than storing one', async () => {
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000101')
      .send({ fullName: '   ' });

    expect(response.status).toBe(400);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('refuses a blank phone number, because the facility has to be able to call', async () => {
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000101')
      .send({ phone: '   ' });

    expect(response.status).toBe(400);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('refuses a phone number that is not dialable', async () => {
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000101')
      .send({ phone: '12345' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('valid phone number');
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('refuses a date of birth in the future rather than storing it', async () => {
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000101')
      .send({ dateOfBirth: '3000-01-01' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('future');
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('refuses a date of birth that is not a date', async () => {
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000101')
      .send({ dateOfBirth: 'not-a-date' });

    expect(response.status).toBe(400);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('fails closed with 503 for a validly-shaped edit', async () => {
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000101')
      .send({ fullName: 'Yuan Z', phone: '021 000 1111' });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('lets a parent leave the address and emergency contact blank', async () => {
    // Accounts made by the booking form have neither, so a blank value must pass validation
    // (the request then reaches the database, which this test keeps unavailable).
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000101')
      .send({ address: '', emergencyContactNumber: '  ' });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('still refuses an emergency contact number that is not dialable', async () => {
    const response = await request(app)
      .patch('/api/parent/profile/00000000-0000-4000-8000-000000000101')
      .send({ emergencyContactNumber: 'call me' });

    expect(response.status).toBe(400);
    expect(connectMock).not.toHaveBeenCalled();
  });
});

const NEW_PET = {
  name: 'Pepper',
  species: 'CAT',
  breed: 'Domestic shorthair',
  desexed: true,
  allergies: ['fish'],
};

describe('parent pet writes', () => {
  it('rejects a base64 pet photo rather than accepting image bytes in the JSON body', async () => {
    const response = await request(app)
      .post('/api/parent/profile/00000000-0000-4000-8000-000000000101/pets')
      .send({ ...NEW_PET, photoUrl: 'data:image/png;base64,ZmFrZQ==' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('object storage');
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('rejects a pet with an unknown species before touching the database', async () => {
    const response = await request(app)
      .post('/api/parent/profile/00000000-0000-4000-8000-000000000101/pets')
      .send({ ...NEW_PET, species: 'DRAGON' });

    expect(response.status).toBe(400);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('fails closed with 503 for a validly-shaped new pet', async () => {
    const response = await request(app)
      .post('/api/parent/profile/00000000-0000-4000-8000-000000000101/pets')
      .send(NEW_PET);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('fails closed with 503 rather than a 404 when deleting a pet', async () => {
    const response = await request(app).delete(
      '/api/parent/profile/pets/00000000-0000-4000-8000-000000000000',
    );

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });
});

describe('facilities', () => {
  it('fails closed with 503 rather than returning fixture facilities', async () => {
    const response = await request(app).get('/api/admin/facilities');

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('rejects a fractional or negative capacity before touching the database', async () => {
    const base = {
      name: 'Ponsonby Paws',
      suburb: 'Ponsonby',
      city: 'Auckland',
      size: 'LARGE',
      address: '14 Williamson Avenue, Auckland',
      phone: null,
      email: null,
      about: null,
    };

    const fractional = await request(app)
      .patch('/api/admin/facilities/f1')
      .send({ ...base, capacity: 12.5 });
    const negative = await request(app)
      .patch('/api/admin/facilities/f1')
      .send({ ...base, capacity: -1 });

    expect(fractional.status).toBe(400);
    expect(negative.status).toBe(400);
    expect(fractional.body.error.message).toContain('whole number');
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown facility size before touching the database', async () => {
    const response = await request(app).patch('/api/admin/facilities/f1').send({
      name: 'Ponsonby Paws',
      size: 'ENORMOUS',
      capacity: 10,
      address: '14 Williamson Avenue, Auckland',
    });

    expect(response.status).toBe(400);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('fails closed with 503 for a validly-shaped edit', async () => {
    const response = await request(app)
      .patch('/api/admin/facilities/00000000-0000-4000-8000-000000000f01')
      .send({
        name: 'Ponsonby Paws',
        suburb: 'Ponsonby',
        city: 'Auckland',
        size: 'MEDIUM',
        capacity: 18,
        address: '14 Williamson Avenue, Auckland',
        phone: '09 555 0180',
        email: 'ponsonby@wagstay.com',
        about: 'Updated blurb.',
      });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });
});
