import { serviceNameText } from '../../../concierge/utils/serviceNames';
import type { PortalLocale } from '../../i18n/portalLocale';
import type { StayServiceLine } from '../../types/stays';
import { STAYS_COPY } from './staysCopy';

// How a stay's money reads on the booking details and the boarding pass, so the two never differ.

/** "Extra walk × 2"; a single item is just its name. */
export function serviceLineLabel(
  line: Pick<StayServiceLine, 'name' | 'quantity'>,
  locale: PortalLocale = 'en',
): string {
  const name = serviceNameText(line.name, locale);
  return line.quantity > 1 ? `${name} × ${line.quantity}` : name;
}

/** "$240.00" */
export function formatStayAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** A line's price across the stay. A line at $0 is part of the package, so it says so. */
export function formatServiceLinePrice(amount: number, locale: PortalLocale = 'en'): string {
  return amount === 0 ? STAYS_COPY[locale].shared.included : formatStayAmount(amount);
}
