import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignGoogleReviews,
  getAdminGoogleReviews,
  replyToGoogleReview,
  updateGoogleReviewTriage,
} from '../services/admin.google.review.service.js';

const {
  assignGoogleReviewRecordsMock,
  findAdminGoogleBusinessReviewsMock,
  updateMockGoogleBusinessReviewReplyMock,
  updateGoogleReviewTriageMock,
  publishGoogleReviewEventMock,
  resolveReviewPhotoUrlsMock,
} = vi.hoisted(() => ({
  assignGoogleReviewRecordsMock: vi.fn(),
  findAdminGoogleBusinessReviewsMock: vi.fn(),
  updateMockGoogleBusinessReviewReplyMock: vi.fn(),
  updateGoogleReviewTriageMock: vi.fn(),
  publishGoogleReviewEventMock: vi.fn(),
  resolveReviewPhotoUrlsMock: vi.fn(),
}));

const manager = { id: '00000000-0000-4000-8000-000000000201', role: 'manager' as const };
const staff = { id: '00000000-0000-4000-8000-000000000202', role: 'staff' as const };
const reviewUuid = '00000000-0000-4000-8000-000000000901';
const managerCorrection = {
  correctionId: '00000000-0000-4000-8000-000000000903',
  reviewUuid,
  sourceRunId: null,
  originalAiType: null,
  correctedType: 'praise' as const,
  managerId: manager.id,
  occurredAt: '2026-09-02T00:00:00.000Z',
};

vi.mock('../repositories/admin.google.review.repository.js', () => ({
  assignGoogleReviewRecords: assignGoogleReviewRecordsMock,
  findAdminGoogleBusinessReviews: findAdminGoogleBusinessReviewsMock,
  updateMockGoogleBusinessReviewReply: updateMockGoogleBusinessReviewReplyMock,
  updateGoogleReviewTriage: updateGoogleReviewTriageMock,
}));

vi.mock('../services/google.review.events.js', () => ({
  publishGoogleReviewEvent: publishGoogleReviewEventMock,
}));

vi.mock('../services/review.photo.storage.js', () => ({
  resolveReviewPhotoUrls: resolveReviewPhotoUrlsMock,
}));

beforeEach(() => {
  assignGoogleReviewRecordsMock.mockReset();
  findAdminGoogleBusinessReviewsMock.mockReset();
  updateMockGoogleBusinessReviewReplyMock.mockReset();
  updateGoogleReviewTriageMock.mockReset();
  publishGoogleReviewEventMock.mockReset();
  resolveReviewPhotoUrlsMock.mockReset();
  resolveReviewPhotoUrlsMock.mockResolvedValue([]);
});

describe('assignGoogleReviews', () => {
  it('deduplicates UUIDs and preserves the assignment response contract', async () => {
    const reviewUuid = '00000000-0000-4000-8000-000000000901';
    const assigneeId = '00000000-0000-4000-8000-000000000203';
    assignGoogleReviewRecordsMock.mockResolvedValueOnce({
      updatedUuids: [reviewUuid],
      missingUuids: [],
      invalidAssignee: false,
    });

    await expect(assignGoogleReviews([reviewUuid, reviewUuid], assigneeId)).resolves.toEqual({
      updatedUuids: [reviewUuid],
      assigneeId,
    });
    expect(assignGoogleReviewRecordsMock).toHaveBeenCalledWith([reviewUuid], assigneeId);
    expect(publishGoogleReviewEventMock).toHaveBeenCalledOnce();
    expect(publishGoogleReviewEventMock).toHaveBeenCalledWith({
      target: 'admin',
      placeSlug: 'PetHouse',
      changeType: 'assigned',
    });
  });

  it.each([
    ['invalid assignee', { invalidAssignee: true, missingUuids: [] }, 'INVALID_ASSIGNEE', 400],
    [
      'missing review',
      { invalidAssignee: false, missingUuids: ['00000000-0000-4000-8000-000000000999'] },
      'GOOGLE_REVIEW_NOT_FOUND',
      404,
    ],
  ] as const)('maps %s to a controlled error', async (_label, result, code, statusCode) => {
    assignGoogleReviewRecordsMock.mockResolvedValueOnce({
      updatedUuids: [],
      ...result,
    });

    await expect(
      assignGoogleReviews(
        ['00000000-0000-4000-8000-000000000901'],
        '00000000-0000-4000-8000-000000000203',
      ),
    ).rejects.toMatchObject({ code, statusCode });
  });

  it('maps assignment persistence failures without exposing database details', async () => {
    assignGoogleReviewRecordsMock.mockRejectedValueOnce(
      new Error('password=secret database connection details'),
    );

    await expect(
      assignGoogleReviews(
        ['00000000-0000-4000-8000-000000000901'],
        '00000000-0000-4000-8000-000000000203',
      ),
    ).rejects.toMatchObject({
      code: 'GOOGLE_REVIEW_ASSIGNMENT_UNAVAILABLE',
      statusCode: 503,
      message: 'Google review assignment could not be updated',
    });
    expect(publishGoogleReviewEventMock).not.toHaveBeenCalled();
  });

  it('rejects assignment when any selected review has no effective type', async () => {
    assignGoogleReviewRecordsMock.mockResolvedValueOnce({
      updatedUuids: [],
      missingUuids: [],
      invalidAssignee: false,
      undecidedUuids: ['review-1'],
    });

    await expect(assignGoogleReviews(['review-1'], 'employee-1')).rejects.toMatchObject({
      code: 'GOOGLE_REVIEW_TRIAGE_REQUIRED',
      statusCode: 409,
    });
    expect(publishGoogleReviewEventMock).not.toHaveBeenCalled();
  });
});

describe('updateGoogleReviewTriage', () => {
  it('rejects staff type corrections before reaching the repository', async () => {
    await expect(updateGoogleReviewTriage(reviewUuid, 'issue', staff)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
    expect(updateGoogleReviewTriageMock).not.toHaveBeenCalled();
  });

  it('returns the updated admin projection and publishes an admin event', async () => {
    updateGoogleReviewTriageMock.mockResolvedValueOnce({
      outcome: 'updated',
      review: {
        id: reviewUuid,
        reviewer_display_name: 'Andrew',
        reviewer_email: 'andrew@example.test',
        reviewer_profile_photo_url: null,
        reviewer_is_anonymous: false,
        rating: 5,
        comment: 'Great care.',
        google_created_at: new Date('2026-08-10T00:00:00.000Z'),
        google_updated_at: new Date('2026-08-10T00:00:00.000Z'),
        owner_reply: null,
        owner_reply_updated_at: null,
        photo_urls: [],
        is_read: false,
        current_status: 'received',
        assigned_employee_uuid: null,
        manager_correction: {
          correctionId: '00000000-0000-4000-8000-000000000903',
          reviewUuid,
          sourceRunId: null,
          originalAiType: null,
          correctedType: 'issue',
          managerId: manager.id,
          occurredAt: '2026-09-02T00:00:00.000Z',
        },
      },
    });

    await expect(updateGoogleReviewTriage(reviewUuid, 'issue', manager)).resolves.toMatchObject({
      id: reviewUuid,
      triageType: 'issue',
    });
    expect(updateGoogleReviewTriageMock).toHaveBeenCalledWith(reviewUuid, 'issue', manager.id);
    expect(publishGoogleReviewEventMock).toHaveBeenCalledWith({
      target: 'admin',
      placeSlug: 'PetHouse',
      changeType: 'triage_updated',
    });
  });

  it.each([
    ['not_found', 'GOOGLE_REVIEW_NOT_FOUND', 404],
    ['invalid_data', 'INVALID_GOOGLE_REVIEW_DATA', 409],
  ] as const)('fails closed for %s review data', async (outcome, code, statusCode) => {
    updateGoogleReviewTriageMock.mockResolvedValueOnce({ outcome });

    await expect(updateGoogleReviewTriage(reviewUuid, 'praise', manager)).rejects.toMatchObject({
      code,
      statusCode,
    });
    expect(publishGoogleReviewEventMock).not.toHaveBeenCalled();
  });
});

describe('getAdminGoogleReviews', () => {
  it('maps persisted review data and manager results for employee reads', async () => {
    findAdminGoogleBusinessReviewsMock.mockResolvedValueOnce([
      {
        id: reviewUuid,
        reviewer_display_name: 'Andrew',
        reviewer_email: 'andrew@example.test',
        reviewer_profile_photo_url: 'https://example.test/avatar.png',
        reviewer_is_anonymous: false,
        rating: 5,
        comment: 'Great care.',
        google_created_at: new Date('2026-08-10T00:00:00.000Z'),
        google_updated_at: new Date('2026-08-10T00:00:00.000Z'),
        owner_reply: 'Earlier sent reply',
        owner_reply_updated_at: new Date('2026-09-01T01:00:00.000Z'),
        photo_urls: ['google-reviews/upload-1/pikkle.jpg'],
        is_read: true,
        current_status: 'review_started',
        assigned_employee_uuid: '00000000-0000-4000-8000-000000000202',
        manager_correction: {
          ...managerCorrection,
          correctedType: 'praise',
        },
      },
    ]);

    resolveReviewPhotoUrlsMock.mockResolvedValueOnce(['https://signed.example.test/pikkle.jpg']);

    await expect(getAdminGoogleReviews('PetHouse', manager)).resolves.toEqual({
      reviews: [
        {
          id: reviewUuid,
          reviewerName: 'Andrew',
          reviewerEmail: 'andrew@example.test',
          reviewerAvatarUrl: 'https://example.test/avatar.png',
          reviewerIsAnonymous: false,
          rating: 5,
          reviewText: 'Great care.',
          photoUrls: ['https://signed.example.test/pikkle.jpg'],
          createdAt: '2026-08-10T00:00:00.000Z',
          updatedAt: '2026-08-10T00:00:00.000Z',
          ownerReply: 'Earlier sent reply',
          ownerReplyUpdatedAt: '2026-09-01T01:00:00.000Z',
          triageType: 'praise',
          isRead: true,
          currentStatus: 'review_started',
          assignedEmployeeUuid: '00000000-0000-4000-8000-000000000202',
        },
      ],
    });
    expect(findAdminGoogleBusinessReviewsMock).toHaveBeenCalledWith('PetHouse', manager);
    expect(resolveReviewPhotoUrlsMock).toHaveBeenCalledWith(['google-reviews/upload-1/pikkle.jpg']);
  });

  it('defaults attention, workflow, and assignment fields when external feedback is absent', async () => {
    findAdminGoogleBusinessReviewsMock.mockResolvedValueOnce([
      {
        id: reviewUuid,
        reviewer_display_name: 'Andrew',
        reviewer_email: 'andrew@example.test',
        reviewer_profile_photo_url: null,
        reviewer_is_anonymous: false,
        rating: 5,
        comment: 'Great care.',
        google_created_at: new Date('2026-08-10T00:00:00.000Z'),
        google_updated_at: new Date('2026-08-10T00:00:00.000Z'),
        owner_reply: null,
        owner_reply_updated_at: null,
        photo_urls: [],
        is_read: null,
        current_status: null,
        assigned_employee_uuid: null,
        manager_correction: null,
      },
    ]);

    await expect(getAdminGoogleReviews('PetHouse', staff)).resolves.toMatchObject({
      reviews: [
        expect.objectContaining({
          isRead: false,
          currentStatus: 'received',
          assignedEmployeeUuid: null,
          triageType: null,
        }),
      ],
    });
    expect(findAdminGoogleBusinessReviewsMock).toHaveBeenCalledWith('PetHouse', staff);
  });

  it('returns a not-found error when the location is not configured', async () => {
    findAdminGoogleBusinessReviewsMock.mockResolvedValueOnce(null);

    await expect(getAdminGoogleReviews('UnknownPlace', manager)).rejects.toMatchObject({
      code: 'GOOGLE_REVIEW_LOCATION_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('treats an invalid manager-selected type as unclassified', async () => {
    findAdminGoogleBusinessReviewsMock.mockResolvedValueOnce([
      {
        id: reviewUuid,
        reviewer_display_name: 'Andrew',
        reviewer_email: null,
        reviewer_profile_photo_url: null,
        reviewer_is_anonymous: false,
        rating: 5,
        comment: 'Great care.',
        google_created_at: new Date('2026-08-10T00:00:00.000Z'),
        google_updated_at: new Date('2026-08-10T00:00:00.000Z'),
        owner_reply: null,
        owner_reply_updated_at: null,
        photo_urls: [],
        is_read: null,
        current_status: null,
        assigned_employee_uuid: null,
        manager_correction: { invalid: true },
      },
    ]);

    await expect(getAdminGoogleReviews('PetHouse', staff)).resolves.toMatchObject({
      reviews: [expect.objectContaining({ triageType: null })],
    });
  });

  it('returns the updated admin projection after saving a mock review reply', async () => {
    const updatedRecord = {
      id: reviewUuid,
      reviewer_display_name: 'Andrew',
      reviewer_email: 'andrew@example.test',
      reviewer_profile_photo_url: null,
      reviewer_is_anonymous: false,
      rating: 5,
      comment: 'Great care.',
      google_created_at: new Date('2026-08-10T00:00:00.000Z'),
      google_updated_at: new Date('2026-08-10T00:00:00.000Z'),
      owner_reply: 'Thank you.',
      owner_reply_updated_at: new Date('2026-09-02T01:00:00.000Z'),
      photo_urls: [],
      is_read: false,
      current_status: 'received',
      assigned_employee_uuid: null,
      manager_correction: null,
    };
    updateMockGoogleBusinessReviewReplyMock.mockResolvedValueOnce({
      outcome: 'updated',
      review: updatedRecord,
    });

    await expect(replyToGoogleReview('review-1', 'Thank you.', manager)).resolves.toEqual({
      id: reviewUuid,
      reviewerName: 'Andrew',
      reviewerEmail: 'andrew@example.test',
      reviewerAvatarUrl: null,
      reviewerIsAnonymous: false,
      rating: 5,
      reviewText: 'Great care.',
      photoUrls: [],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      ownerReply: 'Thank you.',
      ownerReplyUpdatedAt: '2026-09-02T01:00:00.000Z',
      triageType: null,
      isRead: false,
      currentStatus: 'received',
      assignedEmployeeUuid: null,
    });
    expect(updateMockGoogleBusinessReviewReplyMock).toHaveBeenCalledWith(
      'review-1',
      'Thank you.',
      manager,
    );
    expect(publishGoogleReviewEventMock).toHaveBeenCalledOnce();
    expect(publishGoogleReviewEventMock).toHaveBeenCalledWith({
      target: 'both',
      placeSlug: 'PetHouse',
      changeType: 'replied',
    });
  });

  it.each([
    ['not_found', 'GOOGLE_REVIEW_NOT_FOUND', 404],
    ['not_mock', 'GOOGLE_REVIEW_REPLY_NOT_SUPPORTED', 409],
    ['recipient_unavailable', 'GOOGLE_REVIEW_RECIPIENT_UNAVAILABLE', 422],
  ] as const)('maps %s reply outcomes to controlled errors', async (outcome, code, statusCode) => {
    updateMockGoogleBusinessReviewReplyMock.mockResolvedValueOnce({ outcome });

    await expect(replyToGoogleReview('review-1', 'Thank you.', staff)).rejects.toMatchObject({
      code,
      statusCode,
    });
    expect(publishGoogleReviewEventMock).not.toHaveBeenCalled();
  });
});
