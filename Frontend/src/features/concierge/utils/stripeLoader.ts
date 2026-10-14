import { loadStripe, type Stripe } from '@stripe/stripe-js';

/**
 * Stripe.js for a publishable key, loaded once per key and shared, as Stripe asks: loading it
 * again for every render would create a new card form each time.
 */
const stripeByKey = new Map<string, Promise<Stripe | null>>();

export const stripeFor = (publishableKey: string): Promise<Stripe | null> => {
  const loaded = stripeByKey.get(publishableKey) ?? loadStripe(publishableKey);
  stripeByKey.set(publishableKey, loaded);
  return loaded;
};
