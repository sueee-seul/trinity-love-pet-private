import type { BrandTheme, BrandThemeFamily } from '../../shared/theme';
import { THEME_COPY } from '../../shared/theme/themeCopy';
import type { ConciergeLocale } from '../concierge';

/**
 * Every word the public landing page shows, in English and Chinese.
 *
 * Each promise here is something the product does today, and docs/landing-page.md names the code
 * behind each one. Keep it that way: no reviews, ratings, visitor numbers, address, opening hours,
 * webcams or cancellation terms until the business has them (Fair Trading Act s12A/s13). Prices
 * are never written here; they come from the live price list.
 *
 * The booking tiers and the example care day are not repeated here. They come from the concierge
 * copy, so /book and this page always name them the same way.
 */

export interface LandingIconPoint {
  title: string;
  text: string;
}

export interface LandingFaq {
  question: string;
  answer: string;
}

export interface LandingCopy {
  documentTitle: string;
  skipLink: string;
  header: {
    homeLabel: string;
    navLabel: string;
    nav: { prices: string; howItWorks: string; care: string; faq: string };
    signIn: string;
    myPetCentre: string;
    planStay: string;
  };
  hero: {
    title: string;
    /** One word of the title that a theme may decorate. Must appear in the title exactly. */
    titleAccent: string;
    lead: string;
    planStay: string;
    seePrices: string;
    reassurance: string;
  };
  promises: { title: string; items: LandingIconPoint[] };
  howItWorks: { title: string; steps: LandingIconPoint[] };
  care: {
    title: string;
    lead: string;
    exampleLabel: string;
    /** Names the example clip for screen readers; it is AI-made, not a real pet. */
    exampleVideoLabel: string;
    /** Names what the clip shows: the play time entry of the example day. */
    exampleVideoTag: string;
    caption: string;
    openPetCentre: string;
  };
  pets: {
    title: string;
    dogs: LandingIconPoint;
    cats: LandingIconPoint;
    dogPhotoAlt: string;
    catPhotoAlt: string;
    limits: (pets: number, nights: number) => string;
  };
  safety: {
    title: string;
    lead: string;
    items: string[];
    close: string;
    photoAlt: string;
  };
  assistant: {
    title: string;
    lead: string;
    points: string[];
    cta: string;
    sampleLabel: string;
  };
  themes: {
    title: string;
    lead: string;
    legend: string;
    names: Record<BrandTheme, string>;
    families: Record<BrandThemeFamily, string>;
    tags: {
      /** On the look a visitor sees before choosing one (CUSTOMER_DEFAULT_BRAND_THEME). */
      defaultLook: string;
      /** On the themes built for low light (NIGHT_MODE_BRAND_THEMES). */
      nightMode: string;
    };
    helpLine: string;
  };
  /** The limits come from the booking rules, so the answers never drift from what /book allows. */
  faq: { title: string; items: (pets: number, nights: number) => LandingFaq[] };
  finalCta: { title: string; lead: string; planStay: string; talkToPerson: string };
  footer: {
    tagline: string;
    navLabel: string;
    planStay: string;
    prices: string;
    signIn: string;
    createAccount: string;
    myPetCentre: string;
    copyright: (year: number) => string;
  };
}

const EN: LandingCopy = {
  documentTitle: 'Wagstay | Boarding for dogs and cats',
  skipLink: 'Skip to main content',
  header: {
    homeLabel: 'Wagstay home',
    navLabel: 'On this page',
    nav: { prices: 'Prices', howItWorks: 'How it works', care: 'Care updates', faq: 'FAQ' },
    signIn: 'Sign in',
    myPetCentre: 'My pet centre',
    planStay: 'Plan a stay',
  },
  hero: {
    title: 'A happy stay for your dog or cat',
    titleAccent: 'happy',
    lead: 'Wagstay is a boarding hotel for dogs and cats. Tell our booking assistant what your pet needs, and see the full price before you book.',
    planStay: 'Plan a stay',
    seePrices: 'See prices',
    reassurance: 'No account needed to plan. You are only charged once we confirm your stay.',
  },
  promises: {
    title: 'What you can count on',
    items: [
      { title: 'One clear price', text: 'Room, food and GST are all in the total you see.' },
      { title: 'No booking fees', text: 'No booking fee and no card fee.' },
      {
        title: 'Confirmed when there is room',
        text: 'A stay is confirmed as soon as you send it, if there is room. If your pet takes medication, our manager checks the stay first.',
      },
      {
        title: 'Healthy guests only',
        text: 'We check each pet’s vaccination certificate at the desk on check-in day.',
      },
    ],
  },
  howItWorks: {
    title: 'How booking works',
    steps: [
      {
        title: 'Tell us about your pet',
        text: 'Type, speak or tap. Our AI asks only what it needs.',
      },
      {
        title: 'Take a combo',
        text: 'The AI suggests combos that fit. Change any line; the price updates live.',
      },
      {
        title: 'Book in one go',
        text: 'First time? No sign-up. Your account and pet profile are made when you pay.',
      },
      {
        title: 'Check in your pet',
        text: 'Bring the vaccination certificate. That is all.',
      },
    ],
  },
  care: {
    title: 'See how their day is going',
    lead: 'While your pet stays with us, our team records meals, walks, play and rest. You see each update in your Wagstay pet centre, and only you can see them.',
    exampleLabel: 'Example',
    exampleVideoLabel: 'Example video of a dog playing with a rope toy',
    exampleVideoTag: 'Play time · 1:15 pm',
    caption: 'An example, not a real pet. The video and photos are made with AI.',
    openPetCentre: 'Open my pet centre',
  },
  pets: {
    title: 'Made for dogs and cats',
    dogs: {
      title: 'Dogs of every size',
      text: 'Tell us if your dog is small, medium or large, and add daily walks, playtime or a bath.',
    },
    cats: {
      title: 'Cats are welcome too',
      text: 'Tell us about your cat’s routine, food and any medication, and we plan the stay around it.',
    },
    dogPhotoAlt: 'A golden labrador lying on a soft mat',
    catPhotoAlt: 'A black cat resting on a cushion by a window',
    limits: (pets, nights) =>
      `Bring up to ${pets} pets in one booking, for stays of up to ${nights} nights.`,
  },
  safety: {
    title: 'Safe for every guest',
    lead: 'Before check-in, we need:',
    items: [
      'a current vaccination certificate',
      'online consent for emergency vet care up to NZ$500',
    ],
    close: 'It keeps every guest healthy, and it helps our team care for your pet.',
    photoAlt: 'A grey cat lying on the grass in a garden',
  },
  assistant: {
    title: 'Meet our booking assistant',
    lead: 'It is an AI, and it says so. It helps you plan a stay in plain words.',
    points: [
      'Type, speak or tap an answer.',
      'Works in English and Chinese.',
      'Prices come from our price list, never from the AI.',
      'Talk to a person at any time.',
    ],
    cta: 'Plan a stay',
    sampleLabel: 'How the assistant says hello',
  },
  themes: {
    title: 'Make Wagstay yours',
    lead: 'Pick a look you like. The whole site changes with it, including the booking page.',
    legend: 'Site look',
    names: THEME_COPY.en.names,
    families: THEME_COPY.en.families,
    tags: THEME_COPY.en.tags,
    helpLine:
      'Need bigger text or reading help? Use the round button at the bottom left. It can read pages aloud, make text bigger, add a reading ruler and switch to high contrast colours.',
  },
  faq: {
    title: 'Questions pet parents ask',
    items: (pets, nights) => [
      {
        question: 'What does the price include?',
        answer:
          'The total includes your pet’s room, food, any extras you choose and GST. There is no booking fee and no card fee.',
      },
      {
        question: 'When do I pay?',
        answer:
          'When you send your booking, we hold the full price on your card. We charge it once we confirm your stay: straight away if there is room, or after our manager checks a pet that takes medication. If we can’t take your pet, the hold is released.',
      },
      {
        question: 'Do I need an account?',
        answer:
          'No. On your first booking you just choose a password; we make your account and your pet’s profile when you pay. Booked with us before? Sign in to reuse your details.',
      },
      {
        question: 'What do I need on check-in day?',
        answer:
          'Your pet’s current vaccination certificate. Your online agreement includes emergency vet consent up to NZ$500.',
      },
      { question: 'How many pets can I bring?', answer: `Up to ${pets} pets in one booking.` },
      { question: 'How long can a stay be?', answer: `Up to ${nights} nights.` },
      {
        question: 'Is the booking assistant a real person?',
        answer:
          'No. It is an AI, and it tells you so. Prices come from our price list, and you can talk to a person at any time.',
      },
      {
        question: 'Can I use Chinese?',
        answer:
          'Yes. Open the round button at the bottom left and choose Chinese. The booking assistant works in Chinese too.',
      },
      {
        question: 'How will I know how my pet is doing?',
        answer:
          'Our team records care during the stay, and you see the updates in your Wagstay pet centre.',
      },
    ],
  },
  finalCta: {
    title: 'Ready to plan your pet’s stay?',
    lead: 'It takes a few minutes, and you see the full price before you send anything.',
    planStay: 'Plan a stay',
    talkToPerson: 'Talk to a person',
  },
  footer: {
    tagline: 'A boarding hotel for dogs and cats.',
    navLabel: 'Wagstay links',
    planStay: 'Plan a stay',
    prices: 'Prices',
    signIn: 'Sign in',
    createAccount: 'Create an account',
    myPetCentre: 'My pet centre',
    copyright: (year) => `© ${year} Wagstay`,
  },
};

const ZH: LandingCopy = {
  documentTitle: 'Wagstay | 狗狗和猫咪寄养',
  skipLink: '跳到主要内容',
  header: {
    homeLabel: 'Wagstay 首页',
    navLabel: '本页内容',
    nav: { prices: '价格', howItWorks: '预约流程', care: '照顾动态', faq: '常见问题' },
    signIn: '登录',
    myPetCentre: '我的宠物中心',
    planStay: '规划住宿',
  },
  hero: {
    title: '让狗狗和猫咪住得开心',
    titleAccent: '开心',
    lead: 'Wagstay 是一家狗狗和猫咪寄养酒店。告诉我们的预约助手你的宠物需要什么，预定前就能看到完整价格。',
    planStay: '规划住宿',
    seePrices: '查看价格',
    reassurance: '规划住宿不需要账户。住宿确认后才扣款。',
  },
  promises: {
    title: '我们的承诺',
    items: [
      { title: '价格一目了然', text: '你看到的总价已包含房间、餐食和 GST。' },
      { title: '没有预订费', text: '不收预订费，也不收刷卡费。' },
      {
        title: '有空位就确认',
        text: '有空位的话，提交后立即确认。如果宠物需要用药，经理会先审核。',
      },
      { title: '只接待健康的宠物', text: '入住那天，我们会在柜台核对每只宠物的疫苗证明。' },
    ],
  },
  howItWorks: {
    title: '预约流程',
    steps: [
      { title: '介绍你的宠物', text: '打字、说话或点选都行，AI 只问必要的问题。' },
      { title: '选个组合', text: 'AI 推荐合适的组合，每一项都能改，价格实时更新。' },
      { title: '一步订好', text: '第一次来不用注册，付款时自动建好账号和宠物档案。' },
      { title: '办理入住', text: '带上疫苗证明就行。' },
    ],
  },
  care: {
    title: '随时了解它今天过得怎样',
    lead: '宠物住在我们这里时，工作人员会记录它的吃饭、散步、玩耍和休息。每条动态都会出现在你的 Wagstay 宠物中心，只有你能看到。',
    exampleLabel: '示例',
    exampleVideoLabel: '示例视频：一只狗在玩绳子玩具',
    exampleVideoTag: '玩耍时间 · 下午 1:15',
    caption: '这只是示例，不是真实的宠物。视频和照片由 AI 生成。',
    openPetCentre: '打开我的宠物中心',
  },
  pets: {
    title: '为狗狗和猫咪而设',
    dogs: {
      title: '各种体型的狗狗',
      text: '告诉我们狗狗是小型、中型还是大型，还可以加上每天遛狗、玩耍时间或洗澡。',
    },
    cats: {
      title: '猫咪也很欢迎',
      text: '告诉我们猫咪的作息、饮食和用药情况，我们会按它的习惯安排住宿。',
    },
    dogPhotoAlt: '一只金色拉布拉多趴在柔软的垫子上',
    catPhotoAlt: '一只黑猫在窗边的靠垫上休息',
    limits: (pets, nights) => `一次预约最多可带 ${pets} 只宠物，每次最多住 ${nights} 晚。`,
  },
  safety: {
    title: '让每位住客都安全',
    lead: '入住之前，请准备好：',
    items: ['出示有效的疫苗证明', '网上同意联系不上你时不超过 NZ$500 的紧急就医'],
    close: '这能让每位住客保持健康，也能帮助工作人员照顾好你的宠物。',
    photoAlt: '一只灰猫躺在花园的草地上',
  },
  assistant: {
    title: '认识我们的预约助手',
    lead: '它是 AI，也会主动告诉你。它用简单的话帮你规划住宿。',
    points: [
      '打字、说话或点选答案都可以。',
      '支持英文和中文。',
      '价格来自我们的价目表，不是由 AI 定的。',
      '随时可以联系工作人员。',
    ],
    cta: '规划住宿',
    sampleLabel: '助手这样打招呼',
  },
  themes: {
    title: '把 Wagstay 变成你喜欢的样子',
    lead: '挑一个你喜欢的外观，整个网站都会跟着变，包括预约页面。',
    legend: '网站外观',
    names: THEME_COPY.zh.names,
    families: THEME_COPY.zh.families,
    tags: THEME_COPY.zh.tags,
    helpLine:
      '需要更大的字或阅读帮助？请点左下角的圆形按钮。它可以朗读页面、放大文字、添加阅读标尺，还能切换到高对比度颜色。',
  },
  faq: {
    title: '宠物家长常问的问题',
    items: (pets, nights) => [
      {
        question: '价格包含什么？',
        answer: '总价包含宠物的房间、餐食、你选的附加服务和 GST。不收预订费，也不收刷卡费。',
      },
      {
        question: '什么时候付款？',
        answer:
          '提交预约时，我们会在你的卡上冻结全款。住宿确认后才扣款：有空位的话马上确认并扣款；如果宠物需要用药，经理审核后再扣款。我们接收不了的话，冻结会解除。',
      },
      {
        question: '需要注册账户吗？',
        answer:
          '不需要。第一次预订时设置一个密码就行，付款时我们会自动建好你的账号和宠物档案。以前订过？登录就能沿用你的资料。',
      },
      {
        question: '入住那天需要准备什么？',
        answer: '带上宠物有效的疫苗证明。网上条款已包含联系不上你时不超过 NZ$500 的紧急就医同意。',
      },
      { question: '可以带几只宠物？', answer: `一次预约最多 ${pets} 只宠物。` },
      { question: '最长可以住多久？', answer: `最多 ${nights} 晚。` },
      {
        question: '预约助手是真人吗？',
        answer: '不是。它是 AI，也会告诉你这一点。价格来自我们的价目表，你也可以随时联系工作人员。',
      },
      {
        question: '可以用中文吗？',
        answer: '可以。点左下角的圆形按钮，选择中文即可切换，预约助手也支持中文。',
      },
      {
        question: '怎么知道宠物过得好不好？',
        answer: '住宿期间工作人员会记录照顾情况，你可以在 Wagstay 宠物中心看到这些动态。',
      },
    ],
  },
  finalCta: {
    title: '准备好为宠物规划住宿了吗？',
    lead: '只需几分钟，提交前就能看到完整价格。',
    planStay: '规划住宿',
    talkToPerson: '联系工作人员',
  },
  footer: {
    tagline: '狗狗和猫咪的寄养酒店。',
    navLabel: 'Wagstay 链接',
    planStay: '规划住宿',
    prices: '价格',
    signIn: '登录',
    createAccount: '注册账户',
    myPetCentre: '我的宠物中心',
    copyright: (year) => `© ${year} Wagstay`,
  },
};

export const LANDING_COPY: Record<ConciergeLocale, LandingCopy> = { en: EN, zh: ZH };
