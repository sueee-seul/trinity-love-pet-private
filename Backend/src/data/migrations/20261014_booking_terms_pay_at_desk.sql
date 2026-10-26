-- Data only. Apply after 20261007_booking_terms_in_stay_changes.sql. Owner decision 2026-10-14:
-- nothing is paid or held online. Every request waits for our manager, who approves or declines
-- each pet; the parent pays at the desk after the arrival health check, and changes during the
-- stay are added to the bill paid at pick-up. Cancelling before drop-off is free. Existing
-- agreements keep the version they agreed to. Clauses 5 to 7 are the 2026-10-07 text, unchanged.
BEGIN;
DO $migration$
DECLARE
  terms_text CONSTANT TEXT := $terms$Wagstay booking terms, version concierge-terms-2026-10-14

1. Your booking request
When you send a booking request, nothing is booked and nothing is paid. Our manager checks each pet's request and approves or declines it, at most 24 hours after you send it and never past drop-off. A request that is not decided by then is declined, and we tell you. You hear every answer in your notifications and in the chat. Only an approved stay is booked.

2. Price and payment
Your total includes GST, with no booking fee. Nothing is paid online, and Wagstay does not take or store card details on this site. When you arrive, staff do a quick health check of your pet; you then pay for the approved stay at the desk. Changes during the stay (clause 8) are added to your bill and paid at the desk when you pick up.

3. Cancellation
You can withdraw a request, or cancel an approved stay, free of charge in My Stays before drop-off. If your plans change on the day, please tell the team so we can offer the place to another pet.

4. Changing dates and exceptions
You can change the dates in My Stays before drop-off, to dates within 12 months, subject to capacity, at the booked rates. New dates go back to our manager for approval. If there is a civil defence emergency or a MetService red warning on drop-off day, or a vet certifies your pet as too sick to board, contact the team and we will move or cancel the stay. If Wagstay cannot take your pet, or cancels, you owe nothing.

5. Vaccinations
Bring current vaccination proof showing vaccination dates and next due dates. Wagstay requires C5 for dogs and F3 for cats as its own policy. Staff assess each pet on arrival. A pet without proof still stays with us, kept apart from other pets until its vaccination status is known, at no extra cost.

6. Emergency veterinary consent
You give this consent with its own tick when you send the booking. You authorise Wagstay to arrange veterinary treatment if your pet becomes ill or injured and we cannot reach you, up to NZ$500. We will try to contact you and seek further authorisation for costs above that amount. This limit does not remove our animal-welfare duties. The consent is recorded with your account name, the agreement time and this terms version.

7. Your rights
Nothing in these terms limits your rights under the Consumer Guarantees Act 1993 or Fair Trading Act 1986.

8. Changes while your pet is staying
From check-in to pick-up you can make these changes in My Stays or through the chat. Each shows you the price first, and nothing changes until you confirm it. Nothing is paid online: the amount is added to your bill, which you pay at the desk when you pick up.
- Extending the stay: the extra nights are priced at the rates you booked (the room and any daily food or walk) and need room on those nights. The whole stay stays within 60 nights.
- Add-ons: an extra walk, playtime or grooming for a day, at the price in our list on that day. Staff fit a grooming session in on that day; if we cannot provide an add-on, it comes off your bill.
- Picking up early: the nights your pet will not stay come off your bill, as shown before you confirm. An earlier time on the same day costs nothing.
- Drop-off and pick-up times: you can move the time of day on the booked dates at no cost, so we know when to expect you.
Every change is confirmed in your notifications.$terms$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM terms_versions WHERE split_part(content, E'\n', 1) = split_part(terms_text, E'\n', 1)) THEN
    UPDATE terms_versions SET is_current = false WHERE is_current;
    INSERT INTO terms_versions (content, is_current) VALUES (terms_text, true);
  END IF;
END
$migration$;
COMMIT;
