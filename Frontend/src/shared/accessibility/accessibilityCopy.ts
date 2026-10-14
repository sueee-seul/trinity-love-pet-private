import type { SiteCopy } from '../i18n/siteLanguage';
import type { SelectableContrastTheme } from './constants';

export interface AccessibilityCopy {
  toolbar: {
    region: string;
    readAloud: string;
    pauseReading: string;
    read: string;
    previousSentence: string;
    nextSentence: string;
    stopReading: string;
    decreaseText: string;
    increaseText: string;
    spacingLabel: string;
    spacing: string;
    rulerLabel: string;
    ruler: string;
    appearanceLabel: string;
    appearance: string;
    /**
     * The other language, named in the current one (owner rule: no Chinese character in English
     * mode), and the spoken label of the switch.
     */
    language: string;
    languageLabel: string;
    resetLabel: string;
    reset: string;
    close: string;
    noSpeech: string;
  };
  launcher: string;
  panelDone: string;
  contrast: {
    title: string;
    description: string;
    groupLabel: string;
    /** Spoken after the active mode's name. */
    pressAgain: string;
    /** Spoken and `aria-label` wording, where the mode needs describing rather than naming. */
    labels: Record<SelectableContrastTheme, string>;
    /** Button faces: short enough for every mode to sit side by side. */
    shortLabels: Record<SelectableContrastTheme, string>;
  };
  launcherToggle: { title: string; description: string; switchLabel: string };
  speech: {
    /**
     * Said before the navigation pass. The reader finishes the page, then describes the top bar,
     * because a visitor who cannot see it needs to be told the chrome exists and what opens it.
     */
    navigationPreamble: string;
    accountMenuHint: string;
    accountMenuOpen: string;
  };
}

/** Every word the accessibility tools show or say, in both languages. */
export const ACCESSIBILITY_COPY: SiteCopy<AccessibilityCopy> = {
  en: {
    toolbar: {
      region: 'Accessibility tools',
      readAloud: 'Read this page aloud',
      pauseReading: 'Pause reading',
      read: 'Read',
      previousSentence: 'Previous sentence',
      nextSentence: 'Next sentence',
      stopReading: 'Stop reading',
      decreaseText: 'Decrease text size',
      increaseText: 'Increase text size',
      spacingLabel: 'Increase letter and line spacing',
      spacing: 'Spacing',
      rulerLabel: 'Show a reading ruler',
      ruler: 'Ruler',
      appearanceLabel: 'Themes and reading colours',
      appearance: 'Theme',
      language: 'Chinese',
      languageLabel: 'Switch to Chinese',
      resetLabel: 'Reset accessibility settings',
      reset: 'Reset',
      close: 'Close accessibility tools',
      noSpeech: 'Reading aloud is not available in this browser.',
    },
    launcher: 'Open accessibility tools',
    panelDone: 'Done',
    contrast: {
      title: 'Reading colours',
      description:
        'High contrast modes for reading. These replace the app theme until you turn them off or pick a theme above.',
      groupLabel: 'Reading colour mode',
      pressAgain: '. Press again to turn it off',
      labels: {
        dark: 'High contrast dark',
        light: 'High contrast light',
        yellow: 'Yellow on black',
        grayscale: 'Greyscale',
      },
      shortLabels: { dark: 'Dark', light: 'Light', yellow: 'Yellow', grayscale: 'Grey' },
    },
    launcherToggle: {
      title: 'Accessibility button',
      description:
        'Shows a floating button that opens reading tools: text size, colours, fonts, spacing, a reading ruler, and read aloud.',
      switchLabel: 'Show the accessibility button',
    },
    speech: {
      navigationPreamble: 'End of page content. This is the top navigation bar.',
      accountMenuHint:
        'At the end of the navigation bar is your account avatar. Select it to open the account menu, which contains Profile, Account Settings, and Log out.',
      accountMenuOpen: 'The account menu is open. It contains:',
    },
  },
  zh: {
    toolbar: {
      region: '无障碍工具',
      readAloud: '朗读本页',
      pauseReading: '暂停朗读',
      read: '朗读',
      previousSentence: '上一句',
      nextSentence: '下一句',
      stopReading: '停止朗读',
      decreaseText: '缩小文字',
      increaseText: '放大文字',
      spacingLabel: '加大字距和行距',
      spacing: '间距',
      rulerLabel: '显示阅读标尺',
      ruler: '标尺',
      appearanceLabel: '主题和阅读颜色',
      appearance: '主题',
      language: '英文',
      languageLabel: '切换到英文',
      resetLabel: '重置无障碍设置',
      reset: '重置',
      close: '关闭无障碍工具',
      noSpeech: '此浏览器不支持朗读。',
    },
    launcher: '打开无障碍工具',
    panelDone: '完成',
    contrast: {
      title: '阅读颜色',
      description:
        '方便阅读的高对比度模式。开启后会替代网站主题，直到你关闭它或在上方选择一个主题。',
      groupLabel: '阅读颜色模式',
      pressAgain: '。再按一次可关闭',
      labels: {
        dark: '高对比度深色',
        light: '高对比度浅色',
        yellow: '黑底黄字',
        grayscale: '灰度',
      },
      shortLabels: { dark: '深色', light: '浅色', yellow: '黄字', grayscale: '灰度' },
    },
    launcherToggle: {
      title: '无障碍按钮',
      description:
        '显示一个浮动按钮，用来打开阅读工具：文字大小、颜色、字体、间距、阅读标尺和朗读。',
      switchLabel: '显示无障碍按钮',
    },
    speech: {
      navigationPreamble: '页面内容结束。下面是顶部导航栏。',
      accountMenuHint:
        '导航栏最后是你的头像。选择它可以打开账户菜单，里面有个人资料、账户设置和退出登录。',
      accountMenuOpen: '账户菜单已打开，里面有：',
    },
  },
};
