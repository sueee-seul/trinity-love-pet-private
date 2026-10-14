import { refusalReasonIn } from '../../../../shared/booking/refusalReasons';
import type { PortalLocale } from '../../i18n/portalLocale';
import type {
  NoticeReviewReason,
  NoticeStayDates,
  ParentNotification,
  ParentNotificationKind,
} from '../../types/notifications';
import { listOfNames } from '../stays/stayChangeRules';

/*
 * A notice in the reader's language. The server writes each notice as an English sentence and
 * also says what it means (`facts`), so English shows the sentence as written and Chinese says the
 * same things in its own words. Money is not restated: the policy of the day was in the English,
 * and My stays shows what is held or charged now. A notice the server could not read gets a
 * general line for its kind. The one exception is a notice the server wrote in the parent's own
 * language (see WRITTEN_IN_PARENTS_LANGUAGE): a Chinese body is shown as written.
 */

const TITLES_IN_CHINESE: Record<ParentNotificationKind, string> = {
  booking_request_received: '已收到申请',
  booking_approved: '已确认',
  booking_refused: '未被接受',
  booking_back_in_review: '重新审核',
  booking_extended: '住宿已延长',
  booking_picked_up_early: '提前离店',
  booking_add_on_booked: '已预订附加服务',
  booking_times_changed: '时间已更改',
  booking_daily_update: '今日动态',
  booking_stay_report: '住宿报告',
  booking_arrival_note: '已安顿',
  booking_cancelled_by_parent: '已取消',
  booking_picked_up: '已离店',
  booking_late_pickup_charged: '延迟离店费用已扣',
};

const GENERAL_IN_CHINESE: Record<ParentNotificationKind, string> = {
  booking_request_received: '我们收到了你的预约申请。',
  booking_approved: '你的一次住宿已确认。',
  booking_refused: '很抱歉，你的一次住宿申请没有被接受。',
  booking_back_in_review: '你的一次住宿又在等待经理审核。',
  // The in-stay changes, the daily update and the stay report are never read back (the server
  // keeps no facts for them), so each gets its line here and the page where the detail is.
  booking_extended: '你延长了一次住宿，新的日期和费用已经记下。',
  booking_picked_up_early: '你把离店时间提前了，退款会原路退回。',
  booking_add_on_booked: '你为宠物预订了一项附加服务。',
  booking_times_changed: '你更改了入住或离店时间。',
  booking_daily_update: '今天的动态已经发出，请到“照顾动态”查看。',
  booking_stay_report: '这次住宿的报告已经发出，请到“照顾动态”查看。',
  booking_arrival_note: '你的宠物已经到店，正在安顿。',
  booking_cancelled_by_parent: '你取消了一次住宿，收据已发到你的邮箱。',
  booking_picked_up: '你的宠物已经离店。',
  booking_late_pickup_charged: '离店时间晚于截止时间，已按约定扣了一晚的费用。',
};

/**
 * The notices the server writes in the parent's chosen language instead of always in English. A
 * Chinese parent's body is already Chinese and is shown as written; an English body (sent before
 * the parent chose, or to a parent who chose English) still gets the general line.
 */
const WRITTEN_IN_PARENTS_LANGUAGE: ReadonlySet<ParentNotificationKind> =
  new Set<ParentNotificationKind>([
    'booking_daily_update',
    'booking_stay_report',
    'booking_arrival_note',
  ]);

const HAS_CHINESE_CHARACTERS = /[一-鿿]/;

const isWrittenInChinese = (notification: ParentNotification): boolean =>
  WRITTEN_IN_PARENTS_LANGUAGE.has(notification.kind) &&
  HAS_CHINESE_CHARACTERS.test(notification.body);

const REASONS_IN_CHINESE: Record<NoticeReviewReason, string> = {
  medication: '要用药',
  behaviour_or_health: '有行为或健康方面的情况要确认',
  first_stay: '第一次来住',
  long_stay: '住的时间比较长',
  other: '有情况要确认',
};

const SEE_MY_STAYS = '详情请查看“我的住宿”。';
const BOARDING_PASS = '住宿凭证在“我的住宿”里。';

const dayParts = (iso: string): [number, number, number] => {
  const [year = 0, month = 0, day = 0] = iso.split('-').map(Number);
  return [year, month, day];
};

/** "2026年10月12日至15日", "2026年9月28日至10月2日", "2026年12月30日至2027年1月2日". */
export const chineseStayDates = ({ start, end }: NoticeStayDates): string => {
  const [startYear, startMonth, startDay] = dayParts(start);
  const [endYear, endMonth, endDay] = dayParts(end);
  const from = `${startYear}年${startMonth}月${startDay}日`;
  if (endYear !== startYear) return `${from}至${endYear}年${endMonth}月${endDay}日`;
  if (endMonth !== startMonth) return `${from}至${endMonth}月${endDay}日`;
  return `${from}至${endDay}日`;
};

const pets = (names: string[]): string =>
  names.length > 0 ? listOfNames(names, 'zh') : '你的宠物';

/** "（2026年10月12日至15日）", or nothing when the stay had no dates. */
const inBrackets = (dates: NoticeStayDates | null): string =>
  dates ? `（${chineseStayDates(dates)}）` : '';

const reasonSentence = (reason: string | null): string => {
  if (reason === null) return SEE_MY_STAYS;
  const translated = refusalReasonIn(reason, 'zh');
  return translated ? `原因：${translated}` : `原因是用英文写的，${SEE_MY_STAYS}`;
};

const chineseBody = (notification: ParentNotification): string => {
  if (isWrittenInChinese(notification)) return notification.body;
  const { facts } = notification;
  if (!facts) return `${GENERAL_IN_CHINESE[notification.kind]}${SEE_MY_STAYS}`;
  switch (facts.template) {
    case 'confirmed':
      return `你的预约 ${facts.reference}（${pets(facts.pets)}${facts.dates ? `，${chineseStayDates(facts.dates)}` : ''}）已确认。${BOARDING_PASS}`;
    case 'received': {
      const confirmed = facts.confirmed.length > 0 ? `${pets(facts.confirmed)} 已确认。` : '';
      const waiting =
        facts.waiting.length > 0
          ? `经理会先查看${listOfNames(
              facts.waiting.map(({ name, reasons }) =>
                reasons.length > 0
                  ? `${name}（${reasons.map((reason) => REASONS_IN_CHINESE[reason]).join('、')}）`
                  : name,
              ),
              'zh',
            )}，然后再确认。`
          : '';
      return `我们收到了你的申请 ${facts.reference}${inBrackets(facts.dates)}。${confirmed}${waiting}${SEE_MY_STAYS}`;
    }
    case 'approved':
      return `${pets(facts.pets)} 的住宿${inBrackets(facts.dates)}已确认。${BOARDING_PASS}`;
    case 'refused':
      return `很抱歉，我们无法接收 ${pets(facts.pets)}${inBrackets(facts.dates)}。${reasonSentence(facts.reason)}`;
    case 'reopened':
      return `经理重新打开了 ${pets(facts.pets)} 的申请${inBrackets(facts.dates)}，现在又在等待审核。`;
    case 'moved':
      return `你把 ${pets(facts.pets)} 的住宿改到了${facts.dates ? ` ${chineseStayDates(facts.dates)}` : '新的日期'}。经理会审核新的日期。`;
  }
};

/** A notice's title and body in the reader's language. */
export const noticeWords = (
  notification: ParentNotification,
  locale: PortalLocale,
): { title: string; body: string } =>
  locale === 'en'
    ? { title: notification.title, body: notification.body }
    : { title: TITLES_IN_CHINESE[notification.kind], body: chineseBody(notification) };
