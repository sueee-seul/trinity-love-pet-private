-- The booking terms for the card-guaranteed instant booking, as the current terms version.
--
-- Why: every booking records the terms version it was made under (bookings_agreements). From this
-- branch on, a booking saves a card, holds the price 48 hours before drop-off and charges fees on
-- the rules the owner set on 2026-09-29, so the recorded terms must say exactly that. Stripe also
-- names the cancellation policy shown before purchase as the evidence that wins a dispute.
--
-- Data only: no table or column changes. It runs after 20260929_card_guarantee_and_check_in.sql.
-- Safe to run more than once: the version line below is looked for before anything is written.
-- Have a lawyer read the wording before the business takes real payments.

BEGIN;

DO $migration$
DECLARE
  terms_text CONSTANT TEXT := $terms$Wagstay booking terms, version 2026-09-29

1. Your booking
Your stay is booked when you send your details and every night has room. You will see a booking reference straight away.

2. Price
The total you agree to includes GST. There is no booking fee and no card fee.

3. Your card
When you book, you save a card with our payment provider, Stripe. Wagstay never sees or stores your full card number. You authorise Wagstay to hold and charge that card for this booking only, as set out in these terms.
- Nothing is charged when you book.
- We hold the full price on your card 48 hours before drop-off. If you book less than 48 hours before drop-off, we hold it when you book.
- We charge the hold when you check in. Your bank may show the hold as pending until then.
- A hold we release is not a charge. How fast it disappears from your statement is up to your bank.

4. Cancelling
- Cancel 72 hours or more before drop-off: free.
- Cancel within 24 hours of booking, if you booked 72 hours or more before drop-off: free.
- Cancel later: we charge 50% of the total and release the rest.

5. Drop-off day
Please bring your pet's current vaccination certificate (C5 for dogs, F3 for cats) and sign our emergency vet consent at the desk. If you do not come on drop-off day, or you cannot give us the certificate or sign the consent that day, we charge 50% of that pet's price and release the rest.

6. Changing your dates
You can move your stay once for free, before the drop-off time, to dates within 12 months, if those nights have room. The new dates are priced again.

7. When we waive the fee
We do not charge a cancellation fee if there is a civil defence emergency or a MetService red warning where you are on drop-off day. If a vet says your pet is too unwell to board, we move your stay for free, and this does not use your free date change.

8. If we cannot take your pet
If Wagstay cannot take your pet for a reason on our side, we release the hold in full, or refund anything already charged. We never offer only a credit.

9. Your rights
Nothing in these terms limits your rights under the Consumer Guarantees Act 1993 or the Fair Trading Act 1986.$terms$;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM terms_versions
    WHERE content LIKE 'Wagstay booking terms, version 2026-09-29%'
  ) THEN
    UPDATE terms_versions SET is_current = false WHERE is_current;
    INSERT INTO terms_versions (content, is_current) VALUES (terms_text, true);
  END IF;
END
$migration$;

COMMIT;
