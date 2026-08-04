-- Fix the post-rental review email, which has been silently sending NOTHING
-- since bookings.end_date was converted to ISO format (~2026-06-26, by
-- fix-date-formats.js).
--
-- The original selector (20260408000002_followup_cron.sql) matched on a
-- three-letter month name:
--
--     end_date ilike '%' || to_char(now() - interval '1 day', 'Mon%') || '%'
--
-- That worked while end_date held strings like "Fri, Apr 17, 2026". Once every
-- row became "2026-07-19" there is no month name to match, so the FOR loop
-- never executed, net.http_post was never called, and the job "succeeded"
-- every day at 14:00 UTC doing nothing. Verified against live data: zero rows
-- match any of the twelve month abbreviations.
--
-- Two further latent faults fixed at the same time:
--
--   1. current_setting('app.supabase_url') and current_setting(
--      'app.service_role_key') were called WITHOUT the missing_ok argument, so
--      they raise if the setting is unset. Nothing ever reached that line, so
--      this was never observed. The three working email crons
--      (20260622000003) hardcode the URL and use the DIFFERENT setting name
--      'app.supabase_service_role_key' WITH missing_ok => true. This function
--      now mirrors that known-good pattern exactly. (follow-up has
--      verify_jwt = false in config.toml, so a null Authorization header is
--      harmless — that is why the other three work.)
--
--   2. No idempotency. The other three scheduled emails got sent-at stamps in
--      20260709000001; this one was missed, so a manual re-run or a cron
--      misfire would email the customer again. Adds bookings.followup_sent_at,
--      filtered here and written by the follow-up Edge Function after Resend
--      accepts the send.
--
-- Also adds the Phase B test-data guards (test_* ids, addresses containing
-- "test" or @example.com) that the other three functions already have.
--
-- Idempotent: safe to run on every deploy.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.followup_sent_at IS
  'Set by the follow-up Edge Function after the post-rental review email is accepted by Resend. NULL = not sent.';

CREATE OR REPLACE FUNCTION send_followup_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  booking   record;
  target    text;
  sent_count int := 0;
BEGIN
  -- Rentals that ended yesterday. Cron fires 14:00 UTC (10 AM ET), so this is
  -- ~24h after the return date, which is the original intent.
  target := to_char(now() - interval '1 day', 'YYYY-MM-DD');

  FOR booking IN
    SELECT id, email, name, vehicle
    FROM public.bookings
    WHERE status = 'confirmed'
      -- left(...,10) so a value carrying a time component still matches.
      AND left(end_date, 10) = target
      AND followup_sent_at IS NULL
      AND email IS NOT NULL
      AND email <> ''
      -- Phase B test-data guards, same as the other three email functions.
      AND id NOT LIKE 'test_%'
      AND email NOT ILIKE '%test%'
      AND email NOT ILIKE '%@example.com'
  LOOP
    PERFORM net.http_post(
      url := 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/follow-up',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := jsonb_build_object(
        'bookingId', booking.id,
        'email',     booking.email,
        'name',      booking.name,
        'vehicle',   booking.vehicle
      )
    );
    sent_count := sent_count + 1;
  END LOOP;

  RAISE LOG 'send_followup_emails: queued % review email(s) for end_date %', sent_count, target;
END;
$$;
