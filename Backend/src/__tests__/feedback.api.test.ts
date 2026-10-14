import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { generateObject } from 'ai';
import request from 'supertest';
import express, { type NextFunction, type Request, type Response } from 'express';
import feedbackRoutes from '../routes/feedback.routes.js';
import adminFeedbackRoutes from '../routes/admin.feedback.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import { FEEDBACK_AUDIO_STORAGE_DIRECTORY } from '../services/feedback.audio.storage.js';
import {
  getAdminFeedbackRecord,
  getAdminFeedbackWorkflowRecord,
  deleteFeedbackRecord,
  listEmployeeStaffOptions,
  listAdminFeedbackDetailRecords,
  listAdminFeedbackRecords,
  assignFeedbackRecords,
  markFeedbackRecordsAsRead,
  replyFeedbackRecord,
  transitionIssueFeedback,
  transitionSuggestionFeedback,
  type AdminFeedbackTimelineRecord,
  type AdminFeedbackWorkflowRecord,
  type WorkflowMutationResult,
  type AdminFeedbackDetailRecord,
  type AdminFeedbackListRecord,
} from '../repositories/admin.feedback.repository.js';

const { employeeUser, parentUser } = vi.hoisted(() => ({
  employeeUser: {
    id: '00000000-0000-4000-8000-000000000201',
    email: 'employee@example.test',
    name: 'Employee One',
    is_employee: true,
    is_pet_owner: false,
    employee_role: 'staff' as const,
    isUsingTemporaryPassword: false,
  },
  parentUser: {
    id: '00000000-0000-4000-8000-000000000101',
    email: 'parent@example.test',
    name: 'Ava Mitchell',
    is_employee: false,
    is_pet_owner: true,
    employee_role: null,
    isUsingTemporaryPassword: false,
  },
}));

vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requireEmployee: (req: Request, _res: Response, next: NextFunction): void => {
    req.user = employeeUser;
    next();
  },
  requirePetParent: (req: Request, _res: Response, next: NextFunction): void => {
    req.user = parentUser;
    next();
  },
  requireTrustedOrigin: (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  },
}));

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      summary: 'LLM summary',
      insights: ['LLM insight'],
    },
  }),
}));

vi.mock('../repositories/feedback.repository.js', () => ({
  createFeedbackRecord: vi.fn().mockResolvedValue({
    uuid: '00000000-0000-4000-8000-000000000b16',
  }),
  findOwnedPetFeedbackContext: vi.fn().mockResolvedValue({
    parent_name: 'Ava Mitchell',
    pet_name: 'Biscuit',
  }),
}));

vi.mock('../repositories/admin.feedback.repository.js', () => ({
  getAdminFeedbackRecord: vi.fn(),
  getAdminFeedbackWorkflowRecord: vi.fn(),
  listEmployeeStaffOptions: vi.fn(),
  listAdminFeedbackDetailRecords: vi.fn(),
  listAdminFeedbackRecords: vi.fn(),
  deleteFeedbackRecord: vi.fn(),
  assignFeedbackRecords: vi.fn(),
  markFeedbackRecordsAsRead: vi.fn(),
  replyFeedbackRecord: vi.fn(),
  transitionIssueFeedback: vi.fn(),
  transitionSuggestionFeedback: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin/feedback', adminFeedbackRoutes);
app.use(errorHandler);

const parentContext = {
  pet_uuid: '00000000-0000-4000-8000-000000000501',
  pet_owners_uuid: '00000000-0000-4000-8000-000000000101',
};

const PRAISE_FEEDBACK_UUID = '00000000-0000-4000-8000-000000000b11';
const ISSUE_FEEDBACK_UUID = '00000000-0000-4000-8000-000000000b12';

const PRIMARY_EMPLOYEE_UUID = '00000000-0000-4000-8000-000000000201';
const databaseStaffOptions = [
  { id: PRIMARY_EMPLOYEE_UUID, name: 'olivia.care' },
  { id: '00000000-0000-4000-8000-000000000202', name: 'jackson.lee' },
  { id: '00000000-0000-4000-8000-000000000203', name: 'isla.martin' },
];

const ratingDetails = {
  Professional: 5,
  Service: 4,
  Communication: 3,
  Safety: 4,
  Cost: 4,
};

const createParentPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...parentContext,
  category: 'Suggestion',
  rating_details: ratingDetails,
  raw_answer: 'The parent feedback answer.',
  ...overrides,
});

let savedAudioUrl: string | undefined;

const adminDbFeedbackRows: AdminFeedbackListRecord[] = [
  {
    uuid: '00000000-0000-4000-8000-000000000b11',
    parent_name: 'Jennifer Andrews',
    pet_name: 'Sherlock',
    created_at: new Date('2026-08-15T00:00:00.000Z'),
    category: 'Praise',
    is_read: false,
    current_status: 'submitted',
    rating: 5,
    ai_summary: 'Praise summary',
    assignee_uuid: null,
  },
  {
    uuid: '00000000-0000-4000-8000-000000000b12',
    parent_name: 'Jason Lo',
    pet_name: 'Arctic Dog',
    created_at: new Date('2026-08-10T00:00:00.000Z'),
    category: 'Issue',
    is_read: false,
    current_status: 'submitted',
    rating: 1,
    ai_summary: 'Issue summary',
    assignee_uuid: null,
  },
  {
    uuid: '00000000-0000-4000-8000-000000000b13',
    parent_name: 'Hannah MAC',
    pet_name: 'Cavoodle Pup',
    created_at: new Date('2026-08-05T00:00:00.000Z'),
    category: 'Issue',
    is_read: true,
    current_status: 'fact_checked',
    rating: 1,
    ai_summary: 'Issue summary',
    assignee_uuid: null,
  },
  {
    uuid: '00000000-0000-4000-8000-000000000b14',
    parent_name: 'Scott Patterson',
    pet_name: 'Arthritis Dog',
    created_at: new Date('2026-07-28T00:00:00.000Z'),
    category: 'Praise',
    is_read: false,
    current_status: 'submitted',
    rating: 5,
    ai_summary: 'Praise summary',
    assignee_uuid: null,
  },
  {
    uuid: '00000000-0000-4000-8000-000000000b15',
    parent_name: 'Nikita',
    pet_name: 'Anxious Pup',
    created_at: new Date('2026-07-20T00:00:00.000Z'),
    category: 'Issue',
    is_read: true,
    current_status: 'sent',
    rating: 1,
    ai_summary: 'Issue summary',
    assignee_uuid: null,
  },
  {
    uuid: '00000000-0000-4000-8000-000000000b16',
    parent_name: 'Photo Update Parent',
    pet_name: 'Daycare Dog',
    created_at: new Date('2026-07-18T00:00:00.000Z'),
    category: 'Suggestion',
    is_read: false,
    current_status: 'submitted',
    rating: 4,
    ai_summary: 'Suggestion summary',
    assignee_uuid: null,
    suggestion_workflow: { status: 'captured', decision: null },
  },
  {
    uuid: '00000000-0000-4000-8000-000000000b17',
    parent_name: 'Intake Checklist Parent',
    pet_name: 'First-Day Pup',
    created_at: new Date('2026-07-12T00:00:00.000Z'),
    category: 'Suggestion',
    is_read: false,
    current_status: 'submitted',
    rating: 4,
    ai_summary: 'Suggestion summary',
    assignee_uuid: null,
    suggestion_workflow: { status: 'under_review', decision: null },
  },
];

const adminDbDetailRecord: AdminFeedbackDetailRecord = {
  uuid: '00000000-0000-4000-8000-000000000b11',
  parent_name: 'Jennifer Andrews',
  pet_name: 'Sherlock',
  created_at: new Date('2026-08-15T00:00:00.000Z'),
  category: 'Praise',
  is_read: false,
  current_status: 'submitted',
  assignee_uuid: null,
  rating: 5,
  rating_details: {
    Professional: 5,
    Service: 4,
    Communication: 3,
    Safety: 4,
    Cost: 4,
  },
  raw_answer: 'The parent answer.',
  transcript: null,
  audio_url: null,
  ai_insights: { summary: 'Summary', insights: ['Insight'] },
  timeline: [
    {
      step: 'submitted',
      created_at: '2026-08-15T00:00:00.000Z',
      actor: 'System',
      event_payload: {},
    },
  ],
};

const adminWorkflowRecords = new Map<string, AdminFeedbackWorkflowRecord>();

const createWorkflowEvent = (
  step: string,
  actor: string,
  eventPayload: Record<string, unknown> = {},
): AdminFeedbackTimelineRecord => ({
  step,
  created_at: '2026-08-15T00:00:00.000Z',
  actor,
  event_payload: eventPayload,
});

const resetAdminWorkflowRecords = (): void => {
  adminWorkflowRecords.clear();
  adminWorkflowRecords.set(PRAISE_FEEDBACK_UUID, {
    category: 'Praise',
    current_status: 'submitted',
    timeline: [createWorkflowEvent('submitted', 'System')],
  });
  adminWorkflowRecords.set(ISSUE_FEEDBACK_UUID, {
    category: 'Issue',
    current_status: 'submitted',
    timeline: [createWorkflowEvent('submitted', 'System')],
  });
  adminWorkflowRecords.set('00000000-0000-4000-8000-000000000b16', {
    category: 'Suggestion',
    current_status: 'submitted',
    timeline: [
      createWorkflowEvent('captured', 'System', {
        workflow_type: 'suggestion',
        ownerId: 'u1',
        decision: null,
        evidenceSummary: null,
        decisionReason: null,
        nextReviewAt: null,
      }),
    ],
  });
};

const getAdminDetailRecord = (uuid: string): AdminFeedbackDetailRecord | null => {
  if (uuid === adminDbDetailRecord.uuid) {
    return adminDbDetailRecord;
  }

  const workflowRecord = adminWorkflowRecords.get(uuid);
  if (!workflowRecord) {
    return null;
  }

  return {
    ...adminDbDetailRecord,
    uuid,
    category: workflowRecord.category,
    current_status: workflowRecord.current_status,
    is_read: false,
    timeline: workflowRecord.timeline,
  };
};

const listDbRowsForQuery = async (query: {
  search?: string;
  category?: 'Issue' | 'Suggestion' | 'Praise';
  status: 'all' | 'unread' | 'read';
  sort: 'newest' | 'oldest' | 'highest' | 'lowest';
  timeRange: 'all' | 'last_7_days' | 'last_30_days' | 'custom';
  rating: 'all' | 'low' | 'medium' | 'high';
  dateFrom?: string;
  dateTo?: string;
}): Promise<AdminFeedbackListRecord[]> => {
  let rows = [...adminDbFeedbackRows];
  if (query.search) {
    const term = query.search.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.parent_name.toLowerCase().includes(term) || row.pet_name.toLowerCase().includes(term),
    );
  }
  if (query.category) {
    rows = rows.filter((row) => row.category === query.category);
  }
  if (query.status !== 'all') {
    rows = rows.filter((row) => row.is_read === (query.status === 'read'));
  }
  rows.sort((left, right) => {
    if (query.sort === 'oldest') return left.created_at.getTime() - right.created_at.getTime();
    if (query.sort === 'highest') return right.rating - left.rating;
    if (query.sort === 'lowest') return left.rating - right.rating;
    return right.created_at.getTime() - left.created_at.getTime();
  });
  return rows;
};

describe('Feedback APIs', () => {
  beforeEach(() => {
    resetAdminWorkflowRecords();
    adminDbFeedbackRows.forEach((row) => {
      row.assignee_uuid = null;
    });
    vi.mocked(getAdminFeedbackRecord).mockReset();
    vi.mocked(getAdminFeedbackRecord).mockImplementation(async (uuid) =>
      getAdminDetailRecord(uuid),
    );
    vi.mocked(getAdminFeedbackWorkflowRecord).mockImplementation(
      async (uuid: string) => adminWorkflowRecords.get(uuid) ?? null,
    );
    vi.mocked(transitionIssueFeedback).mockImplementation(
      async (uuid, status, actorId, expectedCurrentStatus): Promise<WorkflowMutationResult> => {
        const record = adminWorkflowRecords.get(uuid);
        if (!record) return { outcome: 'not_found' };
        if (record.category !== 'Issue') return { outcome: 'invalid_category' };
        if (record.current_status !== expectedCurrentStatus) {
          return { outcome: 'invalid_transition', currentStatus: record.current_status };
        }
        record.current_status = status;
        record.timeline.push(createWorkflowEvent(status, actorId, { actorId }));
        return { outcome: 'updated' };
      },
    );
    vi.mocked(transitionSuggestionFeedback).mockImplementation(
      async (
        uuid,
        status,
        actorId,
        expectedCurrentStatus,
        eventPayload,
      ): Promise<WorkflowMutationResult> => {
        const record = adminWorkflowRecords.get(uuid);
        if (!record) return { outcome: 'not_found' };
        if (record.category !== 'Suggestion') return { outcome: 'invalid_category' };
        const currentStatus = record.timeline.at(-1)?.step ?? null;
        if (currentStatus !== expectedCurrentStatus) {
          return { outcome: 'invalid_transition', currentStatus };
        }
        record.timeline.push(createWorkflowEvent(status, actorId, { ...eventPayload, actorId }));
        return { outcome: 'updated' };
      },
    );
    vi.mocked(replyFeedbackRecord).mockImplementation(async (uuid, actorId) => {
      const record = adminWorkflowRecords.get(uuid);
      if (!record) return { repliedUuid: null };
      record.current_status = 'sent';
      record.timeline.push(createWorkflowEvent('sent', actorId, { actorId }));
      return { repliedUuid: uuid };
    });
    vi.mocked(listAdminFeedbackRecords).mockClear();
    vi.mocked(listAdminFeedbackRecords).mockImplementation(listDbRowsForQuery);
    vi.mocked(deleteFeedbackRecord).mockReset();
    vi.mocked(listEmployeeStaffOptions).mockReset();
    vi.mocked(listEmployeeStaffOptions).mockResolvedValue(databaseStaffOptions);
    vi.mocked(assignFeedbackRecords).mockReset();
    vi.mocked(assignFeedbackRecords).mockImplementation(async (feedbackUuids) => ({
      updatedUuids: [...new Set(feedbackUuids)],
      missingUuids: [],
      invalidAssignee: false,
    }));
    vi.mocked(listAdminFeedbackDetailRecords).mockReset();
    vi.mocked(listAdminFeedbackDetailRecords).mockResolvedValue([adminDbDetailRecord]);
    vi.mocked(markFeedbackRecordsAsRead).mockClear();
    vi.mocked(markFeedbackRecordsAsRead).mockImplementation(async (feedbackUuids) => ({
      updatedUuids: [...new Set(feedbackUuids)],
      missingUuids: [],
    }));
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        summary: 'LLM summary',
        insights: ['LLM insight'],
      },
    } as never);
  });

  afterEach(async () => {
    if (savedAudioUrl) {
      await rm(path.join(FEEDBACK_AUDIO_STORAGE_DIRECTORY, path.basename(savedAudioUrl)), {
        force: true,
      });
      savedAudioUrl = undefined;
    }
  });

  describe('GET /api/admin/feedback', () => {
    it('should return all feedbacks with default sorting (newest)', async () => {
      const res = await request(app).get('/api/admin/feedback');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      // Check sorting: first element should have highest timestamp
      const first = res.body[0];
      const second = res.body[1];
      expect(first.timestamp).toBeGreaterThanOrEqual(second.timestamp);
      expect(res.body.map((feedback: { category: string }) => feedback.category)).toEqual(
        expect.arrayContaining(['Issue', 'Praise', 'Suggestion']),
      );
      expect(
        res.body.filter((feedback: { category: string }) => feedback.category === 'Issue'),
      ).toHaveLength(3);
      expect(
        res.body.filter((feedback: { category: string }) => feedback.category === 'Praise'),
      ).toHaveLength(2);
      expect(
        res.body.filter((feedback: { category: string }) => feedback.category === 'Suggestion'),
      ).toHaveLength(2);
    });

    it('should filter by unread status', async () => {
      const res = await request(app).get('/api/admin/feedback?status=unread');
      expect(res.status).toBe(200);
      expect(res.body.every((f: { is_read: boolean }) => f.is_read === false)).toBe(true);
    });

    it('should sort by highest rating', async () => {
      const res = await request(app).get('/api/admin/feedback?sort=highest');
      expect(res.status).toBe(200);
      expect(res.body[0].rating).toBe(5);
    });

    it('should include a nullable assigneeId in the list contract', async () => {
      const res = await request(app).get('/api/admin/feedback');

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(
        res.body.every(
          (feedback: { assigneeId?: string | null }) =>
            'assigneeId' in feedback &&
            (feedback.assigneeId === null || typeof feedback.assigneeId === 'string'),
        ),
      ).toBe(true);
    });

    it('returns persisted Suggestion workflow progress in the list contract', async () => {
      const res = await request(app).get('/api/admin/feedback');

      expect(res.status).toBe(200);
      const persistedSuggestion = res.body.find(
        (feedback: { category: string; suggestionWorkflow?: unknown }) =>
          feedback.category === 'Suggestion' && feedback.suggestionWorkflow,
      );
      expect(persistedSuggestion?.suggestionWorkflow).toEqual({
        status: 'captured',
        decision: null,
      });
    });

    it('passes search, category, status, and sort to the database repository', async () => {
      const res = await request(app).get(
        '/api/admin/feedback?search=Ava&category=Praise&status=unread&sort=lowest',
      );

      expect(res.status).toBe(200);
      expect(listAdminFeedbackRecords).toHaveBeenCalledWith({
        search: 'Ava',
        category: 'Praise',
        status: 'unread',
        sort: 'lowest',
        timeRange: 'all',
        rating: 'all',
      });
    });

    it('passes time and rating filters to the database repository', async () => {
      const res = await request(app).get(
        '/api/admin/feedback?timeRange=custom&dateFrom=2026-08-01&dateTo=2026-08-31&rating=low',
      );

      expect(res.status).toBe(200);
      expect(listAdminFeedbackRecords).toHaveBeenCalledWith({
        status: 'all',
        sort: 'newest',
        timeRange: 'custom',
        rating: 'low',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      });
    });

    it('passes a numeric rating range to the database repository', async () => {
      const res = await request(app).get('/api/admin/feedback?ratingMin=3.25&ratingMax=4.75');

      expect(res.status).toBe(200);
      expect(listAdminFeedbackRecords).toHaveBeenCalledWith({
        status: 'all',
        sort: 'newest',
        timeRange: 'all',
        rating: 'all',
        ratingMin: 3.25,
        ratingMax: 4.75,
      });
    });

    it.each([
      ['/api/admin/feedback?ratingMin=3', 'ratingMin and ratingMax must be provided together'],
      ['/api/admin/feedback?ratingMax=4', 'ratingMin and ratingMax must be provided together'],
      ['/api/admin/feedback?ratingMin=0&ratingMax=4', 'Too small: expected number to be >=1'],
      ['/api/admin/feedback?ratingMin=2&ratingMax=6', 'Too big: expected number to be <=5'],
      ['/api/admin/feedback?ratingMin=4&ratingMax=3', 'Must be greater than or equal to ratingMin'],
    ])('rejects invalid numeric rating range %s', async (url, expectedIssue) => {
      const res = await request(app).get(url);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ issue: expectedIssue })]),
      );
      expect(listAdminFeedbackRecords).not.toHaveBeenCalled();
    });

    it('rejects a custom time range without both dates', async () => {
      const res = await request(app).get(
        '/api/admin/feedback?timeRange=custom&dateFrom=2026-08-01',
      );

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(listAdminFeedbackRecords).not.toHaveBeenCalled();
    });

    it('rejects a custom time range whose end precedes its start', async () => {
      const res = await request(app).get(
        '/api/admin/feedback?timeRange=custom&dateFrom=2026-08-31&dateTo=2026-08-01',
      );

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(listAdminFeedbackRecords).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/feedback/snapshot', () => {
    it('returns complete feedback details without marking records as read', async () => {
      const res = await request(app).get('/api/admin/feedback/snapshot');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        uuid: adminDbDetailRecord.uuid,
        parentName: 'Jennifer Andrews',
        petName: 'Sherlock',
        answers: ['The parent answer.'],
        timeline: [{ step: 'submitted', timestamp: 'Aug 15, 12:00 PM', actor: 'System' }],
      });
      expect(listAdminFeedbackDetailRecords).toHaveBeenCalledWith();
      expect(markFeedbackRecordsAsRead).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/feedback/assignees', () => {
    it('should return the three staff options without manager or credential fields', async () => {
      const res = await request(app).get('/api/admin/feedback/assignees');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([...databaseStaffOptions]);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      expect(res.body.some((user: { id: string }) => user.id === 'u1')).toBe(false);
    });
  });

  describe('PATCH /api/admin/feedback/assignee', () => {
    it('persists one assignee for all selected feedbacks', async () => {
      const feedbackUuids = [
        '00000000-0000-4000-8000-000000000b11',
        '00000000-0000-4000-8000-000000000b12',
      ];
      const assigneeId = PRIMARY_EMPLOYEE_UUID;

      const res = await request(app)
        .patch('/api/admin/feedback/assignee')
        .send({ feedbackUuids, assigneeId });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ updatedUuids: feedbackUuids, assigneeId });
      expect(assignFeedbackRecords).toHaveBeenCalledWith(feedbackUuids, assigneeId);
    });

    it('returns the persisted assignee in the list contract', async () => {
      const assigneeId = PRIMARY_EMPLOYEE_UUID;
      const assignedRow = adminDbFeedbackRows.find(
        (row) => row.uuid === '00000000-0000-4000-8000-000000000b11',
      );
      if (!assignedRow) {
        throw new Error('Expected the persisted feedback fixture to exist');
      }
      assignedRow.assignee_uuid = assigneeId;

      const res = await request(app).get('/api/admin/feedback');

      expect(res.status).toBe(200);
      expect(
        res.body.find(
          (feedback: { uuid: string }) => feedback.uuid === '00000000-0000-4000-8000-000000000b11',
        ).assigneeId,
      ).toBe(assigneeId);
    });

    it('rejects an assignee identifier that is not an employee UUID', async () => {
      const res = await request(app)
        .patch('/api/admin/feedback/assignee')
        .send({ feedbackUuids: ['00000000-0000-4000-8000-000000000b11'], assigneeId: 'u3' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(assignFeedbackRecords).not.toHaveBeenCalled();
    });

    it('does not partially assign when one feedback UUID is missing', async () => {
      const existingUuid = '00000000-0000-4000-8000-000000000b11';
      const missingUuid = '00000000-0000-4000-8000-000000000b99';
      const assigneeId = PRIMARY_EMPLOYEE_UUID;
      vi.mocked(assignFeedbackRecords).mockResolvedValueOnce({
        updatedUuids: [],
        missingUuids: [missingUuid],
        invalidAssignee: false,
      });

      const res = await request(app)
        .patch('/api/admin/feedback/assignee')
        .send({ feedbackUuids: [existingUuid, missingUuid], assigneeId });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(assignFeedbackRecords).toHaveBeenCalledWith([existingUuid, missingUuid], assigneeId);
    });
  });

  describe('PATCH /api/admin/feedback/read', () => {
    it('should mark all selected feedbacks as read and return their ids', async () => {
      const feedbackUuids = [
        '00000000-0000-4000-8000-000000000b11',
        '00000000-0000-4000-8000-000000000b12',
      ];

      const res = await request(app).patch('/api/admin/feedback/read').send({ feedbackUuids });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ updatedUuids: feedbackUuids });
      expect(markFeedbackRecordsAsRead).toHaveBeenCalledWith(feedbackUuids);
    });

    it('should reject an empty feedback id list', async () => {
      const res = await request(app).patch('/api/admin/feedback/read').send({ feedbackUuids: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should not partially update feedbacks when one id does not exist', async () => {
      const existingUuid = '00000000-0000-4000-8000-000000000b11';
      const missingUuid = '00000000-0000-4000-8000-000000000b99';
      vi.mocked(markFeedbackRecordsAsRead).mockResolvedValueOnce({
        updatedUuids: [],
        missingUuids: [missingUuid],
      });

      const res = await request(app)
        .patch('/api/admin/feedback/read')
        .send({ feedbackUuids: [existingUuid, missingUuid] });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(markFeedbackRecordsAsRead).toHaveBeenCalledWith([existingUuid, missingUuid]);
    });
  });

  describe('GET /api/admin/feedback/:id', () => {
    it('should return 400 for a malformed feedback UUID', async () => {
      const res = await request(app).get('/api/admin/feedback/invalid-id');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return feedback and mark it as read', async () => {
      const unreadUuid = adminDbDetailRecord.uuid;
      vi.mocked(getAdminFeedbackRecord).mockResolvedValueOnce(adminDbDetailRecord);

      const res = await request(app).get(`/api/admin/feedback/${unreadUuid}`);
      expect(res.status).toBe(200);
      expect(res.body.uuid).toBe(unreadUuid);
      expect(res.body.parentName).toBe('Jennifer Andrews');
      expect(res.body.petName).toBe('Sherlock');
      expect(res.body.answers).toEqual(['The parent answer.']);
      expect(Object.keys(res.body.detailedRatings).sort()).toEqual([
        'Communication',
        'Cost',
        'Professional',
        'Safety',
        'Service',
      ]);

      expect(res.body.timeline).toEqual([
        { step: 'submitted', timestamp: 'Aug 15, 12:00 PM', actor: 'System' },
      ]);
      expect(markFeedbackRecordsAsRead).toHaveBeenCalledWith([unreadUuid]);
    });
  });

  describe('DELETE /api/admin/feedback/:id', () => {
    it('returns 204 after deleting one feedback record', async () => {
      const feedbackUuid = '00000000-0000-4000-8000-000000000b11';
      vi.mocked(deleteFeedbackRecord).mockResolvedValueOnce({ deletedUuid: feedbackUuid });

      const res = await request(app).delete(`/api/admin/feedback/${feedbackUuid}`);

      expect(res.status).toBe(204);
      expect(deleteFeedbackRecord).toHaveBeenCalledWith(feedbackUuid);
    });

    it('returns 404 when the feedback record does not exist', async () => {
      const feedbackUuid = '00000000-0000-4000-8000-000000000b99';
      vi.mocked(deleteFeedbackRecord).mockResolvedValueOnce({ deletedUuid: null });

      const res = await request(app).delete(`/api/admin/feedback/${feedbackUuid}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects a malformed feedback UUID before reaching the repository', async () => {
      const res = await request(app).delete('/api/admin/feedback/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(deleteFeedbackRecord).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/admin/feedback/:id/status', () => {
    it('should return 400 for missing status', async () => {
      const res = await request(app)
        .patch(`/api/admin/feedback/${ISSUE_FEEDBACK_UUID}/status`)
        .send({}); // missing status

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details[0].field).toBe('status');
    });

    it('should update status and add timeline event', async () => {
      const res = await request(app)
        .patch(`/api/admin/feedback/${ISSUE_FEEDBACK_UUID}/status`)
        .send({ status: 'review_started' });

      expect(res.status).toBe(200);
      expect(res.body.current_status).toBe('review_started');

      const lastEvent = res.body.timeline[res.body.timeline.length - 1];
      expect(lastEvent.step).toBe('review_started');
      expect(lastEvent.actor).toBe(employeeUser.id);
      expect(transitionIssueFeedback).toHaveBeenCalledWith(
        ISSUE_FEEDBACK_UUID,
        'review_started',
        employeeUser.id,
        'submitted',
      );
    });

    it('should reject a status outside the feedback progress contract', async () => {
      const res = await request(app)
        .patch(`/api/admin/feedback/${ISSUE_FEEDBACK_UUID}/status`)
        .send({ status: 'escalated' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should reject complaint progress updates for Praise feedback', async () => {
      const original = adminWorkflowRecords.get(PRAISE_FEEDBACK_UUID);
      if (!original) {
        throw new Error('Expected the Praise fixture to exist');
      }
      const originalTimelineLength = original.timeline.length;

      const res = await request(app)
        .patch(`/api/admin/feedback/${PRAISE_FEEDBACK_UUID}/status`)
        .send({ status: 'review_started' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_FOR_FEEDBACK_TYPE');
      expect(original.current_status).toBe('submitted');
      expect(original.timeline).toHaveLength(originalTimelineLength);
    });

    it('should reject complaint progress updates for Suggestion feedback', async () => {
      const createResponse = await request(app)
        .post('/api/feedback')
        .field('payload', JSON.stringify(createParentPayload()));

      expect(createResponse.status).toBe(201);

      const res = await request(app)
        .patch(`/api/admin/feedback/${createResponse.body.uuid}/status`)
        .send({ status: 'review_started' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_FOR_FEEDBACK_TYPE');
    });
  });

  describe('PATCH /api/admin/feedback/:id/suggestion-workflow', () => {
    it('moves a Suggestion through review, decision, and closure', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const createResponse = await request(app)
        .post('/api/feedback')
        .field('payload', JSON.stringify(createParentPayload()));

      const feedbackUuid = createResponse.body.uuid as string;
      const underReview = await request(app)
        .patch(`/api/admin/feedback/${feedbackUuid}/suggestion-workflow`)
        .send({ status: 'under_review' });

      expect(underReview.status).toBe(200);
      expect(underReview.body.suggestionWorkflow.status).toBe('under_review');

      const decision = await request(app)
        .patch(`/api/admin/feedback/${feedbackUuid}/suggestion-workflow`)
        .send({
          status: 'decision_recorded',
          decision: 'quick_improvement',
          evidenceSummary: 'The same request appeared in several recent submissions.',
          decisionReason: 'The change is low effort and can be handled by Operations.',
        });

      expect(decision.status).toBe(200);
      expect(decision.body.suggestionWorkflow.decision).toBe('quick_improvement');

      const closed = await request(app)
        .patch(`/api/admin/feedback/${feedbackUuid}/suggestion-workflow`)
        .send({ status: 'closed' });

      expect(closed.status).toBe(200);
      expect(closed.body.suggestionWorkflow.status).toBe('closed');
      expect(closed.body.suggestionWorkflow.events).toHaveLength(4);

      const refreshed = await request(app).get(`/api/admin/feedback/${feedbackUuid}`);
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.current_status).toBe('submitted');
      expect(refreshed.body.suggestionWorkflow.status).toBe('closed');
      expect(refreshed.body.suggestionWorkflow.decision).toBe('quick_improvement');
      expect(refreshed.body.suggestionWorkflow.events).toHaveLength(4);

      consoleSpy.mockRestore();
    });

    it('requires a decision and reason before recording a Suggestion decision', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const createResponse = await request(app)
        .post('/api/feedback')
        .field('payload', JSON.stringify(createParentPayload()));
      const feedbackUuid = createResponse.body.uuid as string;

      await request(app)
        .patch(`/api/admin/feedback/${feedbackUuid}/suggestion-workflow`)
        .send({ status: 'under_review' });

      const res = await request(app)
        .patch(`/api/admin/feedback/${feedbackUuid}/suggestion-workflow`)
        .send({ status: 'decision_recorded' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SUGGESTION_DECISION_REQUIRED');

      consoleSpy.mockRestore();
    });

    it('rejects the Suggestion workflow endpoint for Issue feedback', async () => {
      const res = await request(app)
        .patch(`/api/admin/feedback/${ISSUE_FEEDBACK_UUID}/suggestion-workflow`)
        .send({ status: 'under_review' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_FOR_FEEDBACK_TYPE');
    });

    it('rejects an invalid Suggestion workflow transition', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const feedbackUuid = '00000000-0000-4000-8000-000000000b16';

      const res = await request(app)
        .patch(`/api/admin/feedback/${feedbackUuid}/suggestion-workflow`)
        .send({ status: 'closed' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SUGGESTION_WORKFLOW_TRANSITION');

      consoleSpy.mockRestore();
    });
  });

  describe('POST /api/admin/feedback/:id/reply', () => {
    it('should return 400 for empty emailBody', async () => {
      const res = await request(app)
        .post(`/api/admin/feedback/${PRAISE_FEEDBACK_UUID}/reply`)
        .send({}); // missing emailBody

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should update status to sent and add timeline event', async () => {
      const res = await request(app)
        .post(`/api/admin/feedback/${ISSUE_FEEDBACK_UUID}/reply`)
        .send({ emailBody: 'Thank you for your feedback.' });

      expect(res.status).toBe(200);
      expect(res.body.current_status).toBe('sent');

      const lastEvent = res.body.timeline[res.body.timeline.length - 1];
      expect(lastEvent.step).toBe('sent');
    });
  });

  describe('POST /api/feedback/generate-insights', () => {
    const ratings = { Professional: 5, Service: 4, Communication: 5, Safety: 5, Cost: 3 };

    it('answers 400 for malformed feedback without calling the model', async () => {
      vi.mocked(generateObject).mockClear();

      const res = await request(app)
        .post('/api/feedback/generate-insights')
        .send({ rating_details: ratings, raw_answer: '   ' });

      expect(res.status).toBe(400);
      expect(generateObject).not.toHaveBeenCalled();
    });

    it('keeps the model error out of the response', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(generateObject).mockRejectedValueOnce(
        new Error('provider echoed: parent wrote about Biscuit'),
      );

      const res = await request(app)
        .post('/api/feedback/generate-insights')
        .send({ rating_details: ratings, raw_answer: 'Biscuit came home happy' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to generate insights' });
    });
  });

  describe('POST /api/feedback', () => {
    it('should return 400 for missing payload', async () => {
      const res = await request(app).post('/api/feedback').send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.message).toBe('Missing payload');
    });

    it('should return 400 for invalid JSON payload', async () => {
      const res = await request(app).post('/api/feedback').field('payload', '{ invalid json }');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid JSON payload');
    });

    it('should return 400 when feedback type is missing', async () => {
      const payload = {
        ...parentContext,
        rating_details: ratingDetails,
        raw_answer: 'Missing category feedback.',
      };

      const res = await request(app)
        .post('/api/feedback')
        .field('payload', JSON.stringify(payload));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'category' })]),
      );
    });

    it('should return 400 when feedback type is not allowlisted', async () => {
      const payload = {
        ...createParentPayload(),
        category: 'Other',
      };

      const res = await request(app)
        .post('/api/feedback')
        .field('payload', JSON.stringify(payload));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'category' })]),
      );
    });

    it('should create new feedback without audio', async () => {
      const payload = {
        ...parentContext,
        category: 'Praise',
        rating_details: ratingDetails,
        raw_answer: 'Test feedback.',
      };

      const res = await request(app)
        .post('/api/feedback')
        .field('payload', JSON.stringify(payload));

      expect(res.status).toBe(201);
      expect(res.body.uuid).toBe('00000000-0000-4000-8000-000000000b16');
      expect(res.body.pet_uuid).toBe(parentContext.pet_uuid);
      expect(res.body.pet_owners_uuid).toBe(parentContext.pet_owners_uuid);
      expect(res.body.category).toBe('Praise');
      // Rating average should be (5+4+3+4+4)/5 = 4
      expect(res.body.rating).toBe(4);
      expect(res.body.rating_details).toEqual(ratingDetails);
      expect(res.body.raw_answer).toBe('Test feedback.');
      expect(res.body.ai_insights).toEqual({
        summary: 'LLM summary',
        insights: ['LLM insight'],
      });
      expect(res.body.audio_url).toBeNull();
    });

    it('should create new feedback with audio file attached', async () => {
      const payload = {
        ...parentContext,
        category: 'Issue',
        rating_details: ratingDetails,
        raw_answer: 'Audio feedback.',
      };

      // Create a dummy buffer to simulate an audio file
      const dummyAudio = Buffer.from('dummy audio content');

      const res = await request(app)
        .post('/api/feedback')
        .field('payload', JSON.stringify(payload))
        .attach('audio', dummyAudio, 'test.webm');

      expect(res.status).toBe(201);
      expect(res.body.category).toBe('Issue');
      expect(res.body.audio_url).toMatch(/^\/uploads\/feedback\/.+\.webm$/);
      expect(res.body.raw_answer).toBe('Audio feedback.');
      savedAudioUrl = res.body.audio_url;
    });
  });
});
