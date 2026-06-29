-- Migration: Add health-check cron job
-- Purpose: Run health checks every 15 minutes to monitor system health
-- Sends alerts to support@universoleappstudios.com if anything fails
-- Created: 2026-06-29

-- Schedule health-check to run every 15 minutes
SELECT cron.schedule(
  'health-check',
  '*/15 * * * *', -- Every 15 minutes
  $$
    SELECT
      net.http_post(
        url := 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/health-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
        ),
        body := '{}'::jsonb
      );
  $$
);

-- Verify the job was created
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'health-check';
