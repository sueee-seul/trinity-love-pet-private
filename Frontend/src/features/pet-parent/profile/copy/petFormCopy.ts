import type { PortalCopy } from '../../i18n/portalLocale';
import type { Pet, Species } from '../types';

/** A select option: the stored value stays the same in every language, only the label changes. */
export interface OptionCopy<T extends string> {
  value: T;
  label: string;
}

/** The words of the add and edit pet form. */
export interface PetFormCopy {
  petPhoto: string;
  noPhoto: string;
  petName: string;
  species: string;
  speciesOptions: readonly OptionCopy<Species>[];
  breed: string;
  birthDate: string;
  sex: string;
  sexOptions: readonly OptionCopy<NonNullable<Pet['sex']>>[];
  weight: string;
  colour: string;
  microchip: string;
  allergies: string;
  desexed: string;
  dietNotes: string;
  behaviourNotes: string;
  cancel: string;
  savePet: string;
  addPet: string;
}

export const PET_FORM_COPY: PortalCopy<PetFormCopy> = {
  en: {
    petPhoto: 'Pet photo',
    noPhoto: 'No photo',
    petName: 'Pet name',
    species: 'Species',
    speciesOptions: [
      { value: 'DOG', label: 'Dog' },
      { value: 'CAT', label: 'Cat' },
      { value: 'OTHER', label: 'Other' },
    ],
    breed: 'Breed',
    birthDate: 'Birth date',
    sex: 'Sex',
    sexOptions: [
      { value: '', label: 'Not set' },
      { value: 'female', label: 'Female' },
      { value: 'male', label: 'Male' },
    ],
    weight: 'Weight (kg)',
    colour: 'Colour',
    microchip: 'Microchip',
    allergies: 'Allergies (comma separated)',
    desexed: 'Desexed',
    dietNotes: 'Diet notes',
    behaviourNotes: 'Behaviour notes',
    cancel: 'Cancel',
    savePet: 'Save pet',
    addPet: 'Add pet',
  },
  zh: {
    petPhoto: '宠物照片',
    noPhoto: '没有照片',
    petName: '宠物名字',
    species: '种类',
    speciesOptions: [
      { value: 'DOG', label: '狗狗' },
      { value: 'CAT', label: '猫咪' },
      { value: 'OTHER', label: '其他' },
    ],
    breed: '品种',
    birthDate: '出生日期',
    sex: '性别',
    sexOptions: [
      { value: '', label: '未填写' },
      { value: 'female', label: '母' },
      { value: 'male', label: '公' },
    ],
    weight: '体重（公斤）',
    colour: '毛色',
    microchip: '芯片号',
    // The form splits the list on an English comma, so the hint asks for that comma by name.
    allergies: '过敏（用英文逗号 , 分隔）',
    desexed: '已绝育',
    dietNotes: '饮食备注',
    behaviourNotes: '行为备注',
    cancel: '取消',
    savePet: '保存宠物',
    addPet: '添加宠物',
  },
};

/**
 * The pet's vet and emergency contact fields. Privacy Act 2020 IPP 3A asks us to make sure the
 * people named here know we hold their details, so the notice travels with the fields.
 */
export interface PetContactsCopy {
  vetName: string;
  vetPhone: string;
  emergencyContact: string;
  notice: string;
}

export const PET_CONTACTS_COPY: PortalCopy<PetContactsCopy> = {
  en: {
    vetName: 'Vet name',
    vetPhone: 'Vet phone',
    emergencyContact: 'Emergency contact',
    notice:
      'If you add a person here, please tell them that we keep their name and number to contact them about your pet.',
  },
  zh: {
    vetName: '兽医姓名',
    vetPhone: '兽医电话',
    emergencyContact: '紧急联系人',
    notice:
      '如果在这里填写了别人的信息，请告知对方：我们会保存他们的姓名和电话，用于就你的宠物联系他们。',
  },
};
