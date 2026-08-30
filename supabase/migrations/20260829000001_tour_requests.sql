-- Guided group Slingshot TOURS: request-a-date leads.
--
-- V1 is deliberately manual: this table holds a REQUEST, not a booking and not
-- a payment. Chris confirms the date by hand, then a Stripe deposit link is
-- sent separately. Nothing in this table may ever reach the checkout money
-- path, so there is intentionally no amount/total/deposit column here -- the
-- quoted price is derived from group_size on the page and re-stated by Chris.
--
-- Idempotent (IF NOT EXISTS throughout) -- safe to run on every deploy.

CREATE TABLE IF NOT EXISTS public.tour_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  name         text NOT NULL,
  email        text NOT NULL,
  phone        text NOT NULL,
  preferred_date date,
  group_size   integer NOT NULL CHECK (group_size BETWEEN 2 AND 8),
  route        text NOT NULL CHECK (route IN ('north-east-md', 'gettysburg-york')),
  notes        text,
  status       text NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'confirmed', 'deposit_sent', 'paid', 'closed')),
  source       text
);

-- Same posture as the other customer tables on this project: RLS ON with ZERO
-- policies. All access is service-role (the tour-request Edge Function writes,
-- the admin function reads), so anon/authenticated get nothing by construction
-- rather than by a policy that could later be loosened by mistake.
ALTER TABLE public.tour_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tour_requests_created_at_idx
  ON public.tour_requests (created_at DESC);
