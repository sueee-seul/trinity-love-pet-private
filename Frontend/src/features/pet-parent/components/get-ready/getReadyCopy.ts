// The words of the "Get ready" list in every portal language. getReadyTasks.ts picks the entry
// for a task and its status; the pet's name comes from the server and is never translated.
import type { PortalCopy } from '../../i18n/portalLocale';
import type { GetReadyTaskKey, GetReadyTaskStatus } from '../../types/getReady';

export interface GetReadyCopy {
  statuses: Record<GetReadyTaskStatus, string>;
  taskLabels: Record<GetReadyTaskKey, string>;
  vaccinationHint: string;
  feedingHint: (petName: string) => string;
  /** An open medication task, which only our team can finish. */
  medicationByTeamHint: (petName: string) => string;
  medicationHint: (petName: string) => string;
  emergencyContactHint: string;
  progress: (done: number, total: number) => string;
  /** The My stays card's button, around `progress`. */
  buttonLabel: (progress: string) => string;
  atDropOff: string;
  dropOffChecks: (petName: string) => string[];
}

export const GET_READY_COPY: PortalCopy<GetReadyCopy> = {
  en: {
    statuses: { completed: 'Completed', not_started: 'Not started' },
    taskLabels: {
      vaccination: 'Vaccination proof',
      feeding: 'Feeding',
      medication: 'Medication',
      emergency_contact_and_vet: 'Emergency contact and vet',
    },
    vaccinationHint: 'A certificate that shows the date given and the next due date.',
    feedingHint: (petName) => `What ${petName} eats, how much and when.`,
    medicationByTeamHint: (petName) =>
      `Our team will go through ${petName}'s medicines, doses and times with you by check-in.`,
    medicationHint: (petName) => `Any medicines ${petName} takes, and how to give them.`,
    emergencyContactHint:
      "Someone we can call in an emergency, and your vet's name and phone number.",
    progress: (done, total) => `${done} of ${total} done`,
    buttonLabel: (progress) => `Get ready, ${progress}`,
    atDropOff: 'At check-in',
    dropOffChecks: (petName) => [
      `Our staff check ${petName}'s vaccination proof and give ${petName} a health check.`,
      `Our staff go through ${petName}'s temperament and any bite history with you.`,
      `Without proof, ${petName} is kept apart from other pets until the vaccination status is known.`,
      'Our team checks your recorded emergency vet consent. Current online bookings include consent up to NZ$500; older bookings may need a signature.',
    ],
  },
  zh: {
    statuses: { completed: '已完成', not_started: '未开始' },
    taskLabels: {
      vaccination: '疫苗证明',
      feeding: '饮食',
      medication: '用药',
      emergency_contact_and_vet: '紧急联系人和兽医',
    },
    vaccinationHint: '一份写有接种日期和下次接种日期的证明。',
    feedingHint: (petName) => `${petName} 吃什么、吃多少、什么时候吃。`,
    medicationByTeamHint: (petName) =>
      `最晚在入住时，我们的团队会和你一起核对 ${petName} 的药物、剂量和用药时间。`,
    medicationHint: (petName) => `${petName} 在吃的药，以及怎么给它用药。`,
    emergencyContactHint: '紧急情况下我们可以联系的人，以及你的兽医的名字和电话。',
    progress: (done, total) => `已完成 ${done}/${total}`,
    buttonLabel: (progress) => `入住准备，${progress}`,
    atDropOff: '入住时',
    dropOffChecks: (petName) => [
      `我们的工作人员会查看 ${petName} 的疫苗证明，并给 ${petName} 做健康检查。`,
      `我们的工作人员会和你一起了解 ${petName} 的性格，以及有没有咬人记录。`,
      `没有疫苗证明的话，在确认疫苗情况之前，${petName} 会和其他宠物分开安置。`,
      '我们的团队会核对你登记的紧急就医同意。现在的网上预约已包含不超过 NZ$500 的同意；较早的预约可能需要签字。',
    ],
  },
};
