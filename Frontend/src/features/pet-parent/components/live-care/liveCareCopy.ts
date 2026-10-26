import type { PortalCopy } from '../../i18n/portalLocale';
import type { DoseStatus } from '../../types/liveCare';
import { possessive } from '../../utils/home';

/**
 * Every word Live care writes itself. Care task names, times and stat labels arrive from the
 * server in English and are put in the parent's language by liveCareWords.ts; staff notes and
 * photos are shown as delivered. A failed load is worded here (see `requestErrorText`).
 */
export interface LiveCareCopy {
  page: {
    title: string;
    backToStays: string;
    loading: string;
    loadingPet: (petName: string) => string;
    stayLead: (petName: string, stayDates: string) => string;
    notFoundTitle: string;
    notFoundBody: string;
    viewMyStays: string;
    /** Shown when the request failed without a message of its own. */
    loadFailed: string;
    somethingWentWrong: string;
    tryAgain: string;
  };
  footnote: {
    live: (lastUpdated: string) => string;
    ended: (petName: string) => string;
    upcoming: (petName: string) => string;
    justNow: string;
    minutesAgo: (minutes: number) => string;
  };
  hero: {
    boardingWith: (sitterName: string) => string;
    stayedWith: (sitterName: string) => string;
    /** Said in place of a carer's name while nobody is rostered onto the pet. */
    boardingWithTeam: string;
    stayedWithTeam: string;
    notStarted: string;
  };
  day: {
    title: string;
    noActivities: string;
    daysGroup: string;
    today: string;
    activitiesDone: (completed: number, total: number) => string;
    nextActivity: (title: string, time: string) => string;
    allDone: string;
  };
  timeline: {
    completed: string;
    inProgress: string;
    upcoming: string;
    /** Stands in for the time of a task the manager has not timed yet. */
    timeNotSet: string;
    viewPhotos: string;
    viewPhotosFrom: (entryTitle: string) => string;
    /** Marks a staff note the reader sees in machine translation. */
    noteTranslated: string;
    /** Stands in for a staff note that could not be translated. */
    noteNotTranslated: string;
    showNoteOriginal: string;
  };
  photos: {
    count: (count: number) => string;
    photoAlt: (entryTitle: string, position: number) => string;
    photosFrom: (entryTitle: string) => string;
    close: string;
    ofTheDay: string;
    ofTheDayCarousel: string;
    allDay: string;
    viewAll: string;
    viewAllFromDay: (countLabel: string) => string;
    dayPreviewAlt: (firstPhotoAlt: string) => string;
  };
  /**
   * The day's dose record. Only a 'given' dose was given: a due or overdue dose is never worded as
   * given, and an overdue one says staff have been alerted.
   */
  medicines: {
    title: string;
    lead: string;
    noDoses: string;
    loadFailed: string;
    medicineAndDose: (medicineName: string, dose: string) => string;
    slotAndDue: (slot: string, time: string) => string;
    status: Record<DoseStatus, string>;
    given: (time: string | null, staffName: string | null) => string;
    due: string;
    overdue: string;
    notGiven: (reason: string | null) => string;
    notRecorded: string;
  };
  /**
   * The arrival note, the daily update and the stay report. Their bodies come from the server in
   * the parent's chosen language and are shown as delivered; only the words around them are ours.
   */
  updates: {
    todayTitle: string;
    dayTitle: (day: string) => string;
    /** The short note sent on the drop-off day, once the pet has settled in. */
    arrivalTitle: string;
    /** Shown on the current day before the update hour, when no update has come yet. */
    waiting: (time: string) => string;
    /** "5 pm", or the Chinese "5 o'clock in the afternoon", for the hour the parent chose (0 to 23). */
    updateHour: (hour: number) => string;
    sentAt: (time: string) => string;
    reportTitle: string;
    share: string;
    copied: string;
    photoAlt: (petName: string) => string;
    /** The accessible name of the update's short video. */
    videoLabel: (petName: string) => string;
    loadFailed: string;
    /** The homepage's one line: the update's first sentence, labelled. */
    homeLine: (firstSentence: string) => string;
    /** The homepage's link from that line to the whole update. */
    readMore: string;
  };
  petSwitcher: string;
}

const sentenceCase = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const englishPhotoCount = (count: number): string => `${count} ${count === 1 ? 'photo' : 'photos'}`;

const twelveHour = (hour: number): number => (hour % 12 === 0 ? 12 : hour % 12);

export const LIVE_CARE_COPY: PortalCopy<LiveCareCopy> = {
  en: {
    page: {
      title: 'Live care',
      backToStays: 'My stays',
      loading: 'Loading live care updates…',
      loadingPet: (petName) => `Loading ${possessive([petName])} updates…`,
      stayLead: (petName, stayDates) => `${possessive([petName])} stay, ${stayDates}`,
      notFoundTitle: 'No stay to show live care for yet.',
      notFoundBody: 'Once your pet is booked in, updates will show up here.',
      viewMyStays: 'View my stays',
      loadFailed: 'We could not load live care updates.',
      somethingWentWrong: 'Something went wrong.',
      tryAgain: 'Try again',
    },
    footnote: {
      live: (lastUpdated) =>
        `This page updates by itself as your sitter checks in. Last updated ${lastUpdated}.`,
      ended: (petName) =>
        `${possessive([petName])} stay has ended. You can still look back at every day of it.`,
      upcoming: (petName) => `Updates start when ${petName} arrives for the stay.`,
      justNow: 'just now',
      minutesAgo: (minutes) => `${minutes} min ago`,
    },
    hero: {
      boardingWith: (sitterName) => `Boarding with ${sitterName}`,
      stayedWith: (sitterName) => `Stayed with ${sitterName}`,
      boardingWithTeam: 'Cared for by the Wagstay team',
      stayedWithTeam: 'Cared for by the Wagstay team',
      notStarted: 'Not started',
    },
    day: {
      title: 'Care by day',
      noActivities: 'No care activities logged for this day yet.',
      daysGroup: 'Day of stay',
      today: 'Today',
      activitiesDone: (completed, total) => `${completed} of ${total} activities done`,
      nextActivity: (title, time) => `Next: ${title} at ${time}`,
      allDone: 'Every activity for this day is done.',
    },
    timeline: {
      completed: 'Completed',
      inProgress: 'In progress',
      upcoming: 'Upcoming',
      timeNotSet: 'Time to be set',
      viewPhotos: 'View photos',
      viewPhotosFrom: (entryTitle) => `View photos from ${entryTitle}`,
      noteTranslated: 'Translated',
      noteNotTranslated: 'Our staff wrote a note that could not be translated.',
      showNoteOriginal: 'Show the original note',
    },
    photos: {
      count: englishPhotoCount,
      photoAlt: (entryTitle, position) => `${entryTitle} photo ${position}`,
      photosFrom: (entryTitle) => `Photos from ${entryTitle}`,
      close: 'Close photos',
      ofTheDay: 'Photos of the day',
      ofTheDayCarousel: 'Photos of the day carousel',
      allDay: 'All day',
      viewAll: 'View all photos',
      viewAllFromDay: (countLabel) => `View all ${countLabel} from this day`,
      dayPreviewAlt: (firstPhotoAlt) =>
        `Preview of this day's photos, starting with ${firstPhotoAlt}`,
    },
    medicines: {
      title: 'Medicines',
      lead: 'Each dose for this day, as staff recorded it.',
      noDoses: 'No doses are due on this day.',
      loadFailed: 'We could not load the medicine record.',
      medicineAndDose: (medicineName, dose) => `${medicineName}, ${dose}`,
      slotAndDue: (slot, time) => `${sentenceCase(slot)}, due ${time}`,
      status: {
        given: 'Given',
        due: 'Due',
        overdue: 'Overdue',
        not_given: 'Not given',
        not_recorded: 'No record',
      },
      given: (time, staffName) => {
        const when = time ? `Given at ${time}` : 'Given';
        return staffName ? `${when} by ${staffName}` : when;
      },
      due: 'Not given yet.',
      overdue: 'Not recorded as given. Staff have been alerted.',
      notGiven: (reason) =>
        reason ? `Not given. Staff reason: ${reason}` : 'Staff recorded that it was not given.',
      notRecorded: 'No record for this dose.',
    },
    updates: {
      todayTitle: "Today's update",
      dayTitle: (day) => `Update for ${day}`,
      arrivalTitle: 'Settled in',
      waiting: (time) => `Today's update arrives after ${time}.`,
      updateHour: (hour) => `${twelveHour(hour)} ${hour < 12 ? 'am' : 'pm'}`,
      sentAt: (time) => `Sent at ${time}`,
      reportTitle: 'How the stay went',
      share: 'Share',
      copied: 'Copied',
      photoAlt: (petName) => `Photo of ${petName} from this update`,
      videoLabel: (petName) => `Short video of ${petName} from this update`,
      loadFailed: 'We could not load the updates.',
      homeLine: (firstSentence) => `Today's update: ${firstSentence}`,
      readMore: 'Read the full update',
    },
    petSwitcher: 'Pets staying now',
  },
  zh: {
    page: {
      title: '照顾动态',
      backToStays: '我的住宿',
      loading: '正在加载照顾动态…',
      loadingPet: (petName) => `正在加载${petName}的动态…`,
      stayLead: (petName, stayDates) => `${petName}的住宿，${stayDates}`,
      notFoundTitle: '还没有可以查看照顾动态的住宿。',
      notFoundBody: '宠物预约入住后，动态会显示在这里。',
      viewMyStays: '查看我的住宿',
      loadFailed: '照顾动态没有加载出来。',
      somethingWentWrong: '出了点问题。',
      tryAgain: '重试',
    },
    footnote: {
      live: (lastUpdated) =>
        `工作人员每次记录照顾情况，这个页面都会自动更新。最后更新：${lastUpdated}。`,
      ended: (petName) => `${petName}的住宿已经结束。你仍然可以回看每一天的记录。`,
      upcoming: (petName) => `${petName}来住之后，这里就会开始更新。`,
      justNow: '刚刚',
      minutesAgo: (minutes) => `${minutes} 分钟前`,
    },
    hero: {
      boardingWith: (sitterName) => `由 ${sitterName} 照顾`,
      stayedWith: (sitterName) => `曾由 ${sitterName} 照顾`,
      boardingWithTeam: '由 Wagstay 团队照顾',
      stayedWithTeam: '曾由 Wagstay 团队照顾',
      notStarted: '尚未开始',
    },
    day: {
      title: '每日照顾',
      noActivities: '这一天还没有照顾记录。',
      daysGroup: '住宿日期',
      today: '今天',
      activitiesDone: (completed, total) => `${total} 项照顾已完成 ${completed} 项`,
      nextActivity: (title, time) => `下一项：${time} ${title}`,
      allDone: '这一天的照顾都完成了。',
    },
    timeline: {
      completed: '已完成',
      inProgress: '进行中',
      upcoming: '待完成',
      timeNotSet: '时间待定',
      viewPhotos: '查看照片',
      viewPhotosFrom: (entryTitle) => `查看“${entryTitle}”的照片`,
      noteTranslated: '自动翻译',
      noteNotTranslated: '工作人员写了一条英文备注，暂时没能翻译。',
      showNoteOriginal: '查看工作人员的原文',
    },
    photos: {
      count: (count) => `${count} 张照片`,
      photoAlt: (entryTitle, position) => `“${entryTitle}”的第 ${position} 张照片`,
      photosFrom: (entryTitle) => `“${entryTitle}”的照片`,
      close: '关闭照片',
      ofTheDay: '当天照片',
      ofTheDayCarousel: '当天照片轮播',
      allDay: '全天',
      viewAll: '查看全部照片',
      viewAllFromDay: (countLabel) => `查看这一天的全部照片（${countLabel}）`,
      dayPreviewAlt: (firstPhotoAlt) => `这一天的照片预览，第一张是${firstPhotoAlt}`,
    },
    medicines: {
      title: '用药',
      lead: '这一天的每一剂药，以工作人员的记录为准。',
      noDoses: '这一天没有需要给的药。',
      loadFailed: '用药记录没有加载出来。',
      medicineAndDose: (medicineName, dose) => `${medicineName}，${dose}`,
      slotAndDue: (slot, time) => `${slot}，应在${time}给药`,
      status: {
        given: '已给药',
        due: '待给药',
        overdue: '已逾时',
        not_given: '未给药',
        not_recorded: '没有记录',
      },
      given: (time, staffName) => {
        const when = time ? `已于${time}给药` : '已给药';
        return staffName ? `${when}，由 ${staffName} 给药` : when;
      },
      due: '尚未给药。',
      overdue: '没有给药记录，已通知工作人员。',
      notGiven: (reason) => (reason ? `未给药。工作人员说明：${reason}` : '工作人员记录为未给药。'),
      notRecorded: '这一剂没有记录。',
    },
    updates: {
      todayTitle: '今日动态',
      dayTitle: (day) => `${day}的动态`,
      arrivalTitle: '已安顿',
      waiting: (time) => `今日动态会在${time}后送达。`,
      updateHour: (hour) => `${hour < 12 ? '上午' : '下午'} ${twelveHour(hour)} 点`,
      sentAt: (time) => `发送时间：${time}`,
      reportTitle: '这次住宿的情况',
      share: '分享',
      copied: '已复制',
      photoAlt: (petName) => `这条动态里${petName}的照片`,
      videoLabel: (petName) => `这条动态里${petName}的短视频`,
      loadFailed: '动态没有加载出来。',
      homeLine: (firstSentence) => `今日动态：${firstSentence}`,
      readMore: '查看完整动态',
    },
    petSwitcher: '正在住宿的宠物',
  },
};
