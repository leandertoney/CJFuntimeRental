-- Post-rental follow-up emails — sent ~24 hours after return date
-- Asks customers to leave a Google review

create or replace function send_followup_emails()
returns void
language plpgsql
security definer
as $$
declare
  booking record;
  yesterday text;
begin
  -- Match bookings whose end_date was yesterday
  yesterday := to_char(now() - interval '1 day', 'Mon');

  for booking in
    select * from public.bookings
    where status = 'confirmed'
    and end_date ilike '%' || to_char(now() - interval '1 day', 'Mon%') || '%'
    and end_date ilike '%' || to_char(now() - interval '1 day', '%DD%') || '%'
  loop
    perform net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/follow-up',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'email',   booking.email,
        'name',    booking.name,
        'vehicle', booking.vehicle
      )
    );
  end loop;
end;
$$;

-- Schedule: runs every day at 2 PM UTC (10 AM ET)
select cron.schedule(
  'post-rental-followup',
  '0 14 * * *',
  $$select send_followup_emails()$$
);
