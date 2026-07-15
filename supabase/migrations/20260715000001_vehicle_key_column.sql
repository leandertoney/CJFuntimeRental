-- Bookings only ever stored the vehicle DISPLAY NAME (e.g. "2016 Polaris
-- Slingshot"), never the internal site_config key. Two fleet vehicles share
-- that exact display name (slingshot_2020 = gray, slingshot_2016_red = red),
-- so any code that matched bookings back to a vehicle by name (the PUT
-- /bookings/:id reschedule conflict check, check-availability) could not
-- tell them apart and had to fuzzy-match, risking false conflicts/misses.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_key TEXT;

COMMENT ON COLUMN bookings.vehicle_key IS 'site_config.vehicles key (e.g. slingshot_2020) — disambiguates vehicles that share a display name. NULL on bookings created before 2026-07-15.';
