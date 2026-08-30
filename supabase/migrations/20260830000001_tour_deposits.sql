-- Direct tour booking: pay the $250 deposit online instead of waiting for a
-- manual Stripe link.
--
-- This does NOT replace the request flow. Odd group sizes have no published
-- price (the tiers are 2/4/6/8 only), so those still go through the request
-- form and Chris quotes by hand. Even sizes can now pay on the spot.
--
-- Nothing here touches `bookings` or the rental money path. A paid tour lives
-- in `tour_requests` plus the `vehicle_blocks` rows that hold its cars.
--
-- Idempotent (IF NOT EXISTS throughout) - safe to run on every deploy.

ALTER TABLE public.tour_requests
  ADD COLUMN IF NOT EXISTS stripe_session_id  text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text,
  ADD COLUMN IF NOT EXISTS deposit_cents      integer,
  ADD COLUMN IF NOT EXISTS deposit_paid_at    timestamptz;

-- A Stripe session must map to exactly one tour request, so a webhook retry
-- (Stripe delivers at-least-once) cannot create a second paid tour.
CREATE UNIQUE INDEX IF NOT EXISTS tour_requests_stripe_session_idx
  ON public.tour_requests (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- `source` records how the request arrived. 'tours-page' is the request form;
-- 'direct-booking' means the guest paid the deposit online.
--
-- Status flow is unchanged for requests. A direct booking jumps straight to
-- 'paid' when the webhook confirms the deposit, so no new status value is
-- needed and the existing CHECK constraint still holds.

-- The vehicle_blocks rows a paid tour creates are tagged so they can be found
-- and released if the tour is cancelled. Nullable: rental blocks have no tour.
ALTER TABLE public.vehicle_blocks
  ADD COLUMN IF NOT EXISTS tour_request_id uuid;

CREATE INDEX IF NOT EXISTS vehicle_blocks_tour_request_idx
  ON public.vehicle_blocks (tour_request_id)
  WHERE tour_request_id IS NOT NULL;
