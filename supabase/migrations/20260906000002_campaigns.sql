-- A record of marketing emails sent to the lead list.
--
-- Chris and the other admin are trusting Leander to run this business's
-- marketing, and until now a campaign left no trace they could see: the send
-- happened from a script and the only evidence was in someone's terminal. This
-- table is what lets the owners open the dashboard and see that an email went
-- out, to how many people, with what offer.
--
-- Results are NOT stored here. Bookings and Stripe sessions are the truth for
-- conversions and they already exist; duplicating counts into this table would
-- create a second number that drifts from the first.

CREATE TABLE IF NOT EXISTS public.campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  promo_code    text,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  recipients    integer NOT NULL DEFAULT 0,
  failed        integer NOT NULL DEFAULT 0,
  subject       text,
  notes         text,
  sent_by       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.campaigns IS
  'One row per marketing email send. Read by the admin dashboard so the owners can see what went out and when.';
COMMENT ON COLUMN public.campaigns.recipients IS
  'How many addresses the send actually went to, after removing owners, duplicates, and customers who already booked.';
COMMENT ON COLUMN public.campaigns.promo_code IS
  'The code in the email, e.g. LABORDAY15. Joins to Stripe metadata.promoCode, which is how conversions are counted.';

CREATE INDEX IF NOT EXISTS campaigns_sent_at_idx ON public.campaigns (sent_at DESC);

-- Every public table gets RLS. All access here is through the admin edge
-- function with the service role, which bypasses RLS, so no policies are
-- needed and none are granted to anon.
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
