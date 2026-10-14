import type { PortalCopy } from '../../i18n/portalLocale';

/**
 * What the in-stay dialogs (extend, add-on, change times), the links that open them and the notice
 * after each tell a parent. Every button is named by its result, and the line next to a price says
 * how it is paid: on the saved card now, or, on a booking without a saved card, added to the bill
 * and paid at the desk at check-out. The Chinese says exactly what the English says. Money, dates
 * and times arrive already formatted; pet and service names come from the server.
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
    extended: (newDay: string, amount: string) => string;
    extendedToBill: (newDay: string, amount: string) => string;
    addOnBooked: (quantity: number, serviceName: string, day: string, amount: string) => string;
    addOnToBill: (quantity: number, serviceName: string, day: string, amount: string) => string;
    timesChanged: (checkIn: string, checkOut: string) => string;
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
      addedToBill: 'This will be added to your bill. You pay it at the desk when you check out.',
    },
    extend: {
      title: 'Extend the stay',
      intro: (petNames, currentCheckOut) =>
        `Add nights for ${petNames}, at the prices you booked. Check-out is now ${currentCheckOut}.`,
      newCheckOut: 'New check-out date',
      longest: (days) => `You can add up to ${days} days.`,
      check: 'Check the price',
      checkFailed: "We couldn't check that date. Please try again.",
      extendFailed: 'Your stay was not extended. Please try again.',
      summary: (newDay, nights, amount) =>
        `Check-out moves to ${newDay}, ${nights} more. The added nights cost ${amount}.`,
      petLine: (petName, nights, rate, amount) => `${petName}: ${nights} at ${rate} = ${amount}`,
      confirm: (amount) => `Extend and pay ${amount}`,
      confirmToBill: (amount) => `Extend and add ${amount} to my bill`,
    },
    addOn: {
      title: 'Add a walk or playtime',
      intro: (petName) =>
        `Add a service for ${petName} on a day of the stay. Our team adds it to their care plan.`,
      loading: 'Loading what we offer…',
      loadFailed: "We couldn't load the services. Please try again.",
      addFailed: 'Nothing was added. Please try again.',
      noOffers: 'There is nothing to add for this stay.',
      offer: 'Service',
      day: 'Day',
      quantity: 'How many',
      unit: (priceUnit) => {
        if (priceUnit === 'per day') return 'per day';
        if (priceUnit === 'per stay') return 'per stay';
        return priceUnit;
      },
      confirm: (quantity, serviceName, amount) => `Add ${quantity} ${serviceName} for ${amount}`,
    },
    times: {
      title: 'Change time',
      intro: (petName) =>
        `Choose a new check-in or check-out time for ${petName} on the same days.`,
      checkInTime: 'Check-in time',
      checkOutTime: 'Check-out time',
      noCharge: 'The days stay the same, so the price does not change.',
      changeFailed: 'The time was not changed. Please try again.',
      confirm: 'Change time',
    },
    notice: {
      extended: (newDay, amount) =>
        `Extended to ${newDay}. ${amount} was charged to your saved card.`,
      extendedToBill: (newDay, amount) =>
        `Extended to ${newDay}. ${amount} was added to your bill. You pay it at the desk when you check out.`,
      addOnBooked: (quantity, serviceName, day, amount) =>
        `Added ${quantity} ${serviceName} on ${day}. ${amount} was charged to your saved card.`,
      addOnToBill: (quantity, serviceName, day, amount) =>
        `Added ${quantity} ${serviceName} on ${day}. ${amount} was added to your bill. You pay it at the desk when you check out.`,
      timesChanged: (checkIn, checkOut) =>
        `Times changed. Check-in ${checkIn}, check-out ${checkOut}. Nothing was charged.`,
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
      addedToBill: '这笔费用会记入账单，离店时在前台支付。',
    },
    extend: {
      title: '延长住宿',
      intro: (petNames, currentCheckOut) =>
        `按你预订时的价格，为 ${petNames} 增加住宿晚数。目前的离店时间是 ${currentCheckOut}。`,
      newCheckOut: '新的离店日期',
      longest: (days) => `最多可以延长 ${days} 天。`,
      check: '查询价格',
      checkFailed: '没能查询这个日期，请重试。',
      extendFailed: '你的住宿没有延长，请重试。',
      summary: (newDay, nights, amount) =>
        `离店日期改为 ${newDay}，增加 ${nights}。新增晚数的费用是 ${amount}。`,
      petLine: (petName, nights, rate, amount) =>
        `${petName}：${nights}，每晚 ${rate}，共 ${amount}`,
      confirm: (amount) => `延住并支付 ${amount}`,
      confirmToBill: (amount) => `延住，${amount} 记入账单`,
    },
    addOn: {
      title: '加一次散步或玩耍',
      intro: (petName) =>
        `为 ${petName} 在住宿期间的某一天增加一项服务。我们的团队会把它加入照护计划。`,
      loading: '正在加载可选服务…',
      loadFailed: '没能加载服务，请重试。',
      addFailed: '没有添加任何服务，请重试。',
      noOffers: '这次住宿没有可以添加的服务。',
      offer: '服务',
      day: '日期',
      quantity: '数量',
      unit: (priceUnit) => {
        if (priceUnit === 'per day') return '每天';
        if (priceUnit === 'per stay') return '每次住宿';
        return priceUnit;
      },
      confirm: (quantity, serviceName, amount) =>
        `添加 ${quantity} 次 ${serviceName}，费用 ${amount}`,
    },
    times: {
      title: '更改时间',
      intro: (petName) => `在原来的日期内，为 ${petName} 选择新的入住或离店时间。`,
      checkInTime: '入住时间',
      checkOutTime: '离店时间',
      noCharge: '日期不变，所以价格不变。',
      changeFailed: '时间没有更改，请重试。',
      confirm: '更改时间',
    },
    notice: {
      extended: (newDay, amount) => `已延长到 ${newDay}。已从你保存的卡上扣除 ${amount}。`,
      extendedToBill: (newDay, amount) =>
        `已延长到 ${newDay}。${amount} 已记入账单，离店时在前台支付。`,
      addOnBooked: (quantity, serviceName, day, amount) =>
        `已添加 ${day} 的 ${quantity} 次 ${serviceName}。已从你保存的卡上扣除 ${amount}。`,
      addOnToBill: (quantity, serviceName, day, amount) =>
        `已添加 ${day} 的 ${quantity} 次 ${serviceName}。${amount} 已记入账单，离店时在前台支付。`,
      timesChanged: (checkIn, checkOut) =>
        `时间已更改。入住 ${checkIn}，离店 ${checkOut}。没有收取任何费用。`,
    },
  },
};
