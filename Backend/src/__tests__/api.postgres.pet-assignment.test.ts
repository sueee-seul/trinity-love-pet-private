import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { AUTH_COOKIE_NAME, createSessionToken } from '../services/auth.session.js';
import {
  closePostgresApiTestResources,
  deleteUserByUuid,
  expectDatabaseRow,
  getTestApp,
  getTestPool,
} from './support/postgresApiTest.js';

const MANAGER_EMAIL = 'manager@wagstay.com';
const EMPLOYEE_UUID = '00000000-0000-4000-8000-000000000202';
const PET_UUID = '00000000-0000-4000-8000-000000000501';
const OTHER_PET_UUID = '00000000-0000-4000-8000-000000000502';

const postgresDescribe = process.env.TEST_DATABASE_URL ? describe.sequential : describe.skip;

postgresDescribe('PostgreSQL API read-back: Pet assignments', () => {
  let app: Awaited<ReturnType<typeof getTestApp>>;
  let managerSessionCookie: string;

  beforeAll(async () => {
    app = await getTestApp();
    await getTestPool().query('SELECT 1');
    const manager = await expectDatabaseRow<{ uuid: string }>(
      'SELECT uuid::text AS uuid FROM users WHERE email = $1',
      [MANAGER_EMAIL],
    );
    managerSessionCookie = `${AUTH_COOKIE_NAME}=${await createSessionToken(manager.uuid)}`;
  });

  afterAll(async () => {
    await closePostgresApiTestResources();
  });

  it('creates, reads, rejects duplicates, and deletes a dated shift assignment', async () => {
    const assignmentDate = '2099-01-01';
    const assignmentInput = {
      employeeUuid: EMPLOYEE_UUID,
      assignmentDate,
      shiftStart: '06:30',
      shiftEnd: '14:30',
    };

    try {
      const createResponse = await request(app)
        .post(`/api/admin/pets/${PET_UUID}/assignments`)
        .set('Cookie', managerSessionCookie)
        .send(assignmentInput);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toMatchObject({
        petUuid: PET_UUID,
        employeeUuid: EMPLOYEE_UUID,
        assignmentDate,
        shiftStart: '06:30:00',
        shiftEnd: '14:30:00',
      });
      const assignmentUuid = createResponse.body.uuid as string;

      const persisted = await expectDatabaseRow<{
        uuid: string;
        pet_uuid: string;
        employees_uuid: string;
        assignment_date: string;
        shift_start: string;
        shift_end: string;
      }>(
        `SELECT uuid::text AS uuid, pet_uuid::text AS pet_uuid,
                employees_uuid::text AS employees_uuid,
                assignment_date::text AS assignment_date,
                shift_start::text AS shift_start,
                shift_end::text AS shift_end
         FROM employee_assignments
         WHERE uuid = $1::uuid`,
        [assignmentUuid],
      );
      expect(persisted).toMatchObject({
        uuid: assignmentUuid,
        pet_uuid: PET_UUID,
        employees_uuid: EMPLOYEE_UUID,
        assignment_date: assignmentDate,
        shift_start: '06:30:00',
        shift_end: '14:30:00',
      });

      const listResponse = await request(app)
        .get(`/api/admin/pets/${PET_UUID}/assignments`)
        .set('Cookie', managerSessionCookie);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ uuid: assignmentUuid, employeeUuid: EMPLOYEE_UUID }),
        ]),
      );

      const duplicateResponse = await request(app)
        .post(`/api/admin/pets/${PET_UUID}/assignments`)
        .set('Cookie', managerSessionCookie)
        .send(assignmentInput);
      expect(duplicateResponse.status).toBe(409);

      const count = await getTestPool().query(
        `SELECT COUNT(*)::int AS count
         FROM employee_assignments
         WHERE uuid = $1::uuid`,
        [assignmentUuid],
      );
      expect(count.rows[0]?.count).toBe(1);

      const wrongPetDeleteResponse = await request(app)
        .delete(`/api/admin/pets/${OTHER_PET_UUID}/assignments/${assignmentUuid}`)
        .set('Cookie', managerSessionCookie);
      expect(wrongPetDeleteResponse.status).toBe(404);

      const deleteResponse = await request(app)
        .delete(`/api/admin/pets/${PET_UUID}/assignments/${assignmentUuid}`)
        .set('Cookie', managerSessionCookie);
      expect(deleteResponse.status).toBe(204);

      const deleted = await getTestPool().query(
        'SELECT 1 FROM employee_assignments WHERE uuid = $1::uuid',
        [assignmentUuid],
      );
      expect(deleted.rowCount).toBe(0);
    } finally {
      await getTestPool().query(
        `DELETE FROM employee_assignments
         WHERE pet_uuid = $1::uuid
           AND employees_uuid = $2::uuid
           AND assignment_date = $3::date`,
        [PET_UUID, EMPLOYEE_UUID, assignmentDate],
      );
    }
  });

  it('rejects a duplicate all-day assignment despite nullable shift_start', async () => {
    const assignmentDate = '2099-01-02';
    const assignmentInput = {
      employeeUuid: EMPLOYEE_UUID,
      assignmentDate,
      shiftStart: null,
      shiftEnd: null,
    };

    try {
      const firstResponse = await request(app)
        .post(`/api/admin/pets/${PET_UUID}/assignments`)
        .set('Cookie', managerSessionCookie)
        .send(assignmentInput);
      expect(firstResponse.status).toBe(201);

      const duplicateResponse = await request(app)
        .post(`/api/admin/pets/${PET_UUID}/assignments`)
        .set('Cookie', managerSessionCookie)
        .send(assignmentInput);
      expect(duplicateResponse.status).toBe(409);

      const rows = await getTestPool().query(
        `SELECT uuid
         FROM employee_assignments
         WHERE pet_uuid = $1::uuid
           AND employees_uuid = $2::uuid
           AND assignment_date = $3::date
           AND shift_start IS NULL`,
        [PET_UUID, EMPLOYEE_UUID, assignmentDate],
      );
      expect(rows.rowCount).toBe(1);
    } finally {
      await getTestPool().query(
        `DELETE FROM employee_assignments
         WHERE pet_uuid = $1::uuid
           AND employees_uuid = $2::uuid
           AND assignment_date = $3::date`,
        [PET_UUID, EMPLOYEE_UUID, assignmentDate],
      );
    }
  });

  it('blocks staff deletion while a persisted assignment remains', async () => {
    const token = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
    const email = `assignment.delete.${token}@example.test`;
    let staffUuid: string | undefined;
    const assignmentDate = '2099-01-03';

    try {
      const createStaffResponse = await request(app)
        .post('/api/admin/staff')
        .set('Cookie', managerSessionCookie)
        .send({
          name: `Assignment Delete ${token}`,
          email,
          facilityUuid: '00000000-0000-4000-8000-000000000301',
          employmentType: 'full-time',
          employee_role: 'staff',
          status: 'active',
        });
      expect(createStaffResponse.status).toBe(201);
      staffUuid = createStaffResponse.body.staff.id as string;

      const assignmentResponse = await request(app)
        .post(`/api/admin/pets/${PET_UUID}/assignments`)
        .set('Cookie', managerSessionCookie)
        .send({
          employeeUuid: staffUuid,
          assignmentDate,
          shiftStart: null,
          shiftEnd: null,
        });
      expect(assignmentResponse.status).toBe(201);

      const deleteResponse = await request(app)
        .delete(`/api/admin/staff/${staffUuid}`)
        .set('Cookie', managerSessionCookie);
      expect(deleteResponse.status).toBe(409);

      const persistedStaff = await getTestPool().query(
        'SELECT 1 FROM users WHERE uuid = $1::uuid',
        [staffUuid],
      );
      const persistedAssignment = await getTestPool().query(
        `SELECT 1
         FROM employee_assignments
         WHERE employees_uuid = $1::uuid
           AND pet_uuid = $2::uuid
           AND assignment_date = $3::date`,
        [staffUuid, PET_UUID, assignmentDate],
      );
      expect(persistedStaff.rowCount).toBe(1);
      expect(persistedAssignment.rowCount).toBe(1);
    } finally {
      if (staffUuid) {
        await getTestPool().query(
          `DELETE FROM employee_assignments
           WHERE employees_uuid = $1::uuid
             AND pet_uuid = $2::uuid
             AND assignment_date = $3::date`,
          [staffUuid, PET_UUID, assignmentDate],
        );
        await deleteUserByUuid(staffUuid);
      } else {
        await getTestPool().query('DELETE FROM users WHERE email = $1', [email]);
      }
    }
  });
});
