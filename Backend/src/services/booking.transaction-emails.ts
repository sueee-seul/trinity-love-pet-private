import { findAgreedTerms } from '../repositories/booking.agreement.repository.js';
import {
  findBookingEmailRecipient,
  type ParentNoticeDraft,
} from '../repositories/booking.notification.repository.js';
import { noticeTitle } from './booking.notification.messages.js';
import { readEmailSetup, SES_EMAIL_MODE } from './concierge/concierge.email.js';
import { toConfirmationNumber } from './petparent.booking.js';

/**
 * The receipt carries the terms agreed at checkout, so the parent keeps a copy of every clause
 * (fees, holds, vet consent). A failed read costs only the copy, never the receipt itself.
 */
const agreedTermsAppendix = async (notice: ParentNoticeDraft): Promise<string> => {
  if (!notice.withAgreedTerms) return '';
  try {
    const terms = await findAgreedTerms(notice.bookingId);
    if (terms) return `\n\nThe booking terms you agreed to:\n\n${terms}`;
    console.warn('[booking email] agreed terms not found', { bookingId: notice.bookingId });
  } catch (error: unknown) {
    console.warn('[booking email] agreed terms unavailable', {
      bookingId: notice.bookingId,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
  return '';
};

/**
 * Best-effort email after the request/decision transaction commits. In-app notices remain the
 * durable record. No SES means notices only; a provider error must not undo an approved stay.
 * A null draft means there was no state change, so repeated decisions send no duplicate email.
 * It never rejects, so callers start it without awaiting: a slow mail provider must not hold up
 * the guest's checkout or the manager's decision.
 */
export const sendBookingNoticeEmail = async (
  notice: ParentNoticeDraft | null,
  environment: Record<string, string | undefined> = process.env,
): Promise<void> => {
  if (!notice || environment.CONCIERGE_EMAIL_MODE?.trim() !== SES_EMAIL_MODE) return;
  try {
    const setup = readEmailSetup(environment);
    if ('problem' in setup) {
      console.warn('[booking email] SES configuration unavailable');
      return;
    }
    const to = await findBookingEmailRecipient(notice.bookingId, notice.ownerId);
    if (!to) {
      console.warn('[booking email] recipient unavailable', { bookingId: notice.bookingId });
      return;
    }
    const reference = toConfirmationNumber(notice.bookingId);
    const terms = await agreedTermsAppendix(notice);
    const locale = notice.locale ?? 'en';
    const footer =
      locale === 'zh'
        ? `参考编号：${reference}\n最新的决定、银行卡状态和下一步都在“我的住宿”里。`
        : `Reference: ${reference}\nSee My Stays for the current decision, card status and your next steps.`;
    await setup.sender.sendBookingEmail({
      to,
      subject: `Wagstay: ${noticeTitle(notice.kind, locale)} (${reference})`,
      text: `${notice.body}\n\n${footer}${terms}`,
    });
  } catch (error: unknown) {
    // Provider error text may contain recipient data; only the error class is logged.
    console.warn('[booking email] delivery failed; in-app notice remains available', {
      bookingId: notice.bookingId,
      event: notice.kind,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
};
