-- Email dedup: stamp bookings when each automated email fires so a cron
-- re-run (or a reschedule landing back inside a send window) can never
-- double-send. NULL = not yet sent.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_instructions_sent_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS midrental_checkin_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.pickup_reminder_sent_at IS 'When send-pickup-reminders emailed this booking (dedup guard)';
COMMENT ON COLUMN bookings.return_instructions_sent_at IS 'When send-return-instructions emailed this booking (dedup guard)';
COMMENT ON COLUMN bookings.midrental_checkin_sent_at IS 'When send-mid-rental-checkins emailed this booking (dedup guard)';
