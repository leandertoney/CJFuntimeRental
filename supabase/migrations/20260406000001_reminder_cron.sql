-- Enable pg_cron and pg_net extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Function to send pickup reminders for tomorrow's bookings
create or replace function send_pickup_reminders()
returns void
language plpgsql
security definer
as $$
declare
  booking record;
  tomorrow text;
begin
  tomorrow := to_char(now() + interval '1 day', 'Month DD, YYYY');

  for booking in
    select * from public.bookings
    where start_date ilike '%' || to_char(now() + interval '1 day', 'Mon%DD%YYYY') || '%'
    and status = 'confirmed'
  loop
    perform net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'email',     booking.email,
        'name',      booking.name,
        'vehicle',   booking.vehicle,
        'startDate', booking.start_date
      )
    );
  end loop;
end;
$$;

-- Schedule: runs every day at 9 AM UTC
select cron.schedule(
  'pickup-reminders',
  '0 9 * * *',
  $$select send_pickup_reminders()$$
);
