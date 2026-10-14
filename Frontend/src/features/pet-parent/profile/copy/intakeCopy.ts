import type { PortalCopy, PortalLocale } from '../../i18n/portalLocale';
import type { DictationButtonLabels, DictationMessages } from '../../../../shared/dictation';
import type { PetIntakeDraft } from '../petIntakeApi';

/**
 * The words of the pet intake assistant's own panel. Only the panel is translated: what the owner
 * writes goes to the server as written, and the draft that comes back is in English because the
 * staff caring for the pet read English.
 */
export interface IntakeCopy {
  heading: string;
  /** The intro is split around the part drawn in bold. */
  introBefore: string;
  introStrong: string;
  introAfter: string;
  placeholder: string;
  boxLabel: string;
  read: string;
  reading: string;
  listening: string;
  transcribing: string;
  readFields: (count: number) => string;
  nothingRecognised: string;
  filled: string;
  translated: (language: string) => string;
  fieldLabels: Record<keyof PetIntakeDraft, string>;
  withFood: string;
  withoutFood: string;
  scheduleJoiner: string;
  listSeparator: string;
  yes: string;
  no: string;
  medicalGroupLabel: string;
  checkCarefully: string;
  medicalConfirm: string;
  confirm: string;
  discard: string;
  tickToContinue: string;
  /** Left out in English, so the dictation module's own English words are used. */
  dictationLabels?: DictationButtonLabels;
  dictationMessages?: DictationMessages;
}

export const INTAKE_COPY: PortalCopy<IntakeCopy> = {
  en: {
    heading: 'Describe your pet instead',
    introBefore: 'Type it or press the microphone and say it. ',
    introStrong: 'Any language works',
    introAfter:
      '. Chinese, Korean, Samoan, Spanish: it is read in whatever you use and the form is filled in English, because that is what the staff caring for your pet read. You check everything before anything is filled in, and nothing is saved until you press Save.',
    placeholder:
      'Mochi is a 4 year old desexed female border collie, 18kg. Allergic to chicken. One Apoquel tablet twice a day with food. Vet is Dr Lee, 09 123 4567.',
    boxLabel: 'Describe your pet',
    read: 'Read it',
    reading: 'Reading…',
    listening: 'Listening…',
    transcribing: 'Transcribing…',
    readFields: (count) =>
      `Read ${count} field${count === 1 ? '' : 's'}. Check them, then confirm.`,
    nothingRecognised: 'Nothing recognised. Try mentioning the breed, weight or vet.',
    filled: 'Filled in below. Edit anything, then press Save.',
    translated: (language) =>
      `Read in ${language} and translated to English. Names were left as you wrote them.`,
    fieldLabels: {
      name: 'Name',
      species: 'Species',
      breed: 'Breed',
      birthDate: 'Date of birth',
      sex: 'Sex',
      desexed: 'Desexed',
      weightKg: 'Weight',
      colour: 'Colour',
      microchip: 'Microchip',
      dietNotes: 'Diet notes',
      allergies: 'Allergies',
      behaviourNotes: 'Behaviour notes',
      vetName: 'Vet',
      vetPhone: 'Vet phone',
      emergencyContact: 'Emergency contact',
      medications: 'Medications',
    },
    withFood: 'with food',
    withoutFood: 'without food',
    scheduleJoiner: ' and ',
    listSeparator: ', ',
    yes: 'yes',
    no: 'no',
    medicalGroupLabel: 'Medical details to confirm',
    checkCarefully: 'Please check these carefully',
    medicalConfirm:
      'I have read the allergies and medications above and they are correct for my pet.',
    confirm: 'Confirm and fill the form',
    discard: 'Discard',
    tickToContinue: 'Tick the box above to continue.',
  },
  zh: {
    heading: '也可以直接描述你的宠物',
    introBefore: '可以打字，也可以按麦克风说出来。',
    introStrong: '用什么语言都可以',
    introAfter:
      '：中文、韩语、萨摩亚语、西班牙语都行。我们会读懂你用的语言，再用英文填写表格，因为照顾宠物的工作人员看的是英文。填入之前你可以逐项检查，按保存之前不会保存任何内容。',
    placeholder:
      'Mochi 是一只 4 岁的母边境牧羊犬，已绝育，18 公斤。对鸡肉过敏。每天两次，每次随餐吃一片 Apoquel。兽医是 Dr Lee，电话 09 123 4567。',
    boxLabel: '描述你的宠物',
    read: '读取',
    reading: '正在读取…',
    listening: '正在听…',
    transcribing: '正在转写…',
    readFields: (count) => `读取到 ${count} 项，请检查后确认。`,
    nothingRecognised: '没有识别到内容。可以试着说说品种、体重或兽医。',
    filled: '已填入下方表格。可以修改任何一项，然后按保存。',
    translated: (language) => `已按${language}读取并翻译成英文，名字保持你写的原样。`,
    fieldLabels: {
      name: '名字',
      species: '种类',
      breed: '品种',
      birthDate: '出生日期',
      sex: '性别',
      desexed: '已绝育',
      weightKg: '体重',
      colour: '毛色',
      microchip: '芯片号',
      dietNotes: '饮食备注',
      allergies: '过敏',
      behaviourNotes: '行为备注',
      vetName: '兽医',
      vetPhone: '兽医电话',
      emergencyContact: '紧急联系人',
      medications: '用药',
    },
    withFood: '随餐',
    withoutFood: '不随餐',
    scheduleJoiner: '和',
    listSeparator: '、',
    yes: '是',
    no: '否',
    medicalGroupLabel: '需要确认的医疗信息',
    checkCarefully: '请仔细检查以下内容',
    medicalConfirm: '我已阅读上面的过敏和用药信息，确认它们对我的宠物是正确的。',
    confirm: '确认并填入表格',
    discard: '放弃',
    tickToContinue: '请先勾选上面的方框再继续。',
    dictationLabels: {
      start: '用说话代替打字',
      stop: '停止并加入我说的话',
      requesting: '等待麦克风权限',
      finishing: '正在加入文字',
    },
    dictationMessages: {
      unsupported: '这个浏览器不支持语音输入，请改用打字。',
      permissionDenied: '麦克风权限被关闭了。可以在浏览器的网站设置里打开，或者改用打字。',
      noMicrophone: '没有找到麦克风，请改用打字。',
      failed: '语音输入没能启动，请改用打字。',
      streamFailed: '语音转写中断了，请改用打字，或再试一次。',
    },
  },
};

/** The fallback the intake client writes when the server gives no reason (petIntakeApi.ts). */
export const INTAKE_READ_FAILED = 'Could not read the description.';

const INTAKE_ERRORS_IN_CHINESE: Readonly<Record<string, string>> = {
  [INTAKE_READ_FAILED]: '没能读取这段描述。',
};

/**
 * The read failure in the reader's language. The server's own reasons are in English, so in
 * Chinese anything but the client's own sentence becomes that sentence's Chinese.
 */
export function localizeIntakeError(error: string, locale: PortalLocale): string {
  if (locale === 'en') return error;
  return INTAKE_ERRORS_IN_CHINESE[error] ?? INTAKE_ERRORS_IN_CHINESE[INTAKE_READ_FAILED];
}

/**
 * The model names the owner's language in English ("Chinese"). Chinese readers get the Chinese
 * name: the browser knows both names for every ISO 639 language, so the English name is matched
 * against them. A few names the model uses that are not ISO names are added by hand.
 */
const ISO_LANGUAGE_CODES = (
  'af am ar as az be bg bn bo bs ca cs cy da de el en eo es et eu fa fi fil fj fr ga gd gl gu ha ' +
  'haw he hi hr ht hu hy id ig is it ja jv ka kk km kn ko ku ky la lb lo lt lv mg mi mk ml mn mr ' +
  'ms mt my ne nl no ny pa pl ps pt ro ru rw sd si sk sl sm sn so sq sr st su sv sw ta te tg th ' +
  'ti tk to tr tt ug uk ur uz vi xh yi yo yue zh zu'
).split(' ');

const languageNamesInChinese = (): ReadonlyMap<string, string> => {
  const english = new Intl.DisplayNames(['en'], { type: 'language' });
  const chinese = new Intl.DisplayNames(['zh'], { type: 'language' });
  const names = new Map<string, string>(
    ISO_LANGUAGE_CODES.map((code) => [
      (english.of(code) ?? code).toLowerCase(),
      chinese.of(code) ?? code,
    ]),
  );
  names.set('mandarin', '普通话');
  names.set('maori', '毛利语');
  names.set('tagalog', '他加禄语');
  return names;
};

let cachedLanguageNames: ReadonlyMap<string, string> | null = null;

/** Said when the model names a language the browser does not know. */
const UNKNOWN_LANGUAGE_IN_CHINESE = '你使用的语言';

/** The source language's name in the reader's language. */
export function localizeLanguageName(language: string, locale: PortalLocale): string {
  if (locale !== 'zh') return language;
  cachedLanguageNames ??= languageNamesInChinese();
  return cachedLanguageNames.get(language.toLowerCase()) ?? UNKNOWN_LANGUAGE_IN_CHINESE;
}
