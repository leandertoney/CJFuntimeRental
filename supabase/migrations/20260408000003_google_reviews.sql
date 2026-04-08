-- Google reviews cache — fetched daily from Places API
create table public.google_reviews (
  id            text primary key,
  author_name   text not null,
  author_photo  text,
  rating        integer not null,
  text          text,
  publish_time  timestamptz,
  relative_time text,
  fetched_at    timestamptz default now()
);
alter table public.google_reviews enable row level security;
create policy "Service role full access" on public.google_reviews using (true) with check (true);

-- Public read access so the frontend config endpoint can serve them
create policy "Anon can read reviews" on public.google_reviews for select using (true);

-- Track when we last successfully fetched reviews
create table public.review_sync (
  id          integer primary key default 1,
  place_id    text,
  last_fetch  timestamptz,
  review_count integer default 0,
  constraint single_row check (id = 1)
);
alter table public.review_sync enable row level security;
create policy "Service role full access" on public.review_sync using (true) with check (true);

-- Seed with empty row
insert into public.review_sync (id, place_id, last_fetch, review_count)
values (1, null, null, 0)
on conflict do nothing;
