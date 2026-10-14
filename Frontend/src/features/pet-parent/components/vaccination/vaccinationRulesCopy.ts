import type { PortalCopy } from '../../i18n/portalLocale';

// Words for the explaining sections of the Vaccination information page. They quote the Code of
// Welfare: Temporary Housing of Companion Animals, so the Chinese keeps the same legal meaning,
// standard numbers and vaccine names as the English and adds or drops no promise. Wagstay's own
// rules (which vaccines) are always named as ours; only what the Code says is called law (Fair
// Trading Act s13(i)). The Chinese names the Code and the Act in Chinese only: no English reaches
// a Chinese reader, and the English page carries the official names.

/** A label and its explanation, as one row of a list. */
export interface LabelledText {
  label: string;
  text: string;
}

/** One rule in "The rules we follow". */
export interface VaccinationRule {
  title: string;
  body: string;
}

export interface VaccinationRulesCopy {
  housingHeading: (petName: string) => string;
  housingBody: (petName: string) => string;
  housingDuration: string;
  housingRows: LabelledText[];
  whyHeading: string;
  whyProtects: (petName: string) => string;
  whyOurRequirement: string;
  whyCode: string;
  rulesHeading: string;
  rules: VaccinationRule[];
  otherPetsHeading: string;
  /** Sits between a pet's name and its certificate status. */
  otherPetSeparator: string;
  certificateReceived: (day: string) => string;
  certificateNeeded: string;
  sourceNote: string;
}

const EN: VaccinationRulesCopy = {
  housingHeading: (petName) => `${petName} will be kept apart from other pets`,
  housingBody: (petName) =>
    `Without proof that ${petName} is fully vaccinated, ${petName} is kept apart from the other animals. The Code of Welfare requires this for a pet that is not fully vaccinated or whose vaccination status is unknown (Minimum Standards 4(c) and 6(a)). What counts as fully vaccinated (C5 for dogs, F3 for cats) is our own standard. It means a quieter, less sociable stay for ${petName}.`,
  housingDuration:
    'There is no fixed number of days: the Code requires quarantine for ‘an appropriate amount of time’.',
  housingRows: [
    { label: 'Not vaccinated', text: 'Quarantined for an appropriate period.' },
    {
      label: 'Vaccination status unknown',
      text: 'Quarantined until immune status is established.',
    },
    { label: 'Suspected infectious disease', text: 'Supervised closely and securely isolated.' },
  ],
  whyHeading: 'Why we ask',
  whyProtects: (petName) =>
    `Vaccination protects ${petName} and the other animals in our care from diseases that spread easily.`,
  whyOurRequirement:
    'Wagstay asks for C5 vaccination for dogs and F3 for cats. This is our own requirement, not a law.',
  whyCode:
    'The Code of Welfare for temporary housing of companion animals, made under the Animal Welfare Act 1999, says each pet’s proof of vaccination must come with the pet and show the date each vaccine was given and when it is next due. A pet that is not vaccinated, or whose vaccination status is not known, must be kept apart from other animals.',
  rulesHeading: 'The rules we follow',
  // The first three are the rules that bind the parent, each saying whether it is the Code or
  // Wagstay's own; the last two are the facility's own duties (reassurance, not tasks). The
  // business should still have this copy checked before launch.
  rules: [
    {
      title: 'Vaccination proof',
      body: "The Code of Welfare says proof of vaccination must come with each pet and show the date each vaccine was given and when it is next due (Minimum Standard 6). We also ask that it shows your pet's name and your vet's details, so we can match it to your pet. Our staff check it at drop-off.",
    },
    {
      title: 'Which vaccines we ask for',
      body: "C5 for dogs and F3 for cats. This is Wagstay's own requirement, not a law. The Code lets each facility decide what fully vaccinated means, based on veterinary advice or its own requirements.",
    },
    {
      title: 'Animals with unknown or incomplete status',
      body: "A pet whose vaccination status is unknown or incomplete is kept apart from the other animals until their immune status is established. There is no fixed number of days: the Code requires quarantine for 'an appropriate amount of time'.",
    },
    {
      title: 'Records we keep',
      body: "We keep a record of each pet's vaccination status so our staff can refer to it throughout the stay.",
    },
    {
      title: 'How we prevent disease spreading',
      body: 'Our staff are trained to recognise the signs of illness, and we have facilities to isolate a pet who is unwell or whose vaccination status is unknown.',
    },
  ],
  otherPetsHeading: 'Other pets on this booking',
  otherPetSeparator: ': ',
  certificateReceived: (day) => `Certificate received ${day}`,
  certificateNeeded: 'Certificate needed',
  sourceNote:
    'Code of Welfare: Temporary Housing of Companion Animals (New Zealand), issued 1 October 2018, amended 9 May 2021: Minimum Standard No. 6 (Contagious Diseases) and Minimum Standard No. 4 (Assessment on Admittance).',
};

const ZH: VaccinationRulesCopy = {
  housingHeading: (petName) => `${petName} 会和其他宠物分开安置`,
  housingBody: (petName) =>
    `如果没有证明 ${petName} 已完成全部疫苗接种，${petName} 会和其他动物分开安置。对于没有完成全部疫苗接种、或疫苗情况不明的宠物，《动物福利守则》要求这样做（最低标准 4(c) 和 6(a)）。怎样才算完成全部疫苗接种（狗狗 C5，猫咪 F3）是我们自己的标准。这意味着 ${petName} 的住宿会更安静，和其他动物的接触也更少。`,
  housingDuration: '没有固定的天数：《动物福利守则》要求隔离“适当的时间”。',
  housingRows: [
    { label: '未接种疫苗', text: '隔离适当的一段时间。' },
    { label: '疫苗情况不明', text: '隔离，直到确认免疫状况。' },
    { label: '疑似患有传染病', text: '密切看护，并安全隔离。' },
  ],
  whyHeading: '我们为什么要问',
  whyProtects: (petName) => `疫苗能保护 ${petName} 和我们照顾的其他动物，免受容易传播的疾病侵害。`,
  whyOurRequirement:
    'Wagstay 要求狗狗接种 C5 疫苗，猫咪接种 F3 疫苗。这是我们自己的要求，不是法律规定。',
  whyCode:
    '《伴侣动物临时安置福利守则》根据《1999 年动物福利法》制定。守则规定，每只宠物的疫苗证明必须随宠物一起带来，并写明每种疫苗的接种日期和下次接种日期。没有接种疫苗、或疫苗情况不明的宠物，必须和其他动物分开安置。',
  rulesHeading: '我们遵守的规定',
  rules: [
    {
      title: '疫苗证明',
      body: '《动物福利守则》规定，疫苗证明必须随每只宠物一起带来，并写明每种疫苗的接种日期和下次接种日期（最低标准 6）。我们还要求证明上有宠物的名字和你的兽医信息，方便我们把它和你的宠物对上。我们的员工会在送来时核对。',
    },
    {
      title: '我们要求哪些疫苗',
      body: '狗狗 C5，猫咪 F3。这是 Wagstay 自己的要求，不是法律规定。《动物福利守则》允许每家机构根据兽医建议或自身要求，决定怎样才算完成全部疫苗接种。',
    },
    {
      title: '疫苗情况不明或不完整的动物',
      body: '疫苗情况不明或不完整的宠物，会和其他动物分开安置，直到确认它的免疫状况。没有固定的天数：《动物福利守则》要求隔离“适当的时间”。',
    },
    {
      title: '我们保留的记录',
      body: '我们会记录每只宠物的疫苗情况，方便员工在整个住宿期间随时查看。',
    },
    {
      title: '我们如何防止疾病传播',
      body: '我们的员工受过培训，能识别生病的迹象；我们也有隔离设施，用来隔离身体不适或疫苗情况不明的宠物。',
    },
  ],
  otherPetsHeading: '这次预订的其他宠物',
  otherPetSeparator: '：',
  certificateReceived: (day) => `已于 ${day} 收到证书`,
  certificateNeeded: '需要证书',
  sourceNote:
    '《伴侣动物临时安置福利守则》（新西兰），2018 年 10 月 1 日发布，2021 年 5 月 9 日修订：第 6 号最低标准（传染病）和第 4 号最低标准（入住评估）。',
};

export const VACCINATION_RULES_COPY: PortalCopy<VaccinationRulesCopy> = { en: EN, zh: ZH };
