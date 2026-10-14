import type { Service, ServiceCategory } from '../../pet-parent/types/booking';
import type { ConciergeCopy } from '../copy';

/**
 * The published price list in the three groups a guest reads it by: rooms, food and extras. The
 * /book rate card and the landing page's price list both use it, so the two never group or name
 * the same catalogue differently. Empty groups are left out.
 */
export interface RateCardGroup {
  title: string;
  items: Service[];
}

type RateCardGroupName = 'rooms' | 'food' | 'extras';

const GROUPS: ReadonlyArray<{ category: ServiceCategory; title: RateCardGroupName }> = [
  { category: 'boarding_rate', title: 'rooms' },
  { category: 'food', title: 'food' },
  { category: 'addon', title: 'extras' },
];

export const rateCardGroups = (copy: ConciergeCopy, catalogue: Service[]): RateCardGroup[] =>
  GROUPS.map(({ category, title }) => ({
    title: copy.rates[title],
    items: catalogue.filter((service) => service.category === category),
  })).filter((group) => group.items.length > 0);
