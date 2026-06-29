-- Migration: Add read-only RPC function to query pg_cron jobs
-- Purpose: Enable verification of scheduled cron jobs via Supabase client
-- This is READ-ONLY - only exposes existing cron.job data, makes no changes
-- Created: 2026-06-29

CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  command text,
  nodename text,
  nodeport integer,
  database text,
  username text,
  active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jobid,
    jobname,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active
  FROM cron.job
  ORDER BY jobname;
$$;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION public.get_cron_jobs() TO service_role;

-- Optional: Grant to anon role if you want to query from frontend
-- GRANT EXECUTE ON FUNCTION public.get_cron_jobs() TO anon;

COMMENT ON FUNCTION public.get_cron_jobs() IS 'Read-only helper to query pg_cron scheduled jobs. Added for operational visibility.';
