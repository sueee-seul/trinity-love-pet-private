import type { SiteLanguage } from '../i18n/siteLanguage';
import { illustrationSizes } from './illustrationSizes';

const labels = {
  'daily-routine-overview': ['Daily care', '日常护理'],
  'meals-and-water': ['Meals and fresh water', '餐食与饮水'],
  'walk-and-activity': ['Walks and activity', '散步与活动'],
  'supervised-play': ['Play and enrichment', '玩耍与互动'],
  'quiet-rest': ['Quiet rest', '安静休息'],
  'booking-introduce': ['Tell us about your pet', '介绍你的宠物'],
  'booking-choose': ['Take a combo', '选个组合'],
  'booking-submit': ['Book in one go', '一步订好'],
  'booking-arrive': ['Arrive with your pet', '送宠物入住'],
  'get-ready': ['Prepare for the stay', '入住准备'],
  'cat-play': ['Indoor play for cats', '猫咪室内活动'],
  'cat-rest': ['A quiet place for cats', '猫咪安静休息'],
  grooming: ['Grooming or a bath', '美容或洗澡'],
  'empty-pets': ['Add your first pet', '添加第一只宠物'],
  'empty-stays': ['Plan a first stay', '规划第一次住宿'],
  'empty-care': ['Waiting for care updates', '等待护理动态'],
  assistant: ['AI booking assistant', 'AI 预约助手'],
  welcome: ['Welcome to Wagstay', '欢迎来到 Wagstay'],
} as const;

export type IllustrationName = keyof typeof labels;

interface IllustrationAsset {
  src: string;
  label: string;
  aiLabel: string;
  alt: string;
  width: number;
  height: number;
}

/** Static concept artwork only; never resolves a pet photo or a care-evidence attachment. */
export function illustrationAsset(
  name: IllustrationName,
  language: SiteLanguage,
): IllustrationAsset {
  const label = labels[name][language === 'zh' ? 1 : 0];
  const aiLabel = language === 'zh' ? 'AI 插画' : 'AI illustration';
  const [width, height] = illustrationSizes[name];
  return {
    src: `/illustrations/care/${name}.webp`,
    label,
    aiLabel,
    alt: `${aiLabel}: ${label}`,
    width,
    height,
  };
}
