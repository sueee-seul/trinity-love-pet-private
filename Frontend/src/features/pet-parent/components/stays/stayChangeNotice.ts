import type { PortalLocale } from '../../i18n/portalLocale';
import type {
  AddOnResult,
  CancellationResult,
  ChangeTimesResult,
  ExtensionResult,
  RescheduleResult,
} from '../../types/stayChanges';
import type { InStayChangesCopy } from './inStayChangesCopy';
import type { StayChangesCopy } from './stayChangesCopy';
import { formatDay, formatDayAndClock, formatMoney } from './stayChangeRules';

/**
 * What a change did, kept rather than its words, so the notice on My stays follows a change of
 * site language.
 */
export type StayChangeNotice =
  | { kind: 'cancelled'; result: CancellationResult; paid: boolean }
  | { kind: 'moved'; result: RescheduleResult }
  | { kind: 'extended'; result: ExtensionResult }
  | { kind: 'add_on'; result: AddOnResult }
  | { kind: 'times'; result: ChangeTimesResult };

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
    case 'extended': {
      const extended =
        notice.result.settlement === 'desk' ? copy.inStay.extendedToBill : copy.inStay.extended;
      return extended(
        formatDay(notice.result.newEndDate, locale),
        formatMoney(notice.result.amount),
      );
    }
    case 'add_on': {
      const added =
        notice.result.settlement === 'desk' ? copy.inStay.addOnToBill : copy.inStay.addOnBooked;
      return added(
        notice.result.quantity,
        notice.result.serviceName,
        formatDay(notice.result.date, locale),
        formatMoney(notice.result.amount),
      );
    }
    case 'times':
      return copy.inStay.timesChanged(
        formatDayAndClock(notice.result.dropOffAt, locale),
        formatDayAndClock(notice.result.pickUpAt, locale),
      );
  }
};
