import type { PortalCopy } from '../../i18n/portalLocale';
import type { Pet } from '../types';

/** The words of one pet's page (/parent/pets/:id). */
export interface PetPageCopy {
  /** Shown for a detail the pet parent has not filled in yet. */
  missingDetail: string;
  backToPets: string;
  sexLabels: Record<NonNullable<Pet['sex']>, string>;
  yourPet: string;
  loadFailedTitle: string;
  tryAgain: string;
  loadingPet: string;
  notFoundTitle: string;
  notFoundLead: string;
  confirmDelete: (name: string) => string;
  bookAStay: string;
  editPet: string;
  deletePet: string;
  photoAndHealthLabel: (name: string) => string;
  noAllergiesOrMedicines: (name: string) => string;
  allergyBadge: (allergy: string) => string;
  detailsTitle: string;
  born: string;
  weight: string;
  weightValue: (kg: number) => string;
  colour: string;
  microchip: string;
  desexed: string;
  yes: string;
  no: string;
  vetTitle: string;
  vet: string;
  vetPhone: string;
  emergencyContact: string;
  dietTitle: string;
  diet: string;
  noDietNotes: string;
  behaviour: string;
  noBehaviourNotes: string;
  medicationsTitle: string;
  noMedications: string;
  asNeeded: string;
  scheduleSeparator: string;
  /**
   * Staff record a medicine's route and unit as short English words ('ORAL', 'tablet'). Chinese
   * names the common ones; English, and any word not listed, shows what staff wrote.
   */
  medicationRoutes: Readonly<Partial<Record<string, string>>>;
  medicationUnits: Readonly<Partial<Record<string, string>>>;
  active: string;
  notActive: string;
  stayHistoryTitle: string;
  allStays: string;
  noStays: string;
  stayDates: (from: string, to: string) => string;
  editTitle: (name: string) => string;
}

export const PET_PAGE_COPY: PortalCopy<PetPageCopy> = {
  en: {
    missingDetail: 'Not set',
    backToPets: 'My pets',
    sexLabels: { female: 'Female', male: 'Male', '': 'Sex not set' },
    yourPet: 'Your pet',
    loadFailedTitle: 'We could not load your pet',
    tryAgain: 'Try again',
    loadingPet: 'Loading your pet…',
    notFoundTitle: 'Pet not found',
    notFoundLead: 'This pet is not on your account. It may have been removed.',
    // The profile really goes; stays, payments and feedback stay, because Wagstay keeps sales
    // records for seven years (Tax Administration Act s 22).
    confirmDelete: (name) =>
      `Delete ${name}? ${name}'s profile, photo, medicines and care notes will be deleted and cannot be recovered. Past stays, payments and feedback stay on record, because we must keep them for tax and legal reasons.`,
    bookAStay: 'Book a stay',
    editPet: 'Edit pet',
    deletePet: 'Delete pet',
    photoAndHealthLabel: (name) => `${name}'s photo and health notes`,
    noAllergiesOrMedicines: (name) => `No allergies or medicines on file for ${name}.`,
    allergyBadge: (allergy) => `${allergy} allergy`,
    detailsTitle: 'Details',
    born: 'Born',
    weight: 'Weight',
    weightValue: (kg) => `${kg} kg`,
    colour: 'Colour',
    microchip: 'Microchip',
    desexed: 'Desexed',
    yes: 'Yes',
    no: 'No',
    vetTitle: 'Vet and emergency',
    vet: 'Vet',
    vetPhone: 'Vet phone',
    emergencyContact: 'Emergency contact',
    dietTitle: 'Diet and behaviour',
    diet: 'Diet',
    noDietNotes: 'No diet notes.',
    behaviour: 'Behaviour',
    noBehaviourNotes: 'No behaviour notes.',
    medicationsTitle: 'Medications',
    noMedications: 'No medications.',
    asNeeded: 'as needed',
    scheduleSeparator: ', ',
    medicationRoutes: {},
    medicationUnits: {},
    active: 'Active',
    notActive: 'Not active',
    stayHistoryTitle: 'Stay history',
    allStays: 'All stays',
    noStays: 'No stays yet.',
    stayDates: (from, to) => `${from} to ${to}`,
    editTitle: (name) => `Edit ${name}`,
  },
  zh: {
    missingDetail: '未填写',
    backToPets: '我的宠物',
    sexLabels: { female: '母', male: '公', '': '性别未填写' },
    yourPet: '你的宠物',
    loadFailedTitle: '宠物资料没有加载出来',
    tryAgain: '重试',
    loadingPet: '正在加载宠物资料…',
    notFoundTitle: '找不到这只宠物',
    notFoundLead: '你的账户里没有这只宠物，可能已经被删除了。',
    confirmDelete: (name) =>
      `确定删除 ${name} 吗？${name} 的资料、照片、用药和照护说明会被删除，无法恢复。以往的住宿、付款和反馈记录会保留，因为税务和法律要求我们保存这些记录。`,
    bookAStay: '预订住宿',
    editPet: '编辑宠物',
    deletePet: '删除宠物',
    photoAndHealthLabel: (name) => `${name} 的照片和健康备注`,
    noAllergiesOrMedicines: (name) => `${name} 没有登记过敏或用药。`,
    allergyBadge: (allergy) => `过敏：${allergy}`,
    detailsTitle: '基本信息',
    born: '出生日期',
    weight: '体重',
    weightValue: (kg) => `${kg} 公斤`,
    colour: '毛色',
    microchip: '芯片号',
    desexed: '已绝育',
    yes: '是',
    no: '否',
    vetTitle: '兽医和紧急联系人',
    vet: '兽医',
    vetPhone: '兽医电话',
    emergencyContact: '紧急联系人',
    dietTitle: '饮食和行为',
    diet: '饮食',
    noDietNotes: '没有饮食备注。',
    behaviour: '行为',
    noBehaviourNotes: '没有行为备注。',
    medicationsTitle: '用药',
    noMedications: '没有用药记录。',
    asNeeded: '按需服用',
    scheduleSeparator: '、',
    medicationRoutes: {
      ORAL: '口服',
      TOPICAL: '外用',
      INJECTION: '注射',
      SUBCUTANEOUS: '皮下注射',
      EYE: '滴眼',
      OPHTHALMIC: '滴眼',
      EAR: '滴耳',
      OTIC: '滴耳',
      INHALED: '吸入',
      TRANSDERMAL: '透皮',
    },
    medicationUnits: {
      tablet: '片',
      tablets: '片',
      capsule: '粒',
      capsules: '粒',
      ml: '毫升',
      mg: '毫克',
      drop: '滴',
      drops: '滴',
      sachet: '袋',
      sachets: '袋',
      pipette: '支',
      pipettes: '支',
    },
    active: '正在使用',
    notActive: '已停用',
    stayHistoryTitle: '住宿记录',
    allStays: '全部住宿',
    noStays: '还没有住宿记录。',
    stayDates: (from, to) => `${from} 至 ${to}`,
    editTitle: (name) => `编辑 ${name}`,
  },
};
