import type { PortalLocale } from '../i18n/portalLocale';

/*
 * A pet's breed in the page's language. Parents type the breed themselves, in either language, so
 * the common ones are named both ways here. A breed this list does not know, written in the other
 * language, is shown as the pet's species instead (the way an unknown care task is shown as its
 * kind of care), so a page never mixes its two languages.
 */

interface BreedName {
  en: string;
  zh: string;
}

const BREEDS: readonly BreedName[] = [
  // Dogs
  { en: 'Labrador Retriever', zh: '拉布拉多寻回犬' },
  { en: 'Labrador', zh: '拉布拉多' },
  { en: 'Golden Retriever', zh: '金毛寻回犬' },
  { en: 'German Shepherd', zh: '德国牧羊犬' },
  { en: 'Border Collie', zh: '边境牧羊犬' },
  { en: 'Poodle', zh: '贵宾犬' },
  { en: 'Toy Poodle', zh: '玩具贵宾犬' },
  { en: 'Miniature Poodle', zh: '迷你贵宾犬' },
  { en: 'Cavoodle', zh: '卡沃犬' },
  { en: 'Labradoodle', zh: '拉布拉多贵宾犬' },
  { en: 'Groodle', zh: '金毛贵宾犬' },
  { en: 'Cavalier King Charles Spaniel', zh: '查理士王小猎犬' },
  { en: 'Cocker Spaniel', zh: '可卡犬' },
  { en: 'Beagle', zh: '比格犬' },
  { en: 'Bulldog', zh: '斗牛犬' },
  { en: 'French Bulldog', zh: '法国斗牛犬' },
  { en: 'Pug', zh: '巴哥犬' },
  { en: 'Dachshund', zh: '腊肠犬' },
  { en: 'Shih Tzu', zh: '西施犬' },
  { en: 'Maltese', zh: '马尔济斯犬' },
  { en: 'Bichon Frise', zh: '比熊犬' },
  { en: 'Pomeranian', zh: '博美犬' },
  { en: 'Chihuahua', zh: '吉娃娃' },
  { en: 'Yorkshire Terrier', zh: '约克夏梗' },
  { en: 'Jack Russell Terrier', zh: '杰克罗素梗' },
  { en: 'Staffordshire Bull Terrier', zh: '斯塔福郡斗牛梗' },
  { en: 'Schnauzer', zh: '雪纳瑞' },
  { en: 'Miniature Schnauzer', zh: '迷你雪纳瑞' },
  { en: 'Siberian Husky', zh: '西伯利亚哈士奇' },
  { en: 'Husky', zh: '哈士奇' },
  { en: 'Samoyed', zh: '萨摩耶' },
  { en: 'Shiba Inu', zh: '柴犬' },
  { en: 'Akita', zh: '秋田犬' },
  { en: 'Corgi', zh: '柯基' },
  { en: 'Pembroke Welsh Corgi', zh: '彭布罗克威尔士柯基犬' },
  { en: 'Australian Shepherd', zh: '澳大利亚牧羊犬' },
  { en: 'Huntaway', zh: '新西兰亨特威犬' },
  { en: 'Boxer', zh: '拳师犬' },
  { en: 'Rottweiler', zh: '罗威纳犬' },
  { en: 'Doberman', zh: '杜宾犬' },
  { en: 'Great Dane', zh: '大丹犬' },
  { en: 'Greyhound', zh: '灵缇' },
  { en: 'Whippet', zh: '惠比特犬' },
  { en: 'Bernese Mountain Dog', zh: '伯恩山犬' },
  { en: 'Chow Chow', zh: '松狮犬' },
  { en: 'Shetland Sheepdog', zh: '喜乐蒂牧羊犬' },
  { en: 'Mixed Breed', zh: '混种' },
  // Cats
  { en: 'Domestic Shorthair', zh: '家养短毛猫' },
  { en: 'Domestic Longhair', zh: '家养长毛猫' },
  { en: 'Domestic Mediumhair', zh: '家养中毛猫' },
  { en: 'British Shorthair', zh: '英国短毛猫' },
  { en: 'American Shorthair', zh: '美国短毛猫' },
  { en: 'Ragdoll', zh: '布偶猫' },
  { en: 'Maine Coon', zh: '缅因猫' },
  { en: 'Persian', zh: '波斯猫' },
  { en: 'Siamese', zh: '暹罗猫' },
  { en: 'Bengal', zh: '孟加拉猫' },
  { en: 'Scottish Fold', zh: '苏格兰折耳猫' },
  { en: 'Sphynx', zh: '斯芬克斯无毛猫' },
  { en: 'Russian Blue', zh: '俄罗斯蓝猫' },
  { en: 'Burmese', zh: '缅甸猫' },
  { en: 'Birman', zh: '伯曼猫' },
  { en: 'Abyssinian', zh: '阿比西尼亚猫' },
  { en: 'Norwegian Forest Cat', zh: '挪威森林猫' },
  { en: 'Exotic Shorthair', zh: '异国短毛猫' },
  { en: 'Devon Rex', zh: '德文卷毛猫' },
];

const CHINESE = /[㐀-鿿豈-﫿]/;
const LATIN = /[A-Za-z]/;

const keyOf = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, ' ');

const byEnglish = new Map(BREEDS.map((breed) => [keyOf(breed.en), breed]));
const byChinese = new Map(BREEDS.map((breed) => [breed.zh, breed]));

/**
 * The breed as the page's reader reads it, or `species` (already in the page's language) when the
 * breed is in the other language and not one this list names. Empty breeds give `species` too.
 */
export function breedText(
  breed: string | null | undefined,
  locale: PortalLocale,
  species: string,
): string {
  const written = breed?.trim() ?? '';
  if (!written) return species;
  const known = byEnglish.get(keyOf(written)) ?? byChinese.get(written);
  if (known) return known[locale];
  const otherLanguage = locale === 'zh' ? LATIN : CHINESE;
  return otherLanguage.test(written) ? species : written;
}
