import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { AUTH_COOKIE_NAME, createSessionToken } from '../services/auth.session.js';
import {
  closePostgresApiTestResources,
  expectDatabaseRow,
  getTestApp,
  getTestPool,
} from './support/postgresApiTest.js';

interface GoogleReviewFixture {
  reviewUuid: string;
  reviewerUuid: string;
}

const buildGeneralInvestigationResult = (reviewUuid: string): Record<string, unknown> => ({
  contractVersion: '2.0',
  resultStage: 'terminal',
  runId: crypto.randomUUID(),
  reviewUuid,
  managerResult: {
    resultStage: 'preliminary',
    terminalStatus: 'direct_finalize',
    outcome: 'available',
    branch: 'general',
    triage: {
      primaryType: 'general',
      issueCategory: null,
      urgency: null,
      confidence: 'medium',
      routingReason: 'The review contains a general comment.',
    },
    insight: { summary: 'The reviewer shared a general comment.' },
    managerDecision: null,
  },
  internalFailure: null,
});

const createGoogleReviewFixture = async (
  dataOrigin: 'mock' | 'live',
): Promise<GoogleReviewFixture> => {
  const location = await getTestPool().query<{ uuid: string }>(
    `SELECT uuid::text AS uuid
     FROM google_business_locations
     WHERE google_location_id = 'mock-pethouse-location'
     LIMIT 1`,
  );
  const locationUuid = location.rows[0]?.uuid;
  if (!locationUuid) {
    throw new Error('Expected the PetHouse Google location fixture');
  }

  const reviewerUuid = crypto.randomUUID();
  const reviewUuid = crypto.randomUUID();
  const googleReviewId = `postgres-reply-test-${crypto.randomUUID()}`;
  const reviewerDisplayName = `Postgres Reply Reviewer ${reviewUuid}`;
  await getTestPool().query(
    `INSERT INTO reviewer_identities (
       uuid, provider, provider_subject, email, display_name
     )
    VALUES ($1::uuid, 'simulator', $2, $3, $4)`,
    [
      reviewerUuid,
      `postgres-reply-reviewer-${reviewerUuid}`,
      'reply-recipient@example.test',
      reviewerDisplayName,
    ],
  );
  await getTestPool().query(
    `INSERT INTO google_business_reviews (
       uuid,
       google_business_location_uuid,
       google_review_id,
       google_resource_name,
       reviewer_display_name,
       reviewer_is_anonymous,
       rating,
       comment,
       google_created_at,
       google_updated_at,
       data_origin
     )
     VALUES (
       $1::uuid,
       $2::uuid,
       $3,
       $4,
       $6,
       false,
       5,
       'A PostgreSQL reply integration test review.',
       now(),
       now(),
       $5
     )`,
    [
      reviewUuid,
      locationUuid,
      googleReviewId,
      `accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/${googleReviewId}`,
      dataOrigin,
      reviewerDisplayName,
    ],
  );

  return { reviewUuid, reviewerUuid };
};

const deleteGoogleReviewFixture = async (fixture: GoogleReviewFixture): Promise<void> => {
  await getTestPool().query(
    'DELETE FROM external_feedback WHERE google_business_review_uuid = $1::uuid',
    [fixture.reviewUuid],
  );
  await getTestPool().query('DELETE FROM google_business_reviews WHERE uuid = $1::uuid', [
    fixture.reviewUuid,
  ]);
  await getTestPool().query('DELETE FROM reviewer_identities WHERE uuid = $1::uuid', [
    fixture.reviewerUuid,
  ]);
};

const setGoogleReviewAssignment = async (
  fixture: GoogleReviewFixture,
  employeeUuid: string | null,
): Promise<void> => {
  await getTestPool().query(
    `INSERT INTO external_feedback (
       google_business_review_uuid,
       assigned_employee_uuid
     )
     VALUES ($1::uuid, $2::uuid)
     ON CONFLICT (google_business_review_uuid)
     DO UPDATE SET assigned_employee_uuid = EXCLUDED.assigned_employee_uuid,
                   assigned_at = now(),
                   updated_at = now()`,
    [fixture.reviewUuid, employeeUuid],
  );
  const externalFeedback = await expectDatabaseRow<{ uuid: string }>(
    `SELECT uuid::text AS uuid
     FROM external_feedback
     WHERE google_business_review_uuid = $1::uuid`,
    [fixture.reviewUuid],
  );
  await getTestPool().query(
    `INSERT INTO feedback_timeline_events (
       external_feedback_uuid,
       step,
       event_payload
     )
     VALUES ($1::uuid, 'investigation_result', $2::jsonb)`,
    [externalFeedback.uuid, JSON.stringify(buildGeneralInvestigationResult(fixture.reviewUuid))],
  );
};

const setGoogleReviewTriageType = async (
  app: Awaited<ReturnType<typeof getTestApp>>,
  managerSessionCookie: string,
  fixture: GoogleReviewFixture,
  triageType: 'issue' | 'praise' | 'suggestion' | 'general',
): Promise<void> => {
  const response = await request(app)
    .patch(`/api/admin/google-reviews/${fixture.reviewUuid}/type`)
    .set('Cookie', managerSessionCookie)
    .set('Origin', 'http://localhost:5173')
    .send({ triageType });

  expect(response.status).toBe(200);
  expect(response.body.data).toEqual(
    expect.objectContaining({
      id: fixture.reviewUuid,
      triageType,
    }),
  );
};

const postgresDescribe = process.env.TEST_DATABASE_URL ? describe.sequential : describe.skip;

postgresDescribe('PostgreSQL API read-back: admin Google review reply', () => {
  let app: Awaited<ReturnType<typeof getTestApp>>;
  let employeeSessionCookie: string;
  let managerUuid: string;
  let currentStaffUuid: string;
  let otherStaffUuid: string;

  beforeAll(async () => {
    app = await getTestApp();
    await getTestPool().query('SELECT 1');
    const employees = await getTestPool().query<{ uuid: string; staff_role: string }>(
      `SELECT u.uuid::text AS uuid, e.staff_role
       FROM users u
       JOIN employees e ON e.users_uuid = u.uuid
       WHERE u.is_employee = TRUE
         AND e.staff_role IN ('manager', 'staff')
       ORDER BY u.uuid`,
    );
    managerUuid = employees.rows.find((employee) => employee.staff_role === 'manager')?.uuid ?? '';
    const staffUuids = employees.rows
      .filter((employee) => employee.staff_role === 'staff')
      .map((employee) => employee.uuid);
    currentStaffUuid = staffUuids[0] ?? '';
    otherStaffUuid = staffUuids[1] ?? '';
    if (!managerUuid || !currentStaffUuid || !otherStaffUuid) {
      throw new Error(
        'Expected one manager and two staff employees in the PostgreSQL test database',
      );
    }
    employeeSessionCookie = `${AUTH_COOKIE_NAME}=${await createSessionToken(managerUuid)}`;
  });

  afterAll(async () => {
    await closePostgresApiTestResources();
  });

  it('persists the selected owner reply and exposes it in admin and public projections', async () => {
    const fixture = await createGoogleReviewFixture('mock');
    try {
      const adminBefore = await request(app)
        .get('/api/admin/google-reviews?placeSlug=PetHouse')
        .set('Cookie', employeeSessionCookie);
      expect(adminBefore.status).toBe(200);
      expect(adminBefore.body.data.reviews).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: fixture.reviewUuid,
            reviewerEmail: 'reply-recipient@example.test',
            ownerReply: null,
            isRead: false,
            currentStatus: 'received',
            assignedEmployeeUuid: null,
          }),
        ]),
      );

      const replyResponse = await request(app)
        .post(`/api/admin/google-reviews/${fixture.reviewUuid}/reply`)
        .set('Cookie', employeeSessionCookie)
        .set('Origin', 'http://localhost:5173')
        .send({ replyBody: 'Thank you for sharing your experience.' });

      expect(replyResponse.status).toBe(200);
      expect(replyResponse.body.data).toEqual(
        expect.objectContaining({
          id: fixture.reviewUuid,
          reviewerEmail: 'reply-recipient@example.test',
          ownerReply: 'Thank you for sharing your experience.',
          isRead: false,
          currentStatus: 'received',
          assignedEmployeeUuid: null,
        }),
      );

      const persisted = await expectDatabaseRow<{
        external_feedback_uuid: string;
        google_business_review_uuid: string;
        employees_uuid: string;
        reply_body: string;
        reply_status: string;
        sent_at: string;
      }>(
        `SELECT external.uuid::text AS external_feedback_uuid,
                external.google_business_review_uuid::text AS google_business_review_uuid,
                reply.employees_uuid::text AS employees_uuid,
                reply.reply_body,
                reply.reply_status,
                reply.sent_at::text AS sent_at
         FROM external_feedback external
         JOIN external_feedback_replies reply
           ON reply.external_feedback_uuid = external.uuid
         WHERE external.google_business_review_uuid = $1::uuid
         ORDER BY reply.created_at DESC, reply.uuid DESC
         LIMIT 1`,
        [fixture.reviewUuid],
      );
      expect(persisted.external_feedback_uuid).toBeTruthy();
      expect(persisted.google_business_review_uuid).toBe(fixture.reviewUuid);
      expect(persisted.employees_uuid).toBe(managerUuid);
      expect(persisted.reply_body).toBe('Thank you for sharing your experience.');
      expect(persisted.reply_status).toBe('sent');
      expect(persisted.sent_at).toBeTruthy();

      const publicResponse = await request(app).get('/api/google-reviews?placeSlug=PetHouse');
      expect(publicResponse.status).toBe(200);
      const publicReview = publicResponse.body.data.reviews.find(
        (review: { id: string }) => review.id === fixture.reviewUuid,
      );
      expect(publicReview).toEqual(
        expect.objectContaining({
          id: fixture.reviewUuid,
          ownerReply: 'Thank you for sharing your experience.',
        }),
      );
      expect(publicReview).not.toHaveProperty('reviewerEmail');
    } finally {
      await deleteGoogleReviewFixture(fixture);
    }
  });

  it('enforces the manager/staff Google review role matrix through PostgreSQL', async () => {
    const currentStaffReview = await createGoogleReviewFixture('mock');
    const otherStaffReview = await createGoogleReviewFixture('mock');
    const unassignedReview = await createGoogleReviewFixture('mock');
    const currentStaffCookie = `${AUTH_COOKIE_NAME}=${await createSessionToken(currentStaffUuid)}`;

    try {
      await setGoogleReviewAssignment(currentStaffReview, currentStaffUuid);
      await setGoogleReviewAssignment(otherStaffReview, otherStaffUuid);
      await setGoogleReviewAssignment(unassignedReview, null);

      const managerList = await request(app)
        .get('/api/admin/google-reviews?placeSlug=PetHouse')
        .set('Cookie', employeeSessionCookie);
      expect(managerList.status).toBe(200);
      expect(managerList.body.data.reviews.map((review: { id: string }) => review.id)).toEqual(
        expect.arrayContaining([
          currentStaffReview.reviewUuid,
          otherStaffReview.reviewUuid,
          unassignedReview.reviewUuid,
        ]),
      );

      const staffList = await request(app)
        .get('/api/admin/google-reviews?placeSlug=PetHouse')
        .set('Cookie', currentStaffCookie);
      expect(staffList.status).toBe(200);
      const staffReviewIds = staffList.body.data.reviews.map((review: { id: string }) => review.id);
      expect(staffReviewIds).toContain(currentStaffReview.reviewUuid);
      expect(staffReviewIds).not.toContain(otherStaffReview.reviewUuid);
      expect(staffReviewIds).not.toContain(unassignedReview.reviewUuid);

      for (const fixture of [otherStaffReview, unassignedReview]) {
        const unauthorizedReply = await request(app)
          .post(`/api/admin/google-reviews/${fixture.reviewUuid}/reply`)
          .set('Cookie', currentStaffCookie)
          .set('Origin', 'http://localhost:5173')
          .send({ replyBody: 'This must not be persisted.' });
        expect(unauthorizedReply.status).toBe(404);
        expect(unauthorizedReply.body.error.code).toBe('GOOGLE_REVIEW_NOT_FOUND');
      }

      const managerReply = await request(app)
        .post(`/api/admin/google-reviews/${unassignedReview.reviewUuid}/reply`)
        .set('Cookie', employeeSessionCookie)
        .set('Origin', 'http://localhost:5173')
        .send({ replyBody: 'Manager reply is allowed.' });
      expect(managerReply.status).toBe(200);

      const staffAssignment = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('Cookie', currentStaffCookie)
        .set('Origin', 'http://localhost:5173')
        .send({
          reviewUuids: [unassignedReview.reviewUuid],
          assigneeId: otherStaffUuid,
        });
      expect(staffAssignment.status).toBe(403);

      const managerAssignment = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('Cookie', employeeSessionCookie)
        .set('Origin', 'http://localhost:5173')
        .send({
          reviewUuids: [unassignedReview.reviewUuid],
          assigneeId: otherStaffUuid,
        });
      expect(managerAssignment.status).toBe(409);
      expect(managerAssignment.body.error.code).toBe('GOOGLE_REVIEW_TRIAGE_REQUIRED');

      await setGoogleReviewTriageType(app, employeeSessionCookie, unassignedReview, 'praise');

      const typedManagerAssignment = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('Cookie', employeeSessionCookie)
        .set('Origin', 'http://localhost:5173')
        .send({
          reviewUuids: [unassignedReview.reviewUuid],
          assigneeId: otherStaffUuid,
        });
      expect(typedManagerAssignment.status).toBe(200);
      expect(typedManagerAssignment.body.data).toEqual({
        updatedUuids: [unassignedReview.reviewUuid],
        assigneeId: otherStaffUuid,
      });

      const assignment = await expectDatabaseRow<{ assigned_employee_uuid: string }>(
        `SELECT assigned_employee_uuid::text AS assigned_employee_uuid
         FROM external_feedback
         WHERE google_business_review_uuid = $1::uuid`,
        [unassignedReview.reviewUuid],
      );
      expect(assignment.assigned_employee_uuid).toBe(otherStaffUuid);
    } finally {
      await deleteGoogleReviewFixture(currentStaffReview);
      await deleteGoogleReviewFixture(otherStaffReview);
      await deleteGoogleReviewFixture(unassignedReview);
    }
  });

  it('rejects assignment when a manager has not decided the review type', async () => {
    const fixture = await createGoogleReviewFixture('mock');
    try {
      const response = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('Cookie', employeeSessionCookie)
        .set('Origin', 'http://localhost:5173')
        .send({
          reviewUuids: [fixture.reviewUuid, fixture.reviewUuid],
          assigneeId: currentStaffUuid,
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('GOOGLE_REVIEW_TRIAGE_REQUIRED');
    } finally {
      await deleteGoogleReviewFixture(fixture);
    }
  });

  it('reassigns an existing external row without changing review or feedback state', async () => {
    const fixture = await createGoogleReviewFixture('mock');
    const originalAssignedAt = '2026-08-01T01:02:03.000Z';
    try {
      await getTestPool().query(
        `INSERT INTO external_feedback (
          google_business_review_uuid,
          is_read,
          current_status,
          assigned_employee_uuid,
          assigned_at
        )
        VALUES ($1::uuid, true, 'review_started', $2::uuid, $3::timestamptz)`,
        [fixture.reviewUuid, currentStaffUuid, originalAssignedAt],
      );
      const externalFeedbackForType = await expectDatabaseRow<{ uuid: string }>(
        `SELECT uuid::text AS uuid
         FROM external_feedback
         WHERE google_business_review_uuid = $1::uuid`,
        [fixture.reviewUuid],
      );
      await getTestPool().query(
        `INSERT INTO feedback_timeline_events (
          external_feedback_uuid,
          step,
          event_payload
        )
        VALUES ($1::uuid, 'investigation_result', $2::jsonb)`,
        [
          externalFeedbackForType.uuid,
          JSON.stringify(buildGeneralInvestigationResult(fixture.reviewUuid)),
        ],
      );
      await setGoogleReviewTriageType(app, employeeSessionCookie, fixture, 'praise');
      const externalFeedback = await expectDatabaseRow<{ uuid: string }>(
        `SELECT uuid::text AS uuid
         FROM external_feedback
         WHERE google_business_review_uuid = $1::uuid`,
        [fixture.reviewUuid],
      );
      await getTestPool().query(
        `INSERT INTO external_feedback_replies (
          external_feedback_uuid,
          employees_uuid,
          reply_body,
          reply_status,
          sent_at
        )
        VALUES ($1::uuid, $2::uuid, $3, 'sent', $4::timestamptz)`,
        [
          externalFeedback.uuid,
          currentStaffUuid,
          'Existing Google reply',
          '2026-08-02T03:04:05.000Z',
        ],
      );

      const response = await request(app)
        .patch('/api/admin/google-reviews/assignee')
        .set('Cookie', employeeSessionCookie)
        .set('Origin', 'http://localhost:5173')
        .send({
          reviewUuids: [fixture.reviewUuid],
          assigneeId: otherStaffUuid,
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        updatedUuids: [fixture.reviewUuid],
        assigneeId: otherStaffUuid,
      });

      const persisted = await expectDatabaseRow<{
        assigned_employee_uuid: string;
        assigned_at: string;
        is_read: boolean;
        current_status: string;
        employees_uuid: string;
        reply_body: string;
        reply_status: string;
        sent_at: string;
      }>(
        `SELECT external.assigned_employee_uuid::text AS assigned_employee_uuid,
                external.assigned_at::text AS assigned_at,
                external.is_read,
                external.current_status,
                reply.employees_uuid::text AS employees_uuid,
                reply.reply_body,
                reply.reply_status,
                reply.sent_at::text AS sent_at
         FROM external_feedback external
         JOIN google_business_reviews review
           ON review.uuid = external.google_business_review_uuid
         JOIN external_feedback_replies reply
           ON reply.external_feedback_uuid = external.uuid
         WHERE review.uuid = $1::uuid`,
        [fixture.reviewUuid],
      );
      expect(persisted.assigned_employee_uuid).toBe(otherStaffUuid);
      expect(persisted.assigned_at).not.toBe(originalAssignedAt);
      expect(persisted.is_read).toBe(true);
      expect(persisted.current_status).toBe('review_started');
      const correction = await expectDatabaseRow<{
        event_payload: {
          sourceRunId: string;
          originalAiType: string;
          correctedType: string;
          managerId: string;
          occurredAt: string;
        };
      }>(
        `SELECT event.event_payload
         FROM feedback_timeline_events event
         WHERE event.external_feedback_uuid = $1::uuid
           AND event.step = 'manager_correction'
         ORDER BY event.created_at DESC, event.uuid DESC
         LIMIT 1`,
        [externalFeedback.uuid],
      );
      expect(correction.event_payload).toMatchObject({
        sourceRunId: expect.any(String),
        originalAiType: 'general',
        correctedType: 'praise',
        managerId: managerUuid,
        occurredAt: expect.any(String),
      });
      expect(persisted.employees_uuid).toBe(currentStaffUuid);
      expect(persisted.reply_body).toBe('Existing Google reply');
      expect(persisted.reply_status).toBe('sent');
      expect(new Date(persisted.sent_at).toISOString()).toBe('2026-08-02T03:04:05.000Z');
    } finally {
      await deleteGoogleReviewFixture(fixture);
    }
  });

  it('does not update a live review through the mock reply endpoint', async () => {
    const fixture = await createGoogleReviewFixture('live');
    try {
      const response = await request(app)
        .post(`/api/admin/google-reviews/${fixture.reviewUuid}/reply`)
        .set('Cookie', employeeSessionCookie)
        .send({ replyBody: 'This must not be persisted.' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('GOOGLE_REVIEW_REPLY_NOT_SUPPORTED');
      const persisted = await getTestPool().query(
        `SELECT reply.uuid
         FROM external_feedback_replies reply
         JOIN external_feedback external
           ON external.uuid = reply.external_feedback_uuid
         WHERE external.google_business_review_uuid = $1::uuid`,
        [fixture.reviewUuid],
      );
      expect(persisted.rows).toHaveLength(0);
    } finally {
      await deleteGoogleReviewFixture(fixture);
    }
  });
});
