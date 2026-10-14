import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { AUTH_COOKIE_NAME, createSessionToken } from '../services/auth.session.js';
import {
  closePostgresApiTestResources,
  deleteFeedbackByUuidOrRawAnswer,
  deleteUserByEmail,
  deleteUserByUuid,
  expectDatabaseRow,
  getTestApp,
  getTestPool,
} from './support/postgresApiTest.js';

const { generateObjectMock, verifyIdTokenMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  verifyIdTokenMock: vi.fn(),
}));

vi.mock('ai', () => ({
  generateObject: generateObjectMock,
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class MockOAuth2Client {
    public verifyIdToken(...args: unknown[]): unknown {
      return verifyIdTokenMock(...args);
    }
  },
}));

const TEST_PARENT_UUID = '00000000-0000-4000-8000-000000000101';
const TEST_PET_UUID = '00000000-0000-4000-8000-000000000501';

interface UserFixture {
  uuid: string;
  email: string;
  username: string;
}

const createIdentity = (prefix: string): Omit<UserFixture, 'uuid'> => {
  const token = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  return {
    email: `${prefix}.${token}@example.test`,
    username: `${prefix}_${token}`,
  };
};

const insertUser = async (options: {
  is_employee: boolean;
  is_pet_owner: boolean;
  password?: string;
}): Promise<UserFixture> => {
  const identity = createIdentity(options.is_employee ? 'employee' : 'parent');
  const uuid = crypto.randomUUID();
  if (options.password) {
    await getTestPool().query(
      `INSERT INTO users (
         uuid, username, email, is_employee, is_pet_owner, password_hash
       )
       VALUES ($1::uuid, $2, $3, $4, $5, crypt($6, gen_salt('bf', 12)))`,
      [
        uuid,
        identity.username,
        identity.email,
        options.is_employee,
        options.is_pet_owner,
        options.password,
      ],
    );
  } else {
    await getTestPool().query(
      `INSERT INTO users (uuid, username, email, is_employee, is_pet_owner)
       VALUES ($1::uuid, $2, $3, $4, $5)`,
      [uuid, identity.username, identity.email, options.is_employee, options.is_pet_owner],
    );
  }
  return { uuid, ...identity };
};

const postgresDescribe = process.env.TEST_DATABASE_URL ? describe.sequential : describe.skip;

postgresDescribe('PostgreSQL API read-back: auth and feedback', () => {
  let app: Awaited<ReturnType<typeof getTestApp>>;
  let parentSessionCookie: string;

  beforeAll(async () => {
    app = await getTestApp();
    await getTestPool().query('SELECT 1');
    parentSessionCookie = `${AUTH_COOKIE_NAME}=${await createSessionToken(TEST_PARENT_UUID)}`;
    generateObjectMock.mockResolvedValue({
      object: {
        summary: 'PostgreSQL integration summary',
        insights: ['PostgreSQL integration insight'],
      },
    });
    verifyIdTokenMock.mockImplementation(async () => ({
      getPayload: (): {
        email: string;
        email_verified: boolean;
        given_name: string;
        family_name: string;
      } => ({
        email: 'google.placeholder@example.test',
        email_verified: true,
        given_name: 'Google',
        family_name: 'Placeholder',
      }),
    }));
  });

  beforeEach(() => {
    generateObjectMock.mockClear();
    verifyIdTokenMock.mockClear();
  });

  afterAll(async () => {
    await closePostgresApiTestResources();
  });

  it('reads an existing email from PostgreSQL through the API', async () => {
    const user = await insertUser({ is_employee: true, is_pet_owner: false });
    try {
      const response = await request(app).post('/api/auth/check-email').send({ email: user.email });

      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe(user.email);
      const row = await expectDatabaseRow<{ uuid: string; email: string }>(
        'SELECT uuid::text AS uuid, email FROM users WHERE uuid = $1::uuid',
        [user.uuid],
      );
      expect(row.email).toBe(user.email);
    } finally {
      await deleteUserByUuid(user.uuid);
    }
  });

  it('authenticates a password user using PostgreSQL password_hash', async () => {
    const user = await insertUser({
      is_employee: true,
      is_pet_owner: false,
      password: 'Postgres1!',
    });
    try {
      const response = await request(app).post('/api/auth/login').send({
        email: user.email,
        password: 'Postgres1!',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe(user.email);
      expect(response.body.data.user.is_employee).toBe(true);
    } finally {
      await deleteUserByUuid(user.uuid);
    }
  });

  it('logs an existing Google user in from PostgreSQL', async () => {
    const user = await insertUser({ is_employee: true, is_pet_owner: false });
    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () => ({
        email: user.email,
        email_verified: true,
        given_name: 'Existing',
        family_name: 'Google User',
      }),
    });

    try {
      const response = await request(app).post('/api/auth/google').send({ idToken: 'test-token' });

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe(user.email);
      expect(response.body.data.user.is_employee).toBe(true);
    } finally {
      await deleteUserByUuid(user.uuid);
    }
  });

  it('creates a Google signup and reads users plus pet_owners back from PostgreSQL', async () => {
    const email = `google.${crypto.randomUUID().replaceAll('-', '')}@example.test`;
    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () => ({ email, given_name: 'Google', family_name: 'Parent' }),
    });

    try {
      const response = await request(app).post('/api/auth/google/signup').send({
        idToken: 'test-token',
        emergencyContactNumber: '+64 21 555 0001',
        firstName: 'Google',
        lastName: 'Parent',
        address: '2 Google Street, Auckland',
        dateOfBirth: '1991-02-02',
      });

      expect(response.status).toBe(201);
      const row = await expectDatabaseRow<{
        uuid: string;
        email: string;
        first_name: string;
        last_name: string;
      }>(
        `SELECT u.uuid::text AS uuid, u.email, o.first_name, o.last_name
         FROM users u
         JOIN pet_owners o ON o.users_uuid = u.uuid
         WHERE u.email = $1`,
        [email],
      );
      expect(row.email).toBe(email);
      expect(row.first_name).toBe('Google');
      expect(row.last_name).toBe('Parent');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  it('creates a password signup and reads users plus pet_owners back from PostgreSQL', async () => {
    const email = `signup.${crypto.randomUUID().replaceAll('-', '')}@example.test`;
    const username = `signup_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;

    try {
      const response = await request(app).post('/api/auth/signup').send({
        step: 'profile',
        email,
        username,
        password: 'Postgres1!',
        confirmPassword: 'Postgres1!',
        emergencyContactNumber: '+64 21 555 0002',
        firstName: 'Database',
        lastName: 'Parent',
        address: '3 Database Street, Auckland',
        dateOfBirth: '1992-03-03',
      });

      expect(response.status).toBe(201);
      const row = await expectDatabaseRow<{
        uuid: string;
        email: string;
        username: string;
        first_name: string;
        last_name: string;
        password_hash: string | null;
      }>(
        `SELECT u.uuid::text AS uuid, u.email, u.username, o.first_name, o.last_name, u.password_hash
         FROM users u
         JOIN pet_owners o ON o.users_uuid = u.uuid
         WHERE u.email = $1`,
        [email],
      );
      expect(row.username).toBe(username);
      expect(row.first_name).toBe('Database');
      expect(row.last_name).toBe('Parent');
      expect(row.password_hash).toBeTruthy();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  it('validates duplicate signup data against PostgreSQL', async () => {
    const user = await insertUser({ is_employee: false, is_pet_owner: true });
    try {
      const response = await request(app).post('/api/auth/signup/validate').send({
        step: 'account',
        email: user.email,
        username: user.username,
        password: 'Postgres1!',
        confirmPassword: 'Postgres1!',
      });

      expect(response.status).toBe(409);
      expect(response.body.data.fieldErrors.email).toBeDefined();
      expect(response.body.data.fieldErrors.username).toBeDefined();
    } finally {
      await deleteUserByUuid(user.uuid);
    }
  });

  it('submits feedback and reads the feedback and timeline rows back from PostgreSQL', async () => {
    const rawAnswer = `PostgreSQL API feedback ${crypto.randomUUID()}`;
    let createdFeedbackUuid: string | undefined;

    try {
      const response = await request(app)
        .post('/api/feedback')
        .set('Cookie', parentSessionCookie)
        .field(
          'payload',
          JSON.stringify({
            pet_uuid: TEST_PET_UUID,
            pet_owners_uuid: '00000000-0000-4000-8000-000000000102',
            category: 'Praise',
            rating_details: {
              Professional: 5,
              Service: 4,
              Communication: 4,
              Safety: 5,
              Cost: 4,
            },
            raw_answer: rawAnswer,
          }),
        );
      const responseUuid = response.body?.uuid;
      createdFeedbackUuid = typeof responseUuid === 'string' ? responseUuid : undefined;

      expect(response.status).toBe(201);
      const feedback = await expectDatabaseRow<{
        uuid: string;
        pet_uuid: string;
        pet_owners_uuid: string;
        category: string;
        current_status: string;
        raw_answer: string;
      }>(
        `SELECT uuid::text AS uuid, pet_uuid::text AS pet_uuid,
                pet_owners_uuid::text AS pet_owners_uuid, category,
                current_status, raw_answer
         FROM feedback
         WHERE uuid = $1::uuid`,
        [responseUuid],
      );
      expect(feedback.pet_uuid).toBe(TEST_PET_UUID);
      expect(feedback.pet_owners_uuid).toBe(TEST_PARENT_UUID);
      expect(feedback.category).toBe('Praise');
      expect(feedback.current_status).toBe('submitted');
      expect(feedback.raw_answer).toBe(rawAnswer);

      const timeline = await expectDatabaseRow<{ step: string; feedback_uuid: string }>(
        `SELECT step, feedback_uuid::text AS feedback_uuid
         FROM feedback_timeline_events
         WHERE feedback_uuid = $1::uuid AND step = 'submitted'`,
        [responseUuid],
      );
      expect(timeline.feedback_uuid).toBe(responseUuid);
    } finally {
      await deleteFeedbackByUuidOrRawAnswer(createdFeedbackUuid, rawAnswer);
    }
  });

  it('resolves a Suggestion manager recipient from PostgreSQL', async () => {
    const rawAnswer = `PostgreSQL manager recipient ${crypto.randomUUID()}`;
    let createdFeedbackUuid: string | undefined;
    const manager = await expectDatabaseRow<{ uuid: string; email: string }>(
      `SELECT u.uuid::text AS uuid, u.email
       FROM users u
       JOIN employees e ON e.users_uuid = u.uuid
       WHERE e.staff_role = 'manager'
       ORDER BY COALESCE(u.display_name, u.username), u.uuid
       LIMIT 1`,
      [],
    );
    const managerNotificationLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const response = await request(app)
        .post('/api/feedback')
        .set('Cookie', parentSessionCookie)
        .field(
          'payload',
          JSON.stringify({
            pet_uuid: TEST_PET_UUID,
            pet_owners_uuid: TEST_PARENT_UUID,
            category: 'Suggestion',
            rating_details: {
              Professional: 5,
              Service: 5,
              Communication: 4,
              Safety: 5,
              Cost: 4,
            },
            raw_answer: rawAnswer,
          }),
        );
      createdFeedbackUuid =
        typeof response.body?.uuid === 'string' ? response.body.uuid : undefined;

      expect(response.status).toBe(201);
      const timeline = await expectDatabaseRow<{ event_payload: { ownerId?: string } }>(
        `SELECT event_payload
         FROM feedback_timeline_events
         WHERE feedback_uuid = $1::uuid AND step = 'captured'`,
        [createdFeedbackUuid],
      );
      expect(timeline.event_payload.ownerId).toBe(manager.uuid);
      expect(managerNotificationLog.mock.calls.flat().join(' ')).toContain(manager.email);
    } finally {
      try {
        await deleteFeedbackByUuidOrRawAnswer(createdFeedbackUuid, rawAnswer);
      } finally {
        managerNotificationLog.mockRestore();
      }
    }
  });
});
