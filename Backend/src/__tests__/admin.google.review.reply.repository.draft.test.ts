import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import { updateMockGoogleBusinessReviewReply } from '../repositories/admin.google.review.reply.repository.js';

vi.mock('../config/database.js', () => ({
  pool: { connect: vi.fn() },
}));

const manager = { id: '00000000-0000-4000-8000-000000000201', role: 'manager' as const };
const reviewUuid = '00000000-0000-4000-8000-000000000901';
const externalFeedbackUuid = '00000000-0000-4000-8000-000000000902';
const draftUuid = '00000000-0000-4000-8000-000000000903';

describe('admin Google review reply repository', () => {
  beforeEach(() => {
    vi.mocked(pool.connect).mockReset();
  });

  it('promotes the existing draft row to sent when Reply is clicked', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: reviewUuid,
            data_origin: 'mock',
            reviewer_email: 'andrew@example.test',
            external_feedback_uuid: externalFeedbackUuid,
            latest_draft_uuid: draftUuid,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ uuid: draftUuid }] })
      .mockResolvedValueOnce({
        rows: [
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
            owner_reply: 'Edited before sending.',
            owner_reply_updated_at: new Date('2026-09-12T00:00:00.000Z'),
            draft_reply: null,
            draft_reply_updated_at: null,
            photo_urls: [],
            investigation_result: null,
            manager_correction: null,
            is_read: false,
            current_status: 'received',
            assigned_employee_uuid: null,
          },
        ],
      })
      .mockResolvedValueOnce({});

    await expect(
      updateMockGoogleBusinessReviewReply(reviewUuid, 'Edited before sending.', manager),
    ).resolves.toMatchObject({ outcome: 'updated' });

    expect(String(client.query.mock.calls[2]?.[0])).toContain("reply_status = 'sent'");
    expect(client.query.mock.calls[2]?.[1]).toEqual([
      draftUuid,
      manager.id,
      'Edited before sending.',
    ]);
    expect(String(client.query.mock.calls[2]?.[0])).not.toContain(
      'INSERT INTO external_feedback_replies',
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });
});
