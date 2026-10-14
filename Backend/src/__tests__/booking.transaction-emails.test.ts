import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendBookingNoticeEmail } from '../services/booking.transaction-emails.js';
import {
  findBookingEmailRecipient,
  type ParentNoticeDraft,
} from '../repositories/booking.notification.repository.js';
import { readEmailSetup } from '../services/concierge/concierge.email.js';
import { findAgreedTerms } from '../repositories/booking.agreement.repository.js';
vi.mock('../repositories/booking.agreement.repository.js', () => ({
  findAgreedTerms: vi.fn(),
}));
vi.mock('../repositories/booking.notification.repository.js', () => ({
  findBookingEmailRecipient: vi.fn(),
}));
vi.mock('../services/concierge/concierge.email.js', () => ({
  readEmailSetup: vi.fn(),
  SES_EMAIL_MODE: 'ses',
}));
const send = vi.fn(async () => undefined);
const notice: ParentNoticeDraft = {
  bookingId: '12345678-0000-4000-8000-000000000001',
  ownerId: 'owner',
  kind: 'booking_request_received',
  body: 'Request received. Nothing is booked yet.',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findBookingEmailRecipient).mockResolvedValue('parent@example.test');
  vi.mocked(findAgreedTerms).mockResolvedValue(
    'Wagstay booking terms, version concierge-terms-2026-10-01\n\n3. Cancellation',
  );
  vi.mocked(readEmailSetup).mockReturnValue({
    sender: { sendVerificationCode: vi.fn(), sendBookingEmail: send },
  });
});
describe('transactional booking emails', () => {
  it.each(['booking_request_received', 'booking_approved', 'booking_refused'] as const)(
    'sends the %s event via configured SES',
    async (kind) => {
      await sendBookingNoticeEmail({ ...notice, kind }, { CONCIERGE_EMAIL_MODE: 'ses' });
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'parent@example.test',
          text: expect.stringContaining(notice.body),
        }),
      );
      expect(findBookingEmailRecipient).toHaveBeenCalledWith(notice.bookingId, notice.ownerId);
    },
  );
  it('gives the parent a copy of the terms they agreed to with the checkout receipt', async () => {
    await sendBookingNoticeEmail(
      { ...notice, withAgreedTerms: true },
      { CONCIERGE_EMAIL_MODE: 'ses' },
    );
    const [message] = send.mock.calls[0] as unknown as [{ text: string }];
    expect(message.text).toContain('The booking terms you agreed to:');
    expect(message.text).toContain('version concierge-terms-2026-10-01\n\n3. Cancellation');
    expect(findAgreedTerms).toHaveBeenCalledWith(notice.bookingId);
  });
  it('keeps decision emails short: the terms go with the checkout receipt only', async () => {
    await sendBookingNoticeEmail(
      { ...notice, kind: 'booking_approved' },
      { CONCIERGE_EMAIL_MODE: 'ses' },
    );
    const [message] = send.mock.calls[0] as unknown as [{ text: string }];
    expect(message.text).not.toContain('The booking terms you agreed to');
    expect(findAgreedTerms).not.toHaveBeenCalled();
  });
  it('still sends the receipt when the agreed terms cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(findAgreedTerms).mockRejectedValueOnce(new Error('connection lost'));
    await sendBookingNoticeEmail(
      { ...notice, withAgreedTerms: true },
      { CONCIERGE_EMAIL_MODE: 'ses' },
    );
    const [message] = send.mock.calls[0] as unknown as [{ text: string }];
    expect(message.text).toContain(notice.body);
    expect(message.text).not.toContain('The booking terms you agreed to');
    warn.mockRestore();
  });
  it('does not send or look up recipients without SES', async () => {
    await sendBookingNoticeEmail(notice, {});
    await sendBookingNoticeEmail(notice, { CONCIERGE_EMAIL_MODE: 'console' });
    expect(send).not.toHaveBeenCalled();
    expect(findBookingEmailRecipient).not.toHaveBeenCalled();
  });
  it('ignores repeated decisions whose composer returned no new notice', async () => {
    await sendBookingNoticeEmail(null, { CONCIERGE_EMAIL_MODE: 'ses' });
    expect(send).not.toHaveBeenCalled();
  });
  it('does not undo a committed event when delivery fails or configuration is incomplete', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    send.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(
      sendBookingNoticeEmail(notice, { CONCIERGE_EMAIL_MODE: 'ses' }),
    ).resolves.toBeUndefined();
    vi.mocked(readEmailSetup).mockReturnValueOnce({ problem: 'not configured' });
    await expect(
      sendBookingNoticeEmail(notice, { CONCIERGE_EMAIL_MODE: 'ses' }),
    ).resolves.toBeUndefined();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('parent@example.test');
    warn.mockRestore();
  });
});
