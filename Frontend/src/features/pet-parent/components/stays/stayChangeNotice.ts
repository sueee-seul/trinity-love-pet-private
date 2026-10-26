import type { PortalLocale } from '../../i18n/portalLocale';
import type {
  CancellationResult,
  RescheduleResult,
  StayChangeRequest,
} from '../../types/stayChanges';
import type { InStayChangesCopy } from './inStayChangesCopy';
import type { StayChangesCopy } from './stayChangesCopy';
import { formatDay, formatMoney } from './stayChangeRules';

/**
 * What a change did, kept rather than its words, so the notice on My stays follows a change of
 * site language.
 */
export type StayChangeNotice =
  | { kind: 'cancelled'; result: CancellationResult; paid: boolean }
  | { kind: 'moved'; result: RescheduleResult }
  /** A change while the pet is staying was asked for; our manager decides it. */
  | { kind: 'requested'; request: StayChangeRequest };

export interface StayNoticeCopy {
  changes: StayChangesCopy['notice'];
  inStay: InStayChangesCopy['notice'];
}

export const stayChangeNoticeText = (
  notice: StayChangeNotice,
  copy: StayNoticeCopy,
  locale: PortalLocale,
): string => {
  switch (notice.kind) {
    case 'cancelled': {
      const { fee } = notice.result;
      if (notice.paid) return copy.changes.cancelledPaid(fee > 0 ? formatMoney(fee) : null);
      return fee > 0 ? copy.changes.cancelledWithFee(formatMoney(fee)) : copy.changes.cancelledFree;
    }
    case 'moved': {
      const startDay = formatDay(notice.result.startDate, locale);
      const total = formatMoney(notice.result.total);
      return notice.result.paysNow
        ? copy.changes.movedPaid(startDay, total)
        : copy.changes.moved(startDay, total);
    }
    case 'requested':
      return copy.inStay.requested;
  }
};
