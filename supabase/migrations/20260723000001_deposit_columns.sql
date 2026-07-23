-- $100 refundable reservation deposit (client request 2026-07-18)
-- Deposit is charged as a separate Stripe line item at checkout and refunded
-- from the admin panel after the vehicle is returned.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_cents integer DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_refunded_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_refund_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_refunded_by text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent text;
