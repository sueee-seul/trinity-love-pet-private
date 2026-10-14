import { pool } from '../config/database.js';
import { formatNewZealandTime } from '../common/utils/new-zealand-time.js';
import { BOOKING_ESCALATION } from '../contracts/booking.notification.contract.js';
import {
  REPLY_BY_MINUTES,
  type Escalation,
  type RaiseEscalationInput,
} from '../contracts/escalation.contract.js';
import { insertManagerNotice } from '../repositories/booking.notification.repository.js';
import { insertEscalation, type StoredEscalation } from '../repositories/escalation.repository.js';
import { recordMetric } from './care-metrics.service.js';
import { toConfirmationNumber } from './petparent.booking.js';

/**
 * One way to ask for a person (Scenario 11 outcome 8). Whoever raises an escalation (today the stay
 * memory, when a trend reaches its mark) gives the facts and a suggested step; this writes the
 * record, tells every active manager in the bell with the step and the reply-by time, and counts it.
 */

const withReference = (stored: StoredEscalation): Escalation => ({
  ...stored,
  reference: stored.bookingId ? toConfirmationNumber(stored.bookingId) : null,
});

const managerLine = (escalation: Escalation): string =>
  `${escalation.severity === 'urgent' ? 'Urgent: ' : ''}${escalation.summary} Suggested next step: ${escalation.suggestedStep} Please reply by ${formatNewZealandTime(new Date(escalation.replyBy))}.${
    escalation.reference ? ` Reference ${escalation.reference}.` : ''
  }`;

export const raiseEscalation = async (
  input: RaiseEscalationInput,
  now: Date = new Date(),
): Promise<Escalation> => {
  const replyBy = new Date(now.getTime() + REPLY_BY_MINUTES[input.severity] * 60_000);
  const escalation = withReference(await insertEscalation(input, replyBy));
  if (escalation.bookingId) {
    await insertManagerNotice(pool, {
      bookingId: escalation.bookingId,
      setting: input.noticeSetting ?? BOOKING_ESCALATION,
      summary: managerLine(escalation),
    });
  }
  void recordMetric('escalation_raised', {
    bookingId: escalation.bookingId,
    meta: { source: input.source, severity: input.severity },
  });
  return escalation;
};
