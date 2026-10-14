import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { AUTH_COOKIE_NAME, createSessionToken } from '../services/auth.session.js';
import {
  closePostgresApiTestResources,
  deleteFeedbackByUuid,
  expectDatabaseRow,
  getTestApp,
  getTestPool,
} from './support/postgresApiTest.js';

const TEST_PARENT_UUID = '00000000-0000-4000-8000-000000000101';
const TEST_PET_UUID = '00000000-0000-4000-8000-000000000501';
const TEST_EMPLOYEE_UUID = '00000000-0000-4000-8000-000000000201';

interface FeedbackFixture {
  uuid: string;
  category: 'Issue' | 'Suggestion' | 'Praise';
}

const createFeedbackFixture = async (
  category: FeedbackFixture['category'],
): Promise<FeedbackFixture> => {
  const uuid = crypto.randomUUID();
  try {
    await getTestPool().query(
      `INSERT INTO feedback (
         uuid, pet_uuid, pet_owners_uuid, category, current_status,
         rating, rating_details, raw_answer, ai_insights
       )
       VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4, 'submitted', 4.00,
         $5::jsonb, $6, $7::jsonb
       )`,
      [
        uuid,
        TEST_PET_UUID,
        TEST_PARENT_UUID,
        category,
        JSON.stringify({ Professional: 4, Service: 4, Communication: 4, Safety: 4, Cost: 4 }),
        `Admin feedback PostgreSQL test ${uuid}`,
        JSON.stringify({ summary: 'Integration test feedback', insights: [] }),
      ],
    );

    const step = category === 'Suggestion' ? 'captured' : 'submitted';
    const payload =
      category === 'Suggestion'
        ? {
            workflow_type: 'suggestion',
            ownerId: 'u1',
            decision: null,
            evidenceSummary: null,
            decisionReason: null,
            nextReviewAt: null,
            actor: 'System',
          }
        : { actor: 'System' };
    await getTestPool().query(
      `INSERT INTO feedback_timeline_events (feedback_uuid, step, event_payload)
       VALUES ($1::uuid, $2, $3::jsonb)`,
      [uuid, step, JSON.stringify(payload)],
    );
    return { uuid, category };
  } catch (error: unknown) {
    await deleteFeedbackByUuid(uuid);
    throw error;
  }
};

const postgresDescribe = process.env.TEST_DATABASE_URL ? describe.sequential : describe.skip;

postgresDescribe('PostgreSQL API read-back: admin feedback', () => {
  let app: Awaited<ReturnType<typeof getTestApp>>;
  let employeeSessionCookie: string;

  beforeAll(async () => {
    app = await getTestApp();
    await getTestPool().query('SELECT 1');
    employeeSessionCookie = `${AUTH_COOKIE_NAME}=${await createSessionToken(TEST_EMPLOYEE_UUID)}`;
  });

  afterAll(async () => {
    await closePostgresApiTestResources();
  });

  it('reads a feedback list row from PostgreSQL', async () => {
    const fixture = await createFeedbackFixture('Praise');
    try {
      const response = await request(app)
        .get('/api/admin/feedback')
        .set('Cookie', employeeSessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.some((item: { uuid: string }) => item.uuid === fixture.uuid)).toBe(true);
    } finally {
      await deleteFeedbackByUuid(fixture.uuid);
    }
  });

  it('reads employee assignees from PostgreSQL', async () => {
    const response = await request(app)
      .get('/api/admin/feedback/assignees')
      .set('Cookie', employeeSessionCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: TEST_EMPLOYEE_UUID })]),
    );
  });

  it('reads the feedback snapshot and timeline from PostgreSQL', async () => {
    const fixture = await createFeedbackFixture('Praise');
    try {
      const response = await request(app)
        .get('/api/admin/feedback/snapshot')
        .set('Cookie', employeeSessionCookie);

      expect(response.status).toBe(200);
      const item = response.body.find((entry: { uuid: string }) => entry.uuid === fixture.uuid);
      expect(item).toBeDefined();
      expect(item.timeline).toEqual(
        expect.arrayContaining([expect.objectContaining({ step: 'submitted' })]),
      );
    } finally {
      await deleteFeedbackByUuid(fixture.uuid);
    }
  });

  it('reads feedback detail and persists the read-on-open state', async () => {
    const fixture = await createFeedbackFixture('Praise');
    try {
      const response = await request(app)
        .get(`/api/admin/feedback/${fixture.uuid}`)
        .set('Cookie', employeeSessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.uuid).toBe(fixture.uuid);
      const row = await expectDatabaseRow<{ is_read: boolean }>(
        'SELECT is_read FROM feedback WHERE uuid = $1::uuid',
        [fixture.uuid],
      );
      expect(row.is_read).toBe(true);
    } finally {
      await deleteFeedbackByUuid(fixture.uuid);
    }
  });

  it('persists an assignee timeline event through the API', async () => {
    const fixture = await createFeedbackFixture('Praise');
    try {
      const response = await request(app)
        .patch('/api/admin/feedback/assignee')
        .set('Cookie', employeeSessionCookie)
        .send({ feedbackUuids: [fixture.uuid], assigneeId: TEST_EMPLOYEE_UUID });

      expect(response.status).toBe(200);
      const row = await expectDatabaseRow<{
        employees_uuid: string;
      }>(
        `SELECT employees_uuid::text AS employees_uuid
         FROM feedback_timeline_events
         WHERE feedback_uuid = $1::uuid AND step = 'assigned'`,
        [fixture.uuid],
      );
      expect(row.employees_uuid).toBe(TEST_EMPLOYEE_UUID);

      const snapshotResponse = await request(app)
        .get('/api/admin/feedback/snapshot')
        .set('Cookie', employeeSessionCookie);

      expect(snapshotResponse.status).toBe(200);
      const snapshotItem = snapshotResponse.body.find(
        (item: { uuid: string }) => item.uuid === fixture.uuid,
      );
      expect(snapshotItem).toEqual(expect.objectContaining({ assigneeId: TEST_EMPLOYEE_UUID }));
    } finally {
      await deleteFeedbackByUuid(fixture.uuid);
    }
  });

  it('allows manager and staff sessions to assign feedback through PostgreSQL', async () => {
    const employees = await getTestPool().query<{ uuid: string; staff_role: string }>(
      `SELECT u.uuid::text AS uuid, e.staff_role
       FROM users u
       JOIN employees e ON e.users_uuid = u.uuid
       WHERE u.is_employee = TRUE
         AND e.staff_role IN ('manager', 'staff')`,
    );
    const managerUuid = employees.rows.find((employee) => employee.staff_role === 'manager')?.uuid;
    const staffUuid = employees.rows.find((employee) => employee.staff_role === 'staff')?.uuid;
    if (!managerUuid || !staffUuid) {
      throw new Error('Expected both manager and staff employees in the PostgreSQL test database');
    }

    const fixture = await createFeedbackFixture('Praise');
    try {
      for (const actorUuid of [managerUuid, staffUuid]) {
        const response = await request(app)
          .patch('/api/admin/feedback/assignee')
          .set('Cookie', `${AUTH_COOKIE_NAME}=${await createSessionToken(actorUuid)}`)
          .send({ feedbackUuids: [fixture.uuid], assigneeId: staffUuid });

        expect(response.status).toBe(200);
      }

      const assignment = await expectDatabaseRow<{ employees_uuid: string }>(
        `SELECT employees_uuid::text AS employees_uuid
         FROM feedback_timeline_events
         WHERE feedback_uuid = $1::uuid AND step = 'assigned'`,
        [fixture.uuid],
      );
      expect(assignment.employees_uuid).toBe(staffUuid);
    } finally {
      await deleteFeedbackByUuid(fixture.uuid);
    }
  });

  it('persists feedback read state through the API', async () => {
    const fixture = await createFeedbackFixture('Praise');
    try {
      const response = await request(app)
        .patch('/api/admin/feedback/read')
        .set('Cookie', employeeSessionCookie)
        .send({ feedbackUuids: [fixture.uuid] });

      expect(response.status).toBe(200);
      const row = await expectDatabaseRow<{ is_read: boolean }>(
        'SELECT is_read FROM feedback WHERE uuid = $1::uuid',
        [fixture.uuid],
      );
      expect(row.is_read).toBe(true);
    } finally {
      await deleteFeedbackByUuid(fixture.uuid);
    }
  });

  it('deletes feedback and its linked rows through the API', async () => {
    const fixture = await createFeedbackFixture('Praise');
    try {
      await getTestPool().query(
        `INSERT INTO notification (category, feedback_uuid, summary_content)
         VALUES ('feedback', $1::uuid, 'Integration test notification')`,
        [fixture.uuid],
      );

      const response = await request(app)
        .delete(`/api/admin/feedback/${fixture.uuid}`)
        .set('Cookie', employeeSessionCookie);

      expect(response.status).toBe(204);

      const feedbackRow = await getTestPool().query(
        'SELECT uuid FROM feedback WHERE uuid = $1::uuid',
        [fixture.uuid],
      );
      expect(feedbackRow.rows).toHaveLength(0);

      const childRows = await getTestPool().query<{
        timeline_count: string;
        notification_count: string;
      }>(
        `SELECT
           (SELECT COUNT(*)::text FROM feedback_timeline_events WHERE feedback_uuid = $1::uuid) AS timeline_count,
           (SELECT COUNT(*)::text FROM notification WHERE feedback_uuid = $1::uuid) AS notification_count`,
        [fixture.uuid],
      );
      expect(childRows.rows[0]).toEqual({ timeline_count: '0', notification_count: '0' });
    } finally {
      await deleteFeedbackByUuid(fixture.uuid);
    }
  });

  it('persists Issue status and its timeline event through the API', async () => {
    const fixture = await createFeedbackFixture('Issue');
    try {
      const response = await request(app)
        .patch(`/api/admin/feedback/${fixture.uuid}/status`)
        .set('Cookie', employeeSessionCookie)
        .send({ status: 'review_started' });

      expect(response.status).toBe(200);

      const feedback = await expectDatabaseRow<{ current_status: string }>(
        'SELECT current_status FROM feedback WHERE uuid = $1::uuid',
        [fixture.uuid],
      );
      expect(feedback.current_status).toBe('review_started');
      const event = await expectDatabaseRow<{ step: string; actor_id: string }>(
        `SELECT step, event_payload ->> 'actorId' AS actor_id
         FROM feedback_timeline_events
         WHERE feedback_uuid = $1::uuid AND step = 'review_started'`,
        [fixture.uuid],
      );
      expect(event.actor_id).toBe(TEST_EMPLOYEE_UUID);
    } finally {
      await deleteFeedbackByUuid(fixture.uuid);
    }
  });

  it('persists Suggestion workflow events through the API', async () => {
    const fixture = await createFeedbackFixture('Suggestion');
    try {
      const response = await request(app)
        .patch(`/api/admin/feedback/${fixture.uuid}/suggestion-workflow`)
        .set('Cookie', employeeSessionCookie)
        .send({ status: 'under_review' });

      expect(response.status).toBe(200);
      const event = await expectDatabaseRow<{
        step: string;
        actor_id: string;
        workflow_type: string;
      }>(
        `SELECT step,
                event_payload ->> 'actorId' AS actor_id,
                event_payload ->> 'workflow_type' AS workflow_type
         FROM feedback_timeline_events
         WHERE feedback_uuid = $1::uuid AND step = 'under_review'`,
        [fixture.uuid],
      );
      expect(event.step).toBe('under_review');
      expect(event.actor_id).toBe(TEST_EMPLOYEE_UUID);
      expect(event.workflow_type).toBe('suggestion');
    } finally {
      await deleteFeedbackByUuid(fixture.uuid);
    }
  });

  it('persists a reply status and sent timeline event through the API', async () => {
    const fixture = await createFeedbackFixture('Praise');
    try {
      const response = await request(app)
        .post(`/api/admin/feedback/${fixture.uuid}/reply`)
        .set('Cookie', employeeSessionCookie)
        .send({ emailBody: 'Thank you for your feedback.' });

      expect(response.status).toBe(200);
      expect(response.body.uuid).toBe(fixture.uuid);
      expect(response.body.current_status).toBe('sent');
      expect(response.body.timeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ step: 'sent', actor: TEST_EMPLOYEE_UUID }),
        ]),
      );

      // 3. FAILING TEST: emailBody should be correctly persisted in event_payload
      const persisted = await expectDatabaseRow<{
        current_status: string;
        step: string;
        employees_uuid: string | null;
        email_body: string | null;
      }>(
        `SELECT f.current_status, e.step, e.employees_uuid::text AS employees_uuid,
                e.event_payload ->> 'emailBody' AS email_body
         FROM feedback f
         JOIN feedback_timeline_events e ON e.feedback_uuid = f.uuid
         WHERE f.uuid = $1::uuid AND e.step = 'sent'`,
        [fixture.uuid],
      );
      expect(persisted.current_status).toBe('sent');
      expect(persisted.step).toBe('sent');
      expect(persisted.employees_uuid).toBe(TEST_EMPLOYEE_UUID);
      expect(persisted.email_body).toBe('Thank you for your feedback.');
    } finally {
      await deleteFeedbackByUuid(fixture.uuid);
    }
  });
});
