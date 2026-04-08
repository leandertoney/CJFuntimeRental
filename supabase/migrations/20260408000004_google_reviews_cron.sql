-- Daily Google reviews refresh — fetches new reviews from Places API
create or replace function refresh_google_reviews()
returns void
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/google-reviews',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Schedule: runs daily at 6 AM UTC (2 AM ET)
select cron.schedule(
  'refresh-google-reviews',
  '0 6 * * *',
  $$select refresh_google_reviews()$$
);
