import type { PortalCopy } from '../../i18n/portalLocale';

/** The words My stays, a stay card, the booking details and the boarding pass write themselves.
 * Pet names, service names and the manager's refusal reason come from the server as written. */
export interface StaysCopy {
  shared: {
    close: string;
    /** "3 nights" */
    nights: (count: number) => string;
    reference: string;
    status: string;
    pet: string;
    dropOff: string;
    pickUp: string;
    total: string;
    /** A service line at $0, which is part of the package. */
    included: string;
  };
  page: {
    title: string;
    lead: string;
    loading: string;
    loadError: string;
    tryAgain: string;
    emptyUpcoming: string;
    emptyPast: string;
    bookAStay: string;
  };
  tabs: {
    listLabel: string;
    upcoming: (count: number) => string;
    past: string;
  };
  card: {
    liveCareWhenArrives: (petName: string) => string;
    liveCareWhenApproved: (petName: string) => string;
    /** The refusal, said by the manager who made it when their name is known. */
    managerSaid: (reason: string, reviewerName: string | null) => string;
    /** Who confirmed the stay: the manager is the parent's contact for it. */
    confirmedBy: (reviewerName: string) => string;
    bookingDetails: string;
    viewLiveCare: string;
    changeDates: string;
    withdrawRequest: string;
    cancelStay: string;
  };
  payment: {
    refused: (petName: string) => string;
    cancelledWithFee: (amount: string) => string;
    cancelledFree: string;
    finalCharge: (amount: string) => string;
    nothingCharged: string;
    savedWhileReviewed: string;
    /** Paid at request: the price is held while our manager checks. */
    heldWhileReviewed: (amount: string) => string;
    /** Paid at request: charged once confirmed; anything not owed is refunded. */
    paid: (amount: string) => string;
    refunded: string;
    held: (amount: string) => string;
    /** Paid at request: a confirmed pet waits while another pet on the booking is decided. */
    heldUntilDecided: (amount: string) => string;
    holdFailed: string;
    notHeldYet: string;
    testMode: string;
  };
  details: {
    title: string;
    managerSaid: string;
    reviewedBy: string;
    requestedOn: string;
    getReadyTitle: string;
    careTitle: string;
    blankCareField: string;
    notSpecified: string;
    yes: string;
    no: string;
    feedingRoutine: string;
    medication: string;
    firstTimeBoarding: string;
    crateTrained: string;
    socialize: string;
    fullyVaccinated: string;
    behaviourAndHealth: string;
    otherNotes: string;
  };
  boardingPass: {
    title: string;
    dates: string;
    services: string;
  };
  checklist: {
    title: string;
    vaccination: string;
    vetConsent: string;
  };
}

export const STAYS_COPY: PortalCopy<StaysCopy> = {
  en: {
    shared: {
      close: 'Close',
      nights: (count) => `${count} ${count === 1 ? 'night' : 'nights'}`,
      reference: 'Reference',
      status: 'Status',
      pet: 'Pet',
      dropOff: 'Check-in',
      pickUp: 'Check-out',
      total: 'Total',
      included: 'Included',
    },
    page: {
      title: 'My stays',
      lead: 'See every stay, follow live care and check your booking details.',
      loading: 'Loading your stays…',
      loadError: 'We could not load your stays.',
      tryAgain: 'Try again',
      emptyUpcoming: 'You have no upcoming stays yet.',
      emptyPast: 'No past stays yet.',
      bookAStay: 'Book a stay',
    },
    tabs: {
      listLabel: 'Stays',
      upcoming: (count) => `Upcoming (${count})`,
      past: 'Past',
    },
    card: {
      liveCareWhenArrives: (petName) => `Live care opens when ${petName} arrives for the stay.`,
      liveCareWhenApproved: (petName) =>
        `Live care opens once our manager approves the stay and ${petName} arrives.`,
      managerSaid: (reason, reviewerName) =>
        reviewerName
          ? `${reviewerName}, our manager, said: ${reason}`
          : `Our manager said: ${reason}`,
      confirmedBy: (reviewerName) =>
        `Confirmed by ${reviewerName}, our manager and your contact for this stay.`,
      bookingDetails: 'Booking details',
      viewLiveCare: 'View live care',
      changeDates: 'Change dates',
      withdrawRequest: 'Withdraw request',
      cancelStay: 'Cancel stay',
    },
    payment: {
      refused: (petName) => `We couldn't take ${petName} on these dates.`,
      cancelledWithFee: (amount) => `Cancelled. A late fee of ${amount} was charged.`,
      cancelledFree: 'Cancelled. Nothing was charged.',
      finalCharge: (amount) => `Final charge: ${amount}.`,
      nothingCharged: 'Nothing was charged.',
      savedWhileReviewed:
        'Your card is saved. Nothing is held or charged while our manager reviews the request.',
      heldWhileReviewed: (amount) =>
        `${amount} is held on your card while our manager checks. It is charged once confirmed, or released.`,
      paid: (amount) =>
        `Paid ${amount}. Anything you don't owe after check-in goes back to your card.`,
      refunded: 'Refunded in full.',
      held: (amount) => `${amount} is held on your card. It is charged when you check in.`,
      heldUntilDecided: (amount) =>
        `${amount} is held on your card. We charge the confirmed pets once our manager has decided on every pet in this booking.`,
      holdFailed: "We couldn't hold your card. Please contact our team before check-in.",
      notHeldYet:
        'Nothing is charged yet. We hold the price of the approved stay on your card 48 hours before check-in.',
      testMode: 'Test: no real money moves.',
    },
    details: {
      title: 'Booking details',
      managerSaid: 'Our manager said',
      reviewedBy: 'Your contact',
      requestedOn: 'Requested on',
      getReadyTitle: 'Get ready for check-in',
      careTitle: 'Care information',
      blankCareField: 'None',
      notSpecified: 'Not specified',
      yes: 'Yes',
      no: 'No',
      feedingRoutine: 'Feeding routine',
      medication: 'Medication instructions',
      firstTimeBoarding: 'First-time boarding',
      crateTrained: 'Crate trained',
      socialize: 'OK to socialize',
      fullyVaccinated: 'Fully vaccinated',
      behaviourAndHealth: 'Behaviour & health notes',
      otherNotes: 'Other notes',
    },
    boardingPass: {
      title: 'Boarding pass',
      dates: 'Dates',
      services: 'Services',
    },
    checklist: {
      title: 'Bring on check-in day',
      vaccination: "Your pet's current vaccination certificate (C5 for dogs, F3 for cats).",
      vetConsent:
        'Our team checks your recorded emergency vet consent; older bookings may need a signature.',
    },
  },
  zh: {
    shared: {
      close: '关闭',
      nights: (count) => `${count} 晚`,
      reference: '预约编号',
      status: '状态',
      pet: '宠物',
      dropOff: '入住',
      pickUp: '离店',
      total: '总价',
      included: '已包含',
    },
    page: {
      title: '我的住宿',
      lead: '查看每一次住宿，关注实时照护，核对预约详情。',
      loading: '正在加载你的住宿…',
      loadError: '没能加载你的住宿。',
      tryAgain: '重试',
      emptyUpcoming: '你还没有即将开始的住宿。',
      emptyPast: '还没有以往的住宿。',
      bookAStay: '预订住宿',
    },
    tabs: {
      listLabel: '住宿',
      upcoming: (count) => `即将开始（${count}）`,
      past: '以往',
    },
    card: {
      liveCareWhenArrives: (petName) => `${petName} 到店入住后，就可以查看实时照护。`,
      liveCareWhenApproved: (petName) =>
        `经理批准住宿、${petName} 到店入住后，就可以查看实时照护。`,
      managerSaid: (reason, reviewerName) =>
        reviewerName ? `经理 ${reviewerName} 的回复：${reason}` : `经理的回复：${reason}`,
      confirmedBy: (reviewerName) =>
        `由经理 ${reviewerName} 确认，${reviewerName} 是这次住宿的负责人。`,
      bookingDetails: '预约详情',
      viewLiveCare: '查看实时照护',
      changeDates: '改期',
      withdrawRequest: '撤回申请',
      cancelStay: '取消住宿',
    },
    payment: {
      refused: (petName) => `很抱歉，这些日期我们无法接收 ${petName}。`,
      cancelledWithFee: (amount) => `已取消。已收取逾期取消费 ${amount}。`,
      cancelledFree: '已取消，没有收取任何费用。',
      finalCharge: (amount) => `最终扣款：${amount}。`,
      nothingCharged: '没有收取任何费用。',
      savedWhileReviewed: '你的银行卡已保存。经理审核申请期间，不会冻结或扣任何费用。',
      heldWhileReviewed: (amount) =>
        `经理审核期间，你的卡上冻结了 ${amount}。确认后扣款，否则解除冻结。`,
      paid: (amount) => `已付 ${amount}。入住之后不需要支付的部分，会退回你的卡。`,
      refunded: '已全额退款。',
      held: (amount) => `你的卡上已冻结 ${amount}，办理入住时扣款。`,
      heldUntilDecided: (amount) =>
        `你的卡上已冻结 ${amount}。经理审核完这份预约里的每只宠物后，我们才会为已确认的宠物扣款。`,
      holdFailed: '我们没能在你的卡上冻结款项。请在入住之前联系我们的工作人员。',
      notHeldYet: '目前还没有扣任何费用。入住前 48 小时，我们会在你的卡上冻结已确认住宿的费用。',
      testMode: '测试：不会真正扣款。',
    },
    details: {
      title: '预约详情',
      managerSaid: '经理的回复',
      reviewedBy: '负责经理',
      requestedOn: '申请时间',
      getReadyTitle: '入住之前的准备',
      careTitle: '照护信息',
      blankCareField: '无',
      notSpecified: '未填写',
      yes: '是',
      no: '否',
      feedingRoutine: '喂食习惯',
      medication: '用药说明',
      firstTimeBoarding: '第一次寄养',
      crateTrained: '接受过笼训',
      socialize: '可以和其他宠物一起玩',
      fullyVaccinated: '疫苗已打全',
      behaviourAndHealth: '行为和健康备注',
      otherNotes: '其他备注',
    },
    boardingPass: {
      title: '住宿凭证',
      dates: '日期',
      services: '服务',
    },
    checklist: {
      title: '入住当天请带上',
      vaccination: '宠物当前有效的疫苗证书（狗狗 C5，猫咪 F3）。',
      vetConsent: '工作人员会核对你已记录的紧急就医同意；旧版预约可能需要签字。',
    },
  },
};
