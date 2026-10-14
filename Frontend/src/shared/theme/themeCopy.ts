import type { SiteCopy } from '../i18n/siteLanguage';
import type { ThemeCardTagLabels } from './components/ThemeCard';
import type { BrandTheme, BrandThemeFamily } from './constants';

export interface ThemeCopy {
  /** Shown in every picker and used for the card's accessible name. */
  names: Record<BrandTheme, string>;
  /** The line under the preview that says what the theme looks like. */
  blurbs: Record<BrandTheme, string>;
  families: Record<BrandThemeFamily, string>;
  familyBlurbs: Record<BrandThemeFamily, string>;
  tags: ThemeCardTagLabels;
  picker: { title: string; description: string; preview: string; legend: string };
}

/**
 * Every word about the themes, in both languages. The landing page and the settings picker both
 * read their names from here, so a theme is never called two things.
 */
export const THEME_COPY: SiteCopy<ThemeCopy> = {
  en: {
    names: {
      // Named for what it is rather than for its colour: the reading colours carry the "Apricot"
      // name instead. It was "Default" until Strawberry Cream became the look visitors start in.
      simple: 'Simple',
      'plain-light': 'Paper',
      'plain-dark': 'Slate',
      strawberry: 'Strawberry Cream',
      'milk-cream': 'Milk Cream',
      moonlight: 'Moonlight Sleepover',
      garden: 'Mint Secret Garden',
      royal: 'Le Petit Palais',
      noir: 'Maison Noir',
    },
    blurbs: {
      simple: 'The original apricot palette.',
      'plain-light': 'Warm grey on white.',
      'plain-dark': 'Low-light neutral dark.',
      strawberry: 'Strawberry cream, bows and a soft hand-drawn edge.',
      'milk-cream': 'Cream, caramel and cream puffs in a gilded rococo frame.',
      moonlight: 'Indigo night, lavender and warm starlight.',
      garden: 'Sage green, daisies and a plant journal.',
      royal: 'Emerald and champagne gold, with pearl and rose detailing.',
      noir: 'Black velvet and champagne gold, in art deco lines.',
    },
    families: { romantic: 'Romantic', luxury: 'Luxury', minimal: 'Minimal' },
    familyBlurbs: {
      romantic: 'Soft colours, sweets and flowers.',
      luxury: 'Deep colours and gold.',
      minimal: 'Plain colours, no picture.',
    },
    tags: { defaultLook: 'Default', nightMode: 'Night mode' },
    picker: {
      title: 'Theme',
      description:
        'Changes the colours across the whole app. Picking one turns off any reading colour below.',
      preview: 'Preview',
      legend: 'App theme',
    },
  },
  zh: {
    names: {
      simple: '简约',
      'plain-light': '纸白',
      'plain-dark': '石板',
      strawberry: '草莓奶油',
      'milk-cream': '奶香甜点',
      moonlight: '月光睡衣派对',
      garden: '薄荷秘密花园',
      royal: '小王宫',
      noir: '黑金公馆',
    },
    blurbs: {
      simple: '最初的杏色配色。',
      'plain-light': '白底配暖灰色。',
      'plain-dark': '适合弱光的中性深色。',
      strawberry: '草莓奶油、蝴蝶结和柔和的手绘边框。',
      'milk-cream': '奶油、焦糖和泡芙，配金色洛可可边框。',
      moonlight: '靛蓝夜空、薰衣草紫和温暖的星光。',
      garden: '鼠尾草绿、小雏菊和植物手账。',
      royal: '祖母绿配香槟金，点缀珍珠和玫瑰。',
      noir: '黑丝绒配香槟金，装饰艺术风格的线条。',
    },
    families: { romantic: '浪漫', luxury: '奢华', minimal: '极简' },
    familyBlurbs: {
      romantic: '柔和的颜色、甜点和花朵。',
      luxury: '深色调配金色。',
      minimal: '纯色，没有插图。',
    },
    tags: { defaultLook: '默认', nightMode: '夜间模式' },
    picker: {
      title: '主题',
      description: '更改整个网站的颜色。选择主题会关闭下方的阅读颜色。',
      preview: '预览',
      legend: '网站主题',
    },
  },
};
