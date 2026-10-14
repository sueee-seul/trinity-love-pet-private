import type { PortalCopy } from '../../i18n/portalLocale';
import type { CertificateProblem, SaveFailure } from './certificateFile';
import type { AnswerChoice } from './useVaccinationAnswer';

// Words for the Vaccination information page, its answer form, the upload and the privacy notice.
// The explaining sections that quote the Code of Welfare live in vaccinationRulesCopy.ts. The
// Chinese reuses the concierge's terms (疫苗证明 for proof, 疫苗证书 for the certificate, 分开安置
// for kept apart, 入住 for check-in) so the guest meets one set of words across the site.

/** One thing the certificate has to show, and whose rule it is (the Code's or Wagstay's own). */
export interface CertificateRequirement {
  title: string;
  source: string;
}

export interface VaccinationCopy {
  pageTitle: string;
  backHome: string;
  /** The first part of the header's lead line, before the stay dates and service. */
  forPet: (petName: string) => string;
  loading: string;
  loadNotFound: string;
  loadFailed: string;
  tryAgain: string;

  proofHeading: string;
  viewCertificate: string;
  opensInNewTab: string;
  locked: (petName: string) => string;
  statusNotProvided: string;
  statusUploaded: string;
  statusUploadedOn: (day: string) => string;
  question: (petName: string) => string;
  questionHelp: (petName: string) => string;
  answerLabel: Readonly<Record<AnswerChoice, string>>;
  noRemovesCertificate: string;
  saved: string;
  saving: string;
  save: string;
  uploadToSave: string;

  certificateHeading: string;
  required: string;
  uploadPrompt: (petName: string) => string;
  /** `uploadedDay` is null when the certificate on file has no upload date. */
  currentCertificate: (uploadedDay: string | null) => string;
  replace: string;
  remove: string;
  uploadNew: string;
  upload: string;
  formatsLabel: string;
  formatsHelp: string;
  mustShowHeading: string;
  mustShow: (petName: string) => CertificateRequirement[];
  staffCheck: (petName: string) => string;
  fileProblem: Readonly<Record<CertificateProblem, string>>;
  saveFailure: (failure: SaveFailure, petName: string) => string;

  privacyHeading: string;
  privacyCollect: (petName: string) => string;
  privacyAccess: string;
  privacyWithoutProof: (petName: string) => string;
  /** `canChange` is whether the parent can still replace the file here (only before drop-off). */
  privacyCorrect: (canChange: boolean) => string;
}

const EN_FILE_PROBLEM: Readonly<Record<CertificateProblem, string>> = {
  required: "Please upload your pet's vaccination certificate or vaccination record.",
  unsupported: 'Unsupported file type. Please upload a PDF, JPG, JPEG, PNG or HEIC file.',
  tooLarge: 'This file is larger than 10 MB. Please upload a smaller file.',
  empty: 'This file is empty. Please choose the certificate again.',
};

const ZH_FILE_PROBLEM: Readonly<Record<CertificateProblem, string>> = {
  required: '请上传宠物的疫苗证书或疫苗接种记录。',
  unsupported: '不支持这种文件类型。请上传 PDF、JPG、JPEG、PNG 或 HEIC 文件。',
  tooLarge: '这个文件超过 10 MB。请上传更小的文件。',
  empty: '这个文件是空的。请重新选择证书。',
};

const EN: VaccinationCopy = {
  pageTitle: 'Vaccination information',
  backHome: 'Home',
  forPet: (petName) => `For ${petName}`,
  loading: 'Loading vaccination information…',
  loadNotFound: 'We could not find that stay.',
  loadFailed: 'Something went wrong loading this page.',
  tryAgain: 'Try again',

  proofHeading: 'Proof for this stay',
  viewCertificate: 'View certificate',
  opensInNewTab: ' (opens in a new tab)',
  locked: (petName) =>
    `${petName}’s check-in time has passed, so this can no longer be changed here. Please talk to our team if something needs to change.`,
  statusNotProvided: 'Not provided yet',
  statusUploaded: 'Uploaded',
  statusUploadedOn: (day) => `Uploaded ${day}`,
  question: (petName) => `Is ${petName} fully vaccinated?`,
  questionHelp: (petName) =>
    `Select Yes if ${petName}’s vaccinations are up to date. You will need to upload the certificate.`,
  answerLabel: { yes: 'Yes', no: 'No' },
  noRemovesCertificate: 'Saving No removes the certificate you uploaded.',
  saved: 'Vaccination information saved.',
  saving: 'Saving…',
  save: 'Save',
  uploadToSave: 'Upload the certificate to save.',

  certificateHeading: 'Vaccination certificate',
  required: 'Required',
  uploadPrompt: (petName) =>
    `Please upload ${petName}’s vaccination certificate or vaccination record from your vet.`,
  currentCertificate: (uploadedDay) =>
    `${uploadedDay ? `You uploaded a certificate on ${uploadedDay}.` : 'A certificate is on file.'} Choose a new file to replace it.`,
  replace: 'Replace',
  remove: 'Remove',
  uploadNew: 'Upload a new certificate',
  upload: 'Upload certificate',
  formatsLabel: 'PDF, JPG, JPEG, PNG or HEIC, up to 10 MB',
  formatsHelp: 'Supported formats: PDF, JPG, JPEG, PNG, HEIC. Maximum file size: 10 MB.',
  mustShowHeading: 'The certificate must show',
  mustShow: (petName) => [
    { title: 'The date each vaccine was given', source: 'The Code of Welfare asks for this.' },
    { title: 'When each vaccine is next due', source: 'The Code of Welfare asks for this too.' },
    {
      title: `${petName}'s name and your vet's details`,
      source: 'Wagstay asks for this, so we can match it.',
    },
  ],
  staffCheck: (petName) => `Our staff check the certificate when you drop ${petName} off.`,
  fileProblem: EN_FILE_PROBLEM,
  saveFailure: (failure, petName) => {
    switch (failure) {
      case 'stayStarted':
        return `${petName}'s check-in time has passed, so this can no longer be changed here. Please talk to our team.`;
      case 'notFound':
        return 'We could not find that stay.';
      case 'signedOut':
        return 'Please sign in again, then save.';
      case 'unknown':
        return 'We could not save this. Please try again.';
      default:
        return EN_FILE_PROBLEM[failure];
    }
  },

  privacyHeading: 'How we handle this certificate',
  privacyCollect: (petName) =>
    `We collect the certificate you upload and your Yes or No answer. We use them to check ${petName}’s vaccinations and to decide whether ${petName} needs to be kept apart from other pets.`,
  privacyAccess:
    'Only you and Wagstay staff can open the certificate. We keep it privately on our booking system’s server. It never has a public link.',
  privacyWithoutProof: (petName) =>
    `If you do not give us proof, ${petName} is kept apart from other pets.`,
  privacyCorrect: (canChange) =>
    `You can ask to see or correct it at any time. ${
      canChange
        ? 'To correct it, upload a new file here before check-in, or ask our team.'
        : 'To correct it now, please ask our team.'
    }`,
};

const ZH: VaccinationCopy = {
  pageTitle: '疫苗信息',
  backHome: '首页',
  forPet: (petName) => `宠物：${petName}`,
  loading: '正在加载疫苗信息…',
  loadNotFound: '找不到这次住宿。',
  loadFailed: '加载页面时出错了。',
  tryAgain: '重试',

  proofHeading: '这次住宿的疫苗证明',
  viewCertificate: '查看证书',
  opensInNewTab: '（在新标签页打开）',
  locked: (petName) => `${petName} 的入住时间已过，这里不能再修改。如需更改，请联系我们的团队。`,
  statusNotProvided: '尚未提供',
  statusUploaded: '已上传',
  statusUploadedOn: (day) => `已于 ${day} 上传`,
  question: (petName) => `${petName} 已完成全部疫苗接种吗？`,
  questionHelp: (petName) =>
    `如果 ${petName} 的疫苗都按时接种、没有过期，请选择“是”。你需要上传疫苗证书。`,
  answerLabel: { yes: '是', no: '否' },
  noRemovesCertificate: '保存“否”会删除你已上传的证书。',
  saved: '疫苗信息已保存。',
  saving: '正在保存…',
  save: '保存',
  uploadToSave: '上传证书后才能保存。',

  certificateHeading: '疫苗证书',
  required: '必填',
  uploadPrompt: (petName) => `请上传兽医出具的 ${petName} 的疫苗证书或疫苗接种记录。`,
  currentCertificate: (uploadedDay) =>
    `${uploadedDay ? `你已于 ${uploadedDay} 上传证书。` : '已有一份证书存档。'}选择新文件即可替换。`,
  replace: '替换',
  remove: '移除',
  uploadNew: '上传新证书',
  upload: '上传证书',
  formatsLabel: 'PDF、JPG、JPEG、PNG 或 HEIC，最大 10 MB',
  formatsHelp: '支持的格式：PDF、JPG、JPEG、PNG、HEIC。文件最大 10 MB。',
  mustShowHeading: '证书上必须写明',
  mustShow: (petName) => [
    { title: '每种疫苗的接种日期', source: '这是《动物福利守则》的要求。' },
    { title: '每种疫苗的下次接种日期', source: '这也是《动物福利守则》的要求。' },
    { title: `${petName} 的名字和你的兽医信息`, source: '这是 Wagstay 的要求，方便我们核对。' },
  ],
  staffCheck: (petName) => `${petName} 入住时，我们的员工会核对证书。`,
  fileProblem: ZH_FILE_PROBLEM,
  saveFailure: (failure, petName) => {
    switch (failure) {
      case 'stayStarted':
        return `${petName} 的入住时间已过，这里不能再修改。请联系我们的团队。`;
      case 'notFound':
        return '找不到这次住宿。';
      case 'signedOut':
        return '请重新登录，然后再保存。';
      case 'unknown':
        return '保存失败，请重试。';
      default:
        return ZH_FILE_PROBLEM[failure];
    }
  },

  privacyHeading: '我们如何处理这份证书',
  privacyCollect: (petName) =>
    `我们会收集你上传的证书，以及你选择的“是”或“否”。我们用它们来核对 ${petName} 的疫苗情况，并决定 ${petName} 是否需要和其他宠物分开安置。`,
  privacyAccess:
    '只有你和 Wagstay 员工可以打开这份证书。我们把它私密保存在我们预订系统的服务器上。它不会有任何公开链接。',
  privacyWithoutProof: (petName) => `如果你不提供证明，${petName} 会和其他宠物分开安置。`,
  privacyCorrect: (canChange) =>
    `你可以随时要求查看或更正这份证书。${
      canChange
        ? '如需更正，请在入住前在这里上传新文件，或联系我们的团队。'
        : '现在如需更正，请联系我们的团队。'
    }`,
};

export const VACCINATION_COPY: PortalCopy<VaccinationCopy> = { en: EN, zh: ZH };
