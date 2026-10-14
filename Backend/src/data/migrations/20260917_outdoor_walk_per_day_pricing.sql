-- Outdoor Walk moves from "per walk" (pet parent picks a number of walks)
-- to "per day" (charged once per night/day of the stay, same as Extra
-- Playtime and Medication Administration). Price is unchanged.
--
-- Existing booking_pets_services rows for Outdoor Walk keep whatever
-- quantity was recorded at booking time; the admin bookings API computes
-- `frequency` from the service's *current* price_unit, so historical
-- bookings will now show nights instead of the walk count that was
-- actually charged. price_at_booking (what was actually charged) is
-- unaffected — this only changes how the historical frequency is displayed.
UPDATE services
SET price_unit = 'per day'
WHERE name = 'Outdoor Walk' AND price_unit = 'per walk';
