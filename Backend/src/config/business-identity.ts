/**
 * Who the receipts and notices come from. A receipt for a service in New Zealand names the
 * supplier and, over $200 on request, carries taxable supply information (GST Act s 19K); the
 * Australian Consumer Law s 100 wants supplier, ABN, date, services and price on every proof of
 * transaction for $75 or more. The values come from the environment; until the owner supplies
 * them the placeholders say so instead of inventing a company.
 */

export interface BusinessIdentity {
  legalName: string;
  /** NZ GST number or AU ABN, as the owner registered it. */
  taxNumber: string;
  address: string | null;
  /** True while a placeholder is shown, so a launch check can refuse to go live. */
  placeholder: boolean;
}

const LEGAL_NAME_PLACEHOLDER = 'Wagstay (legal name to be confirmed)';
const TAX_NUMBER_PLACEHOLDER = 'to be confirmed';

const cleaned = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const readBusinessIdentity = (
  environment: Record<string, string | undefined> = process.env,
): BusinessIdentity => {
  const legalName = cleaned(environment.BUSINESS_LEGAL_NAME);
  const taxNumber = cleaned(environment.BUSINESS_TAX_NUMBER);
  return {
    legalName: legalName ?? LEGAL_NAME_PLACEHOLDER,
    taxNumber: taxNumber ?? TAX_NUMBER_PLACEHOLDER,
    address: cleaned(environment.BUSINESS_ADDRESS),
    placeholder: legalName === null || taxNumber === null,
  };
};

/** New Zealand GST is 15%: the GST inside a GST-inclusive amount is 3/23 of it. */
export const gstIncludedIn = (amount: number): number =>
  Math.round(((amount * 3) / 23) * 100) / 100;

/**
 * The lines under a receipt: supplier, tax number, date, and the GST inside the amount. Written
 * once here so every charge and refund email reads the same.
 */
export const receiptLines = (
  amount: number,
  at: Date,
  environment: Record<string, string | undefined> = process.env,
): string => {
  const identity = readBusinessIdentity(environment);
  const date = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(at);
  const money = `$${Math.abs(amount).toFixed(2)} NZD (includes GST of $${gstIncludedIn(Math.abs(amount)).toFixed(2)})`;
  return [
    `${amount < 0 ? 'Refunded' : 'Charged'}: ${money}`,
    `Date: ${date}`,
    `Supplier: ${identity.legalName}`,
    `GST number: ${identity.taxNumber}`,
    ...(identity.address ? [`Address: ${identity.address}`] : []),
    'Keep this email as your receipt. Ask us for an itemised bill at any time.',
  ].join('\n');
};
