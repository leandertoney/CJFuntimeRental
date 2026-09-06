-- Let the owner permanently clear an item off the dashboard attention queue.
--
-- The queue flags things that look unresolved: a deposit still held after the
-- vehicle came back, an ID missing before pickup. Some of those are settled
-- deliberately off-system. A real case: a $100 deposit is intentionally still
-- held because Chris worked out a deal with that renter. The queue had no way
-- to know, so it nagged him about a decision he had already made.
--
-- A queue that shows resolved items is a queue people stop reading, which
-- defeats the point of surfacing the genuinely urgent ones.
--
-- The note is required by the UI rather than the schema: recording WHY keeps
-- the history on the booking, so a later reader (or the other admin) can tell
-- "handled offline" from "not actually a problem".
--
-- Nullable throughout: every existing booking predates this and is undismissed
-- by definition. Idempotent (IF NOT EXISTS) - safe to run on every deploy.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS attention_dismissed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS attention_dismissed_by   text,
  ADD COLUMN IF NOT EXISTS attention_dismissed_note text;

COMMENT ON COLUMN public.bookings.attention_dismissed_at IS
  'Set when an admin permanently clears this booking from the dashboard attention queue. NULL = still eligible to surface.';
COMMENT ON COLUMN public.bookings.attention_dismissed_by IS
  'Admin email that dismissed it.';
COMMENT ON COLUMN public.bookings.attention_dismissed_note IS
  'Why it was dismissed, e.g. "deal worked out with renter". Kept so the decision is not lost.';

-- The dashboard reads the small set of undismissed bookings on every load.
CREATE INDEX IF NOT EXISTS bookings_attention_open_idx
  ON public.bookings (end_date DESC)
  WHERE attention_dismissed_at IS NULL;
