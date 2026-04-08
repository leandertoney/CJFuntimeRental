-- Booking feedback — quick thumbs up/down on the post-booking success page
create table public.booking_feedback (
  id          uuid primary key default gen_random_uuid(),
  session_id  text,
  rating      text not null,
  created_at  timestamptz default now()
);
alter table public.booking_feedback enable row level security;

-- Allow anonymous inserts (the success page uses the anon key)
create policy "Anon can insert feedback" on public.booking_feedback
  for insert with check (true);

-- Service role can read all
create policy "Service role full access" on public.booking_feedback
  using (true) with check (true);
