/**
 * A typed reply that confirms the booking card, in either language. Kept strict on purpose: only a
 * short, plain "confirm" counts, so a longer message that happens to contain "yes" is sent to the
 * assistant as usual and never books anything.
 */
const CONFIRM_REPLY =
  /^(?:yes,?\s*)?(?:confirm|confirmed|confirm (?:it|the booking|booking|my booking)|book it)[.!]?$|^(?:好的?[，,]?\s*)?(?:确认|确认预订|确认预定|确定|就这样订)[。！!]?$/i;

export const isConfirmReply = (text: string): boolean => CONFIRM_REPLY.test(text.trim());
