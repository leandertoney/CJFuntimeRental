-- Migration: Set up pg_cron jobs for automated emails
-- Phase 1: Email Automation
-- Created: 2026-06-22
--
-- This migration creates scheduled jobs to automatically send:
-- 1. Pickup reminders (48h before rental)
-- 2. Return instructions (24h before return)
-- 3. Mid-rental check-ins (day 2 of multi-day rentals)

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- ══════════════════════════════════════════════════════════════
-- Job 1: Pickup Reminder (48 hours before rental)
-- Runs daily at 9:00 AM
-- ══════════════════════════════════════════════════════════════

SELECT cron.schedule(
  'send-pickup-reminders',
  '0 9 * * *', -- Every day at 9:00 AM
  $$
    SELECT
      net.http_post(
        url := 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/send-pickup-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
        ),
        body := '{}'::jsonb
      );
  $$
);

-- ══════════════════════════════════════════════════════════════
-- Job 2: Return Instructions (24 hours before return)
-- Runs daily at 10:00 AM
-- ══════════════════════════════════════════════════════════════

SELECT cron.schedule(
  'send-return-instructions',
  '0 10 * * *', -- Every day at 10:00 AM
  $$
    SELECT
      net.http_post(
        url := 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/send-return-instructions',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
        ),
        body := '{}'::jsonb
      );
  $$
);

-- ══════════════════════════════════════════════════════════════
-- Job 3: Mid-Rental Check-in (day 2 of multi-day rentals)
-- Runs daily at 11:00 AM
-- ══════════════════════════════════════════════════════════════

SELECT cron.schedule(
  'send-mid-rental-checkins',
  '0 11 * * *', -- Every day at 11:00 AM
  $$
    SELECT
      net.http_post(
        url := 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/send-mid-rental-checkins',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
        ),
        body := '{}'::jsonb
      );
  $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job;

-- To remove a job (if needed):
-- SELECT cron.unschedule('send-pickup-reminders');
-- SELECT cron.unschedule('send-return-instructions');
-- SELECT cron.unschedule('send-mid-rental-checkins');
