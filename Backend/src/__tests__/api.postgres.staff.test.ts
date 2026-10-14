import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { AUTH_COOKIE_NAME, createSessionToken } from '../services/auth.session.js';
import {
  closePostgresApiTestResources,
  deleteUserByEmail,
  deleteUserByUuid,
  expectDatabaseRow,
  getTestApp,
  getTestPool,
} from './support/postgresApiTest.js';

const MANAGER_EMAIL = 'manager@wagstay.com';
const STAFF_FACILITY_UUID = '00000000-0000-4000-8000-000000000301';

interface StaffFixture {
  id: string;
  email: string;
  temporaryPassword: string;
}

interface StaffCreateInput {
  name: string;
  email: string;
  facilityUuid: string;
  employmentType: 'full-time' | 'part-time';
  employee_role: 'manager' | 'staff';
  status: 'active' | 'on-leave';
}

const createStaffInput = (): StaffCreateInput => {
  const token = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  return {
    name: `API Staff ${token}`,
    email: `api.staff.${token}@example.test`,
    facilityUuid: STAFF_FACILITY_UUID,
    employmentType: 'full-time',
    employee_role: 'staff',
    status: 'active',
  };
};

const postgresDescribe = process.env.TEST_DATABASE_URL ? describe.sequential : describe.skip;

postgresDescribe('PostgreSQL API read-back: staff account provisioning', () => {
  let app: Awaited<ReturnType<typeof getTestApp>>;
  let managerSessionCookie: string;

  const createStaff = async (): Promise<{ input: StaffCreateInput; fixture: StaffFixture }> => {
    const input = createStaffInput();
    try {
      const response = await request(app)
        .post('/api/admin/staff')
        .set('Cookie', managerSessionCookie)
        .send(input);
      const staffId = response.body?.staff?.id;
      const temporaryPassword = response.body?.temporaryPassword;

      expect(response.status).toBe(201);
      expect(typeof staffId).toBe('string');
      expect(temporaryPassword).toEqual(expect.any(String));
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.body.staff).toMatchObject({
        email: input.email,
      });
      return {
        input,
        fixture: {
          id: staffId as string,
          email: input.email,
          temporaryPassword: temporaryPassword as string,
        },
      };
    } catch (error: unknown) {
      await deleteUserByEmail(input.email);
      throw error;
    }
  };

  beforeAll(async () => {
    app = await getTestApp();
    await getTestPool().query('SELECT 1');
    const manager = await expectDatabaseRow<{ uuid: string }>(
      'SELECT uuid::text AS uuid FROM users WHERE email = $1',
      [MANAGER_EMAIL],
    );
    managerSessionCookie = `${AUTH_COOKIE_NAME}=${await createSessionToken(manager.uuid)}`;

    const bootstrapResponse = await request(app)
      .get('/api/admin/staff')
      .set('Cookie', managerSessionCookie);
    expect(bootstrapResponse.status).toBe(200);
  });

  afterAll(async () => {
    await closePostgresApiTestResources();
  });

  it('reads the current staff member by the authenticated employee email', async () => {
    const { fixture } = await createStaff();

    try {
      const staffCookie = `${AUTH_COOKIE_NAME}=${await createSessionToken(fixture.id)}`;
      const response = await request(app)
        .get('/api/admin/staff/me')
        .query({ email: fixture.email })
        .set('Cookie', staffCookie);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(fixture.id);
      const row = await expectDatabaseRow<{ uuid: string; email: string }>(
        'SELECT uuid::text AS uuid, email FROM users WHERE uuid = $1::uuid',
        [fixture.id],
      );
      expect(row.email).toBe(fixture.email);
    } finally {
      await deleteUserByUuid(fixture.id);
    }
  });

  it('lists a created staff member from PostgreSQL without returning the temporary password', async () => {
    const { fixture } = await createStaff();

    try {
      const response = await request(app)
        .get('/api/admin/staff')
        .set('Cookie', managerSessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: fixture.id,
            email: fixture.email,
          }),
        ]),
      );
      expect(JSON.stringify(response.body)).not.toContain(fixture.temporaryPassword);
    } finally {
      await deleteUserByUuid(fixture.id);
    }
  });

  it('creates a staff member with required employment fields and a password hash', async () => {
    const { input, fixture } = await createStaff();

    try {
      const row = await expectDatabaseRow<{
        uuid: string;
        email: string;
        display_name: string;
        staff_role: string;
        staff_status: string;
        facility_uuid: string;
        employment_type: string;
        password_hash: string | null;
      }>(
        `SELECT u.uuid::text AS uuid, u.email, u.display_name, u.password_hash,
                e.staff_role, e.staff_status,
                e.facility_uuid::text AS facility_uuid, e.employment_type
         FROM users u
         JOIN employees e ON e.users_uuid = u.uuid
         WHERE u.email = $1`,
        [input.email],
      );
      expect(row.display_name).toBe(input.name);
      expect(row.staff_role).toBe('staff');
      expect(row.staff_status).toBe('active');
      expect(row.facility_uuid).toBe(input.facilityUuid);
      expect(row.employment_type).toBe(input.employmentType);
      expect(row.password_hash).toBeTruthy();
      expect(row.password_hash).toMatch(/^temporary:\$2/);
      expect(row.password_hash).not.toBe(fixture.temporaryPassword);
    } finally {
      await deleteUserByUuid(fixture.id);
    }
  });

  it('reads staff detail and assignments from PostgreSQL', async () => {
    const { fixture } = await createStaff();

    try {
      const detailResponse = await request(app)
        .get(`/api/admin/staff/${fixture.id}`)
        .set('Cookie', managerSessionCookie);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body).toMatchObject({ id: fixture.id, email: fixture.email });

      const assignmentsResponse = await request(app)
        .get(`/api/admin/staff/${fixture.id}/assignments`)
        .set('Cookie', managerSessionCookie);
      expect(assignmentsResponse.status).toBe(200);
      expect(assignmentsResponse.body).toEqual([]);
    } finally {
      await deleteUserByUuid(fixture.id);
    }
  });

  it('updates manager-controlled employment fields without changing the staff-owned name', async () => {
    const { input, fixture } = await createStaff();
    const updatedEmail = `managed.${crypto.randomUUID().replaceAll('-', '')}@example.test`;

    try {
      const response = await request(app)
        .patch(`/api/admin/staff/${fixture.id}`)
        .set('Cookie', managerSessionCookie)
        .send({
          email: updatedEmail,
          employee_role: 'manager',
          status: 'on-leave',
          facilityUuid: input.facilityUuid,
          employmentType: 'part-time',
          title: 'Grooming Specialist',
          shiftDetails: 'Tuesday to Saturday, 08:00 to 16:00',
        });

      expect(response.status).toBe(200);
      // The two `employees` columns the profile screens read back.
      expect(response.body.title).toBe('Grooming Specialist');
      expect(response.body.shiftDetails).toBe('Tuesday to Saturday, 08:00 to 16:00');

      const row = await expectDatabaseRow<{
        email: string;
        display_name: string;
        staff_role: string;
        staff_status: string;
        employment_type: string;
        title: string | null;
        shift_details: string | null;
      }>(
        `SELECT u.email, u.display_name, e.staff_role, e.staff_status, e.employment_type,
                e.title, e.shift_details
         FROM users u
         JOIN employees e ON e.users_uuid = u.uuid
         WHERE u.uuid = $1::uuid`,
        [fixture.id],
      );
      expect(row.email).toBe(updatedEmail);
      expect(row.display_name).toBe(input.name);
      expect(row.staff_role).toBe('manager');
      expect(row.staff_status).toBe('on-leave');
      expect(row.employment_type).toBe('part-time');
      expect(row.title).toBe('Grooming Specialist');
      expect(row.shift_details).toBe('Tuesday to Saturday, 08:00 to 16:00');

      // Both columns are nullable, so a blank really clears them.
      const cleared = await request(app)
        .patch(`/api/admin/staff/${fixture.id}`)
        .set('Cookie', managerSessionCookie)
        .send({ title: '', shiftDetails: '' });
      expect(cleared.status).toBe(200);
      expect(cleared.body.title).toBeNull();
      expect(cleared.body.shiftDetails).toBeNull();
    } finally {
      await deleteUserByUuid(fixture.id);
    }
  });

  it('updates the own staff profile using the authenticated staff identity', async () => {
    const { fixture } = await createStaff();

    try {
      const staffCookie = `${AUTH_COOKIE_NAME}=${await createSessionToken(fixture.id)}`;
      const response = await request(app)
        .patch(`/api/admin/staff/${fixture.id}/self`)
        .set('Cookie', staffCookie)
        .send({
          name: 'Self Edited Staff',
          phone: '+64 21 555 0401',
          avatarUrl: 'https://example.test/avatar.png',
        });

      expect(response.status).toBe(200);
      const row = await expectDatabaseRow<{
        display_name: string;
        phone: string;
        avatar_url: string;
      }>('SELECT display_name, phone, avatar_url FROM users WHERE uuid = $1::uuid', [fixture.id]);
      expect(row.display_name).toBe('Self Edited Staff');
      expect(row.phone).toBe('+64 21 555 0401');
      expect(row.avatar_url).toBe('https://example.test/avatar.png');
    } finally {
      await deleteUserByUuid(fixture.id);
    }
  });

  it('requires a manager session to create an employee account', async () => {
    const staff = await expectDatabaseRow<{ uuid: string }>(
      'SELECT uuid::text AS uuid FROM users WHERE email = $1',
      ['staff1@wagstay.com'],
    );
    const input = createStaffInput();

    try {
      const response = await request(app)
        .post('/api/admin/staff')
        .set('Cookie', `${AUTH_COOKIE_NAME}=${await createSessionToken(staff.uuid)}`)
        .send(input);

      expect(response.status).toBe(403);
    } finally {
      await deleteUserByEmail(input.email);
    }
  });

  it('forces the generated temporary password to be replaced on first login', async () => {
    const { fixture } = await createStaff();
    const newPassword = 'NewSecure1!';

    try {
      const temporaryLogin = await request(app).post('/api/auth/login').send({
        email: fixture.email,
        password: fixture.temporaryPassword,
      });
      expect(temporaryLogin.status).toBe(200);
      expect(temporaryLogin.body.data.user.isUsingTemporaryPassword).toBe(true);
      const staffCookie = temporaryLogin.headers['set-cookie']?.[0]?.split(';')[0] ?? '';

      const changeResponse = await request(app)
        .post('/api/auth/first-login-password')
        .set('Cookie', staffCookie)
        .send({ password: newPassword, confirmPassword: newPassword });
      expect(changeResponse.status).toBe(200);
      expect(changeResponse.body.data).toEqual({ passwordChanged: true });

      const newLogin = await request(app).post('/api/auth/login').send({
        email: fixture.email,
        password: newPassword,
      });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.data.user.isUsingTemporaryPassword).toBe(false);

      const oldLogin = await request(app).post('/api/auth/login').send({
        email: fixture.email,
        password: fixture.temporaryPassword,
      });
      expect(oldLogin.status).toBe(401);
    } finally {
      await deleteUserByUuid(fixture.id);
    }
  });

  it('deletes a staff member through the authenticated manager session', async () => {
    const { fixture } = await createStaff();

    try {
      const response = await request(app)
        .delete(`/api/admin/staff/${fixture.id}`)
        .set('Cookie', managerSessionCookie);

      expect(response.status).toBe(204);
      const row = await getTestPool().query('SELECT 1 FROM users WHERE uuid = $1::uuid', [
        fixture.id,
      ]);
      expect(row.rowCount).toBe(0);
    } finally {
      await deleteUserByUuid(fixture.id);
    }
  });
});
