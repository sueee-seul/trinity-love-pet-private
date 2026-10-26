import type { PortalCopy } from '../../i18n/portalLocale';

/**
 * What the in-stay dialogs (extend, add-on, change times), the links that open them, the notice
 * after each and the list of change requests tell a parent. Since 2026-10-14 each change is a
 * request our manager approves or refuses; nothing is paid online, and an approved amount is added
 * to the bill paid at the desk at check-out. The Chinese says exactly what the English says. Money,
 * dates and times arrive already formatted; pet and service names come from the server.
 */
export interface InStayChangesCopy {
  links: {
    extend: string;
    addOn: string;
    changeTimes: string;
  };
  /** The strip on the chat page that leads to the in-stay dialogs on My stays. */
  quickActions: {
    label: string;
    lead: (petName: string) => string;
    /** What tapping an action says in the chat, so the assistant prices the change there. */
    asks: {
      extend: (petName: string) => string;
      addOn: (petName: string) => string;
    };
    /** The same changes as dialogs on My stays, for a parent who prefers them. */
    openMyStays: string;
  };
  shared: {
    keep: string;
    /** The amount moved while the dialog was open; nothing was charged, the new amount is shown. */
    amountChanged: string;
    chargedNow: string;
    /** A booking without a saved card: the amount is owed and paid at the desk at check-out. */
    addedToBill: string;
  };
  extend: {
    title: string;
    intro: (petNames: string, currentCheckOut: string) => string;
    newCheckOut: string;
    longest: (days: number) => string;
    check: string;
    checkFailed: string;
    extendFailed: string;
    summary: (newDay: string, nights: string, amount: string) => string;
    petLine: (petName: string, nights: string, rate: string, amount: string) => string;
    confirm: (amount: string) => string;
    confirmToBill: (amount: string) => string;
  };
  addOn: {
    title: string;
    intro: (petName: string) => string;
    loading: string;
    loadFailed: string;
    addFailed: string;
    noOffers: string;
    offer: string;
    day: string;
    quantity: string;
    /** "per day" or "per stay" as the server names the unit, in this language. */
    unit: (priceUnit: string) => string;
    confirm: (quantity: number, serviceName: string, amount: string) => string;
  };
  times: {
    title: string;
    intro: (petName: string) => string;
    checkInTime: string;
    checkOutTime: string;
    noCharge: string;
    changeFailed: string;
    confirm: string;
  };
  notice: {
    /** After a request is sent: nothing changes until our manager approves it. */
    requested: string;
  };
  /** The parent's change requests and their answers, on My stays. */
  requests: {
    title: string;
    status: Record<'pending' | 'approved' | 'refused' | 'cancelled', string>;
    /** What was asked, in this language; money is already formatted. */
    extend: (day: string, amount: string | null) => string;
    addOn: (quantity: number, serviceName: string, day: string, amount: string | null) => string;
    times: (checkIn: string | null, checkOut: string | null) => string;
    earlyCheckOut: string;
    reason: (reason: string) => string;
    sentOn: (day: string) => string;
    withdraw: string;
    withdrawFailed: string;
  };
}

export const IN_STAY_CHANGES_COPY: PortalCopy<InStayChangesCopy> = {
  en: {
    links: {
      extend: 'Extend the stay',
      addOn: 'Add a walk or playtime',
      changeTimes: 'Change time',
    },
    quickActions: {
      label: 'Changes to the stay under way',
      lead: (petName) =>
        `${petName} is staying with us now. Ask here and I'll show the price before anything changes.`,
      asks: {
        extend: (petName) => `Can I extend ${petName}'s stay by one night?`,
        addOn: (petName) => `Can I add a walk for ${petName}?`,
      },
      openMyStays: 'Open My Stays',
    },
    shared: {
      keep: 'Keep as it is',
      amountChanged:
        'The amount changed while this was open, so nothing was charged. Here is the amount now; please check it and confirm again.',
      chargedNow: 'This is charged to your saved card now.',
      addedToBill:
        'This is a request for our manager. If approved, it is added to your bill, paid at the desk when you check out.',
    },
    extend: {
      title: 'Extend the stay',
      intro: (petNames, currentCheckOut) =>
        `Add nights for ${petNames}, at the prices you booked. Check-out is now ${currentCheckOut}.`,
      newCheckOut: 'New check-out date',
      longest: (days) => `You can add up to ${days} days.`,
      check: 'Check the price',
      checkFailed: "We couldn't check that date. Please try again.",
      extendFailed: 'Your request was not sent. Please try again.',
      summary: (newDay, nights, amount) =>
        `Check-out moves to ${newDay}, ${nights} more. The added nights cost ${amount}.`,
      petLine: (petName, nights, rate, amount) => `${petName}: ${nights} at ${rate} = ${amount}`,
      confirm: (amount) => `Send request (${amount})`,
      confirmToBill: (amount) => `Send request (${amount})`,
    },
    addOn: {
      title: 'Add a walk or playtime',
      intro: (petName) =>
        `Add a service for ${petName} on a day of the stay. Our team adds it to their care plan.`,
      loading: 'Loading what we offer…',
      loadFailed: "We couldn't load the services. Please try again.",
      addFailed: 'Your request was not sent. Please try again.',
      noOffers: 'There is nothing to add for this stay.',
      offer: 'Service',
      day: 'Day',
      quantity: 'How many',
      unit: (priceUnit) => {
        if (priceUnit === 'per day') return 'per day';
        if (priceUnit === 'per stay') return 'per stay';
        return priceUnit;
      },
      confirm: (quantity, serviceName, amount) => `Ask for ${quantity} ${serviceName} (${amount})`,
    },
    times: {
      title: 'Change time',
      intro: (petName) =>
        `Choose a new check-in or check-out time for ${petName} on the same days.`,
      checkInTime: 'Check-in time',
      checkOutTime: 'Check-out time',
      noCharge: 'The days stay the same, so the price does not change.',
      changeFailed: 'Your request was not sent. Please try again.',
      confirm: 'Ask to change the time',
    },
    notice: {
      requested:
        'Request sent. Our manager will check it, and you will hear the answer in your notifications and in the chat. Nothing changes until it is approved.',
    },
    requests: {
      title: 'Your change requests',
      status: {
        pending: 'Waiting for our manager',
        approved: 'Approved',
        refused: 'Not approved',
        cancelled: 'Withdrawn',
      },
      extend: (day, amount) => `Extend to ${day}${amount ? ` (${amount})` : ''}`,
      addOn: (quantity, serviceName, day, amount) =>
        `${quantity} ${serviceName} on ${day}${amount ? ` (${amount})` : ''}`,
      times: (checkIn, checkOut) =>
        `New time: ${[checkIn && `check-in ${checkIn}`, checkOut && `check-out ${checkOut}`]
          .filter(Boolean)
          .join(', ')}`,
      earlyCheckOut: 'Pick up early',
      reason: (reason) => `Reason: ${reason}`,
      sentOn: (day) => `Sent ${day}`,
      withdraw: 'Withdraw request',
      withdrawFailed: "We couldn't withdraw the request. Please try again.",
    },
  },
  zh: {
    links: {
      extend: '延长住宿',
      addOn: '加一次散步或玩耍',
      changeTimes: '更改时间',
    },
    quickActions: {
      label: '正在进行的住宿可做的更改',
      lead: (petName) =>
        `${petName} 正在我们这里住宿。在这里问我，我会先告诉你价格，确认后才会更改。`,
      asks: {
        extend: (petName) => `能不能让${petName}多住一晚？`,
        addOn: (petName) => `可以给${petName}加一次散步吗？`,
      },
      openMyStays: '打开我的住宿',
    },
    shared: {
      keep: '保持不变',
      amountChanged:
        '在你查看期间金额发生了变化，所以没有扣款。下面是现在的金额，请核对后再次确认。',
      chargedNow: '这笔费用现在从你保存的卡上扣除。',
      addedToBill: '这是发给经理的申请。批准后，这笔费用会记入账单，离店时在前台支付。',
    },
    extend: {
      title: '延长住宿',
      intro: (petNames, currentCheckOut) =>
        `按你预订时的价格，为 ${petNames} 增加住宿晚数。目前的离店时间是 ${currentCheckOut}。`,
      newCheckOut: '新的离店日期',
      longest: (days) => `最多可以延长 ${days} 天。`,
      check: '查询价格',
      checkFailed: '没能查询这个日期，请重试。',
      extendFailed: '申请没有发出，请重试。',
      summary: (newDay, nights, amount) =>
        `离店日期改为 ${newDay}，增加 ${nights}。新增晚数的费用是 ${amount}。`,
      petLine: (petName, nights, rate, amount) =>
        `${petName}：${nights}，每晚 ${rate}，共 ${amount}`,
      confirm: (amount) => `发送申请（${amount}）`,
      confirmToBill: (amount) => `发送申请（${amount}）`,
    },
    addOn: {
      title: '加一次散步或玩耍',
      intro: (petName) =>
        `为 ${petName} 在住宿期间的某一天增加一项服务。我们的团队会把它加入照护计划。`,
      loading: '正在加载可选服务…',
      loadFailed: '没能加载服务，请重试。',
      addFailed: '申请没有发出，请重试。',
      noOffers: '这次住宿没有可以添加的服务。',
      offer: '服务',
      day: '日期',
      quantity: '数量',
      unit: (priceUnit) => {
        if (priceUnit === 'per day') return '每天';
        if (priceUnit === 'per stay') return '每次住宿';
        return priceUnit;
      },
      confirm: (quantity, serviceName, amount) => `申请 ${quantity} 次 ${serviceName}（${amount}）`,
    },
    times: {
      title: '更改时间',
      intro: (petName) => `在原来的日期内，为 ${petName} 选择新的入住或离店时间。`,
      checkInTime: '入住时间',
      checkOutTime: '离店时间',
      noCharge: '日期不变，所以价格不变。',
      changeFailed: '申请没有发出，请重试。',
      confirm: '申请更改时间',
    },
    notice: {
      requested: '申请已发出。经理会审核，结果会通过通知和聊天告诉你。批准之前不会有任何更改。',
    },
    requests: {
      title: '你的更改申请',
      status: {
        pending: '等待经理审核',
        approved: '已批准',
        refused: '未批准',
        cancelled: '已撤回',
      },
      extend: (day, amount) => `延长到 ${day}${amount ? `（${amount}）` : ''}`,
      addOn: (quantity, serviceName, day, amount) =>
        `${day} 的 ${quantity} 次 ${serviceName}${amount ? `（${amount}）` : ''}`,
      times: (checkIn, checkOut) =>
        `新时间：${[checkIn && `入住 ${checkIn}`, checkOut && `离店 ${checkOut}`]
          .filter(Boolean)
          .join('，')}`,
      earlyCheckOut: '提前接走',
      reason: (reason) => `原因：${reason}`,
      sentOn: (day) => `${day} 提交`,
      withdraw: '撤回申请',
      withdrawFailed: '没能撤回申请，请重试。',
    },
  },
};
