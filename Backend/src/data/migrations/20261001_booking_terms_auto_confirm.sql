-- Data only. Apply after 20260930_booking_terms_manager_review.sql: stays are confirmed at once
-- unless a manager checks them first. Existing agreements keep the version they agreed to.
BEGIN;
DO $migration$
DECLARE
  terms_text CONSTANT TEXT := $terms$Wagstay booking terms, version concierge-terms-2026-10-01

1. Your booking
When you send your booking, each pet's stay is confirmed at once if there is room. Our manager checks a stay before confirming it if the pet takes medication, has behaviour or health needs you tell us about, is staying with us for the first time, or stays more than 14 nights. A stay waiting for that check is not booked yet. Pets we cannot take are not charged.

2. Price and card
Your total includes GST, with no booking or card fee. Stripe holds the card details; Wagstay does not store the full card number. You authorise holds and charges for this booking under these rules. We hold only confirmed pets' prices from 48 hours before drop-off, and capture at check-in. A released hold is not a refund; your bank decides when it disappears.

3. Cancellation
A stay waiting for our manager's check can be withdrawn free before drop-off. For each confirmed pet, cancellation is free at least 72 hours before drop-off, within 2 hours of confirmation, or within 24 hours of confirmation if it was confirmed at least 72 hours before drop-off. Otherwise the fee is that pet's first night of recurring services, excluding flat extras and capped at its total. No-shows and vaccination proof not supplied on drop-off day incur the same first-night fee, only after staff record the outcome. The rest of the hold is released. Cancellation is available in My Stays before drop-off, with the fee shown before confirmation.

4. Changing dates and exceptions
One free date change may be requested before drop-off to dates within 12 months, subject to capacity, at the booked rates. A date change you make releases the old hold and needs manager reapproval. For a civil defence emergency or MetService red warning on drop-off day, contact the team for a fee waiver. A vet-certified sick pet may be moved free without using the free change. If Wagstay cannot take your pet, the hold is released in full, or an amount already charged is refunded.

5. Vaccinations
Bring current vaccination proof showing vaccination dates and next due dates. Wagstay requires C5 for dogs and F3 for cats as its own policy. Staff assess each pet on arrival.

6. Emergency veterinary consent
By agreeing online, you authorise Wagstay to arrange veterinary treatment if your pet becomes ill or injured and we cannot reach you, up to NZ$500. We will try to contact you and seek further authorisation for costs above that amount. This limit does not remove our animal-welfare duties. This consent is recorded with your account name, agreement time and terms version; no second signature is needed for this booking.

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
