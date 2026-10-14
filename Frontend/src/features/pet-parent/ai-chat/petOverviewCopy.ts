import type { PortalCopy } from '../i18n/portalLocale';
import type { PetOverviewStay } from './types';

type CareInformation = NonNullable<PetOverviewStay['care_information']>;
type CareTextField =
  'feeding_routine' | 'medication_instructions' | 'behavior_and_health_notes' | 'other_notes';
type CareYesNoField = Exclude<keyof CareInformation, CareTextField>;

/** The pet cards the chat shows in a reply. What the parent or staff wrote is shown as written. */
export interface PetOverviewCopy {
  listLabel: string;
  careText: Record<CareTextField, string>;
  careYesNo: Record<CareYesNoField, string>;
  yes: string;
  no: string;
  stayDetails: (stay: string) => string;
  dropOff: (when: string) => string;
  pickUp: (when: string) => string;
  noCareInformation: string;
  bookedServices: string;
  noServices: string;
  age: string;
  weight: string;
  notRecorded: string;
  years: (age: number) => string;
  kilograms: (weight: number) => string;
  answerLabel: (petName: string) => string;
  answer: string;
  stays: string;
  noStays: string;
  viewStays: string;
}

export const PET_OVERVIEW_COPY: PortalCopy<PetOverviewCopy> = {
  en: {
    listLabel: 'Pet information',
    careText: {
      feeding_routine: 'Feeding routine',
      medication_instructions: 'Medication',
      behavior_and_health_notes: 'Behavior and health',
      other_notes: 'Other notes',
    },
    careYesNo: {
      first_time_boarding: 'First stay',
      crate_trained: 'Crate trained',
      allows_socialization: 'Socialization',
      fully_vaccinated: 'Vaccinations current',
    },
    yes: 'Yes',
    no: 'No',
    stayDetails: (stay) => `${stay} stay details`,
    dropOff: (when) => `Check-in: ${when}`,
    pickUp: (when) => `Check-out: ${when}`,
    noCareInformation: 'No care information is recorded.',
    bookedServices: 'Booked services',
    noServices: 'No services recorded.',
    age: 'Age',
    weight: 'Weight',
    notRecorded: 'Not recorded',
    years: (age) => `${age} years`,
    kilograms: (weight) => `${weight} kg`,
    answerLabel: (petName) => `${petName} answer`,
    answer: 'Answer',
    stays: 'Stays',
    noStays: 'No stays are recorded.',
    viewStays: 'View stays',
  },
  zh: {
    listLabel: '宠物信息',
    careText: {
      feeding_routine: '喂食习惯',
      medication_instructions: '用药',
      behavior_and_health_notes: '行为和健康',
      other_notes: '其他备注',
    },
    careYesNo: {
      first_time_boarding: '第一次寄养',
      crate_trained: '习惯笼子',
      allows_socialization: '可以和其他宠物一起玩',
      fully_vaccinated: '疫苗在有效期内',
    },
    yes: '是',
    no: '否',
    stayDetails: (stay) => `${stay}的住宿详情`,
    dropOff: (when) => `入住：${when}`,
    pickUp: (when) => `离店：${when}`,
    noCareInformation: '还没有记录照护信息。',
    bookedServices: '预订的服务',
    noServices: '没有记录服务。',
    age: '年龄',
    weight: '体重',
    notRecorded: '未记录',
    years: (age) => `${age} 岁`,
    kilograms: (weight) => `${weight} 公斤`,
    answerLabel: (petName) => `关于${petName}的回答`,
    answer: '回答',
    stays: '住宿',
    noStays: '还没有住宿记录。',
    viewStays: '查看住宿',
  },
};
