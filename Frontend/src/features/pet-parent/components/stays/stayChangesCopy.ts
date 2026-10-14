import { MAX_ONLINE_NIGHTS } from '../../../concierge/utils/format';
import type { PortalCopy } from '../../i18n/portalLocale';

/**
 * What the cancel and change-dates dialogs, and the notice after either, tell a guest. These lines
 * restate the booking terms (fees, holds, the one free change), so the Chinese says exactly what
 * the English says: no rule is softened or added. Money and dates arrive already formatted.
 */

/**
 * A refusal's words by the server's error code. English is left empty because the server's own
 * words are written for parents and pass through as sent (see `requestErrorText`); Chinese says
 * the same thing in its own words.
 */
type RefusalWords = Readonly<Partial<Record<string, string>>>;

export interface StayChangesCopy {
  cancel: {
    title: string;
    intro: (petNames: string, dropOffDay: string) => string;
    working: string;
    costFailed: string;
    cancelFailed: string;
    refusals: RefusalWords;
    /** `halfStay`: the short-notice fee, half of each stay; otherwise one night per pet. */
    costWithFee: (fee: string, halfStay: boolean) => string;
    /** Paid at request: the fee is kept and the rest of the payment refunded. */
    costWithFeePaid: (fee: string) => string;
    freePaid: string;
    freeApprovalGrace: string;
    freePendingRequest: string;
    freeApprovalTimeUnknown: string;
    freeCoolingOff: string;
    freeEarly: string;
    teamContact: string;
    keepStay: string;
    confirmWithFee: (fee: string) => string;
    confirmFree: string;
    /** The fee moved while the dialog was open; nothing was charged, the new fee is shown. */
    feeChanged: string;
  };
  move: {
    title: string;
    /** `onlyOnce`: an older booking with its one free change; current terms set no limit. */
    intro: (petNames: string, onlyOnce: boolean) => string;
    newDropOff: string;
    newPickUp: string;
    fullyBooked: (days: string, dayCount: number) => string;
    checkFailed: string;
    refusals: RefusalWords;
    summary: (start: string, end: string, nights: string, total: string) => string;
    /** Ends with whatever space the language needs before the hold line that follows it. */
    usesFreeChange: string;
    holdReleased: string;
    /** Paid at request: what happens to the money when the dates change. */
    paidChange: string;
    keepDates: string;
    confirm: string;
    check: string;
    /** The total moved while the dialog was open; nothing changed, the dates are priced again. */
    priceChanged: string;
    /** Under the pick-up field: the longest stay that can be priced. */
    longestStay: (nights: number) => string;
  };
  notice: {
    cancelledWithFee: (fee: string) => string;
    cancelledFree: string;
    moved: (startDay: string, total: string) => string;
    movedPaid: (startDay: string, total: string) => string;
    cancelledPaid: (fee: string | null) => string;
  };
}

export const STAY_CHANGES_COPY: PortalCopy<StayChangesCopy> = {
  en: {
    cancel: {
      title: 'Cancel this stay?',
      intro: (petNames, dropOffDay) =>
        `This cancels the stay for ${petNames}, check-in ${dropOffDay}.`,
      working: 'Working out what cancelling costs…',
      costFailed: "We couldn't work out the cost. Please try again.",
      cancelFailed: 'Your stay was not cancelled. Please try again.',
      refusals: {},
      costWithFee: (fee, halfStay) =>
        `Cancelling now costs ${fee}, ${halfStay ? 'half of each confirmed pet’s stay' : 'one night for each confirmed pet'}. It is taken from your card, and the rest is released.`,
      costWithFeePaid: (fee) =>
        `Cancelling now costs ${fee} under the cancellation rules you agreed to. We refund the rest of what you paid to your card.`,
      freePaid: 'Cancelling now is free. Everything you paid goes back to your card.',
      freeApprovalGrace: 'Cancelling is free within two hours of confirmation. Nothing is charged.',
      freePendingRequest:
        'Our manager hasn’t approved this request yet, so withdrawing it is free. Nothing is charged.',
      freeApprovalTimeUnknown: 'No cancellation fee is due for this stay. Nothing is charged.',
      freeCoolingOff:
        'Cancelling is free, within the cooling-off period after confirmation. Nothing is charged.',
      freeEarly: 'Cancelling now is free. Nothing is charged.',
      teamContact:
        'For an emergency or a sick pet, contact our team instead: we can cancel without a fee.',
      keepStay: 'Keep my stay',
      confirmWithFee: (fee) => `Cancel and pay ${fee}`,
      confirmFree: 'Cancel stay',
      feeChanged:
        'The fee changed while this was open, so nothing was charged. Here is the fee now; please check it and confirm again.',
    },
    move: {
      title: 'Change the dates',
      intro: (petNames, onlyOnce) =>
        onlyOnce
          ? `Move the stay for ${petNames} to new dates. You can do this once, at the prices you booked, if there is room.`
          : `Move the stay for ${petNames} to new dates, at the prices you booked, if there is room. You can do this as often as you need before check-in.`,
      newDropOff: 'New check-in date',
      newPickUp: 'New check-out date',
      fullyBooked: (days, dayCount) =>
        `Sorry, ${days} ${dayCount === 1 ? 'is' : 'are'} fully booked. Please choose other dates.`,
      checkFailed: "We couldn't check those dates. Please try again.",
      refusals: {},
      summary: (start, end, nights, total) => `${start} to ${end}, ${nights}. New total: ${total}.`,
      usesFreeChange: 'This uses your one free change. ',
      holdReleased:
        'The old hold is released. Your new dates return to manager review; nothing is held until approved again.',
      paidChange:
        'We hold the new price on your card first, then release or refund the old payment. Confirmed pets stay confirmed.',
      keepDates: 'Keep my dates',
      confirm: 'Change dates',
      check: 'Check the new dates',
      priceChanged:
        'The price changed while this was open, so your dates did not change. Please check the new dates again.',
      longestStay: (nights) => `A stay can be up to ${nights} nights.`,
    },
    notice: {
      cancelledWithFee: (fee) =>
        `Your stay is cancelled. A late fee of ${fee} was charged, and the rest of the hold released.`,
      cancelledFree: 'Cancelled. Nothing was charged.',
      moved: (startDay, total) =>
        `Your new dates start ${startDay} and are waiting for manager approval. The new total is ${total}.`,
      movedPaid: (startDay, total) =>
        `Your new dates start ${startDay}. The new total is ${total}, and your old payment is released or refunded.`,
      cancelledPaid: (fee) =>
        fee
          ? `Your stay is cancelled. We kept ${fee} and refund the rest to your card.`
          : 'Your stay is cancelled. Everything you paid goes back to your card.',
    },
  },
  zh: {
    cancel: {
      title: '取消这次住宿？',
      intro: (petNames, dropOffDay) => `这会取消 ${petNames} 的住宿，入住日期是 ${dropOffDay}。`,
      working: '正在计算取消的费用…',
      costFailed: '没能算出取消的费用，请重试。',
      cancelFailed: '你的住宿没有取消，请重试。',
      refusals: {
        BOOKING_STARTED: '这次住宿已经开始，无法在线更改，请联系我们的工作人员。',
        BOOKING_NOT_ACTIVE: '这次住宿已经取消了。',
        CARD_DECLINED: '你的卡无法支付取消费，所以住宿没有取消。请联系我们的工作人员。',
      },
      costWithFee: (fee, halfStay) =>
        `现在取消需要支付 ${fee}，也就是${halfStay ? '每只已确认宠物住宿费用的一半' : '每只已确认宠物一晚的费用'}。这笔费用从你的卡上扣除，其余冻结会解除。`,
      costWithFeePaid: (fee) =>
        `按你同意的取消规则，现在取消需要支付 ${fee}。你已付款项的其余部分会退回你的卡。`,
      freePaid: '现在取消免费，你已付的全部款项都会退回你的卡。',
      freeApprovalGrace: '确认后两小时内取消免费，不会扣任何费用。',
      freePendingRequest: '经理还没有批准这份申请，所以撤回是免费的，不会扣任何费用。',
      freeApprovalTimeUnknown: '这次住宿不需要支付取消费，不会扣任何费用。',
      freeCoolingOff: '现在还在确认后的冷静期内，取消免费，不会扣任何费用。',
      freeEarly: '现在取消免费，不会扣任何费用。',
      teamContact: '遇到紧急情况或宠物生病，请改为联系我们的工作人员：我们可以免费为你取消。',
      keepStay: '保留住宿',
      confirmWithFee: (fee) => `取消并支付 ${fee}`,
      confirmFree: '取消住宿',
      feeChanged: '在你查看期间费用发生了变化，所以没有扣款。下面是现在的费用，请核对后再次确认。',
    },
    move: {
      title: '更改住宿日期',
      intro: (petNames, onlyOnce) =>
        onlyOnce
          ? `把 ${petNames} 的住宿改到新的日期。如果有空位，你可以按预订时的价格改期一次。`
          : `把 ${petNames} 的住宿改到新的日期。如果有空位，按预订时的价格改期；入住之前可以随时改，次数不限。`,
      newDropOff: '新的入住日期',
      newPickUp: '新的离店日期',
      fullyBooked: (days) => `抱歉，${days} 已经住满了，请选择其他日期。`,
      checkFailed: '没能查询这些日期，请重试。',
      refusals: {
        BOOKING_STARTED: '这次住宿已经开始，无法在线更改，请联系我们的工作人员。',
        BOOKING_NOT_ACTIVE: '这次住宿已经取消了。',
        RESCHEDULE_USED: '这次住宿的日期已经改过一次了。如需再次更改，请联系我们的工作人员。',
        RESCHEDULE_TOO_FAR: '请选择未来 12 个月内的入住日期。',
        RESCHEDULE_DATES_INVALID: `请选择今天或之后的入住日期，离店日期要晚于入住日期，最多住 ${MAX_ONLINE_NIGHTS} 晚。`,
        CARD_DECLINED: '你的卡无法支付新的价格，所以日期没有更改。请联系我们的工作人员。',
        BOOKING_CARD_FAILED:
          '我们没能为这次住宿冻结你的卡，所以无法在线更改日期。请联系我们的工作人员。',
      },
      summary: (start, end, nights, total) =>
        `${start} 至 ${end}，共 ${nights}。新的总价：${total}。`,
      usesFreeChange: '这次会用掉你唯一一次免费改期。',
      holdReleased: '原来的冻结会解除。新的日期需要经理重新审核，再次批准之前不会冻结任何费用。',
      paidChange:
        '我们先在你的卡上冻结新的价格，再解除冻结或退回原来的付款。已确认的宠物仍然是已确认。',
      keepDates: '保留原日期',
      confirm: '确认改期',
      check: '查询新日期',
      priceChanged: '在你查看期间价格发生了变化，所以日期没有更改。请重新查询新日期。',
      longestStay: (nights) => `一次住宿最多 ${nights} 晚。`,
    },
    notice: {
      cancelledWithFee: (fee) => `你的住宿已取消。已收取逾期取消费 ${fee}，其余冻结已解除。`,
      cancelledFree: '已取消，没有收取任何费用。',
      moved: (startDay, total) =>
        `你的新日期从 ${startDay} 开始，正在等待经理批准。新的总价是 ${total}。`,
      movedPaid: (startDay, total) =>
        `你的新日期从 ${startDay} 开始。新的总价是 ${total}，原来的付款会解除冻结或退回。`,
      cancelledPaid: (fee) =>
        fee
          ? `你的住宿已取消。我们收取了 ${fee}，其余退回你的卡。`
          : '你的住宿已取消。你已付的全部款项都会退回你的卡。',
    },
  },
};
