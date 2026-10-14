-- Data only. Apply after 20261002_booking_terms_pay_at_request.sql. Owner decisions 2026-10-05:
-- only a pet on medication waits for our manager; three cancellation tiers with no grace or
-- cooling-off window, the one-night tier never more than half a stay; dates change as often as
-- needed before drop-off; a pet without vaccination proof stays, kept apart, at no cost; emergency
-- vet consent is its own tick. Existing agreements keep the version they agreed to.
BEGIN;
DO $migration$
DECLARE
  terms_text CONSTANT TEXT := $terms$Wagstay booking terms, version concierge-terms-2026-10-06

1. Your booking
When you send your booking, we hold its full price on your card. A declined card books nothing. Each pet's stay is confirmed at once if there is room. If a pet takes medication, our manager checks its stay before confirming it. That check takes at most 24 hours, and never past drop-off. A stay waiting for it is not booked yet. If our manager cannot take a pet, or does not decide in time, that pet is not charged.

2. Price and card
Your total includes GST, with no booking or card fee. Stripe holds the card details; Wagstay does not store the full card number. You authorise the hold, the charge and any refund for this booking under these rules. Once every pet on the booking is decided, we charge the price of the confirmed pets and release the rest of the hold. A released hold is not a refund; your bank decides when it disappears. Refunds go back to the same card, usually within 5 to 10 business days, and Wagstay pays any card processing fee on them.

3. Cancellation
A stay waiting for our manager's check can be withdrawn free before drop-off. For each confirmed pet:
- 7 days or more before drop-off: free.
- From 72 hours to 7 days before drop-off: that pet's first night of recurring services, excluding flat extras, and never more than half of its total.
- Less than 72 hours before drop-off: half of that pet's total.
A pet that does not arrive costs half of its total, only after staff record it. If you think we recorded a no-show by mistake, email us within 7 days and we will look at it again. We refund the rest. Cancellation is available in My Stays before drop-off, with the fee shown before you confirm.

4. Changing dates and exceptions
You can change the dates in My Stays as often as you need before drop-off, to dates within 12 months, subject to capacity, at the booked rates. We hold the new price on your card first; once that hold is granted, confirmed pets are charged at the new price and the old payment is released or refunded in full. Our manager's decisions stay as they were. If there is a civil defence emergency or a MetService red warning on drop-off day, you can cancel or move the stay free of charge: contact the team. A pet that a vet certifies as too sick to board may be moved or cancelled free. If Wagstay cannot take your pet, or cancels, the hold is released in full, or an amount already charged is refunded in full.

5. Vaccinations
Bring current vaccination proof showing vaccination dates and next due dates. Wagstay requires C5 for dogs and F3 for cats as its own policy. Staff assess each pet on arrival. A pet without proof still stays with us, kept apart from other pets until its vaccination status is known, at no extra cost.

6. Emergency veterinary consent
You give this consent with its own tick when you send the booking. You authorise Wagstay to arrange veterinary treatment if your pet becomes ill or injured and we cannot reach you, up to NZ$500. We will try to contact you and seek further authorisation for costs above that amount. This limit does not remove our animal-welfare duties. The consent is recorded with your account name, the agreement time and this terms version.

7. Your rights
Nothing in these terms limits your rights under the Consumer Guarantees Act 1993 or Fair Trading Act 1986.$terms$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM terms_versions WHERE split_part(content, E'\n', 1) = split_part(terms_text, E'\n', 1)) THEN
    UPDATE terms_versions SET is_current = false WHERE is_current;
    INSERT INTO terms_versions (content, is_current) VALUES (terms_text, true);
  END IF;
END
$migration$;
COMMIT;
