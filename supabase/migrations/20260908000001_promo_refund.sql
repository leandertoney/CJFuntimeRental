-- Records a promo discount refunded AFTER the fact, from the admin dashboard.
--
-- A customer with a valid FIRST10 code could not find the promo field on
-- checkout (it was collapsed behind a link until 2026-09-08) and paid full
-- price. Honouring the code then meant an owner opening Stripe and typing an
-- amount by hand, which is both a chore and a place to fat-finger a number.
--
-- These columns let the admin press one button, and leave a record of WHY the
-- money moved, which a bare Stripe refund does not.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS promo_refunded_cents integer,
  ADD COLUMN IF NOT EXISTS promo_refunded_at    timestamptz,
  ADD COLUMN IF NOT EXISTS promo_refunded_by    text,
  ADD COLUMN IF NOT EXISTS promo_refund_id      text,
  ADD COLUMN IF NOT EXISTS promo_refund_pct     integer;

COMMENT ON COLUMN public.bookings.promo_refunded_cents IS
  'Amount refunded as a missed promo discount. Computed server-side from the Stripe line items (rental only, never the deposit or a delivery fee), never typed by hand.';
COMMENT ON COLUMN public.bookings.promo_refunded_at IS
  'Set once. The endpoint refuses a second refund on the same booking, and the Stripe request carries an idempotency key tied to the booking id as a backstop.';
