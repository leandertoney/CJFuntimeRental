-- One row per recipient per campaign send, keyed by the Resend message id.
--
-- This exists so "how many people opened it" has something to attach to. The
-- bulk send previously threw away Resend's response, so a campaign left no
-- record of WHO it went to, only a count. Without a per-message id there is no
-- way to match an inbound open event back to a campaign.
--
-- Opens are recorded here, not counted into a column on `campaigns`. That
-- keeps the rule the campaigns table was built on: results are derived at read
-- time from the rows that prove them, never denormalised into a second number
-- that drifts from the first.
CREATE TABLE IF NOT EXISTS public.campaign_emails (
  email_id     text PRIMARY KEY,
  campaign_id  uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  recipient    text NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  opened_at    timestamptz,
  bounced_at   timestamptz
);

COMMENT ON TABLE public.campaign_emails IS
  'One row per recipient of a campaign send. email_id is Resend''s message id, which is how an inbound open/delivery webhook is matched back to a campaign.';
COMMENT ON COLUMN public.campaign_emails.opened_at IS
  'First open only; the webhook never overwrites a non-null value, so this counts unique recipients rather than total opens. Approximate by nature: Apple Mail Privacy Protection prefetches the tracking pixel and reports an open the recipient never made.';

CREATE INDEX IF NOT EXISTS campaign_emails_campaign_idx ON public.campaign_emails (campaign_id);

-- Every public table gets RLS. All access is through edge functions using the
-- service role, which bypasses RLS, so no policies are needed here.
ALTER TABLE public.campaign_emails ENABLE ROW LEVEL SECURITY;
