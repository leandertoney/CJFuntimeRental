-- Where did each booking come from?
--
-- Until now `bookings` had 48 columns and none of them answered "which channel
-- earned this customer". So a real paying booking could not be tied back to
-- search, a Facebook post, or word of mouth, and no conversion rate could be
-- computed for any channel.
--
-- These columns are FIRST TOUCH: the source recorded is the one that originally
-- brought the visitor to the site, not the last page they clicked. See
-- attribution.js for how the value is captured and why.
--
-- Nullable throughout: every existing booking predates this, and a visitor with
-- localStorage disabled records nothing rather than blocking a sale.
--
-- Idempotent (IF NOT EXISTS throughout) - safe to run on every deploy.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS attr_source       text,
  ADD COLUMN IF NOT EXISTS attr_medium       text,
  ADD COLUMN IF NOT EXISTS attr_campaign     text,
  ADD COLUMN IF NOT EXISTS attr_landing_page text,
  ADD COLUMN IF NOT EXISTS attr_first_seen   timestamptz;

-- Same for tours. `source` already exists there but records the FORM used
-- (tours-page vs direct-booking), which is a different question from which
-- channel the guest arrived through.
ALTER TABLE public.tour_requests
  ADD COLUMN IF NOT EXISTS attr_source       text,
  ADD COLUMN IF NOT EXISTS attr_medium       text,
  ADD COLUMN IF NOT EXISTS attr_campaign     text,
  ADD COLUMN IF NOT EXISTS attr_landing_page text,
  ADD COLUMN IF NOT EXISTS attr_first_seen   timestamptz;

-- Channel reporting reads by source over a date range.
CREATE INDEX IF NOT EXISTS bookings_attr_source_idx
  ON public.bookings (attr_source, created_at DESC)
  WHERE attr_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS tour_requests_attr_source_idx
  ON public.tour_requests (attr_source, created_at DESC)
  WHERE attr_source IS NOT NULL;
