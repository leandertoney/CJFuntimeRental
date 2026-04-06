-- LEADS
create table public.leads (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text default 'website',
  promo_code  text,
  created_at  timestamptz default now()
);
alter table public.leads enable row level security;
create policy "Service role full access" on public.leads using (true) with check (true);

-- BOOKINGS
create table public.bookings (
  id                text primary key,
  email             text not null,
  name              text,
  phone             text,
  vehicle           text,
  start_date        text,
  end_date          text,
  days              integer,
  total             numeric(10,2),
  savings           numeric(10,2) default 0,
  stripe_session_id text,
  status            text default 'confirmed',
  created_at        timestamptz default now()
);
alter table public.bookings enable row level security;
create policy "Service role full access" on public.bookings using (true) with check (true);

-- SITE CONFIG (single row)
create table public.site_config (
  id         integer primary key default 1,
  config     jsonb not null,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);
alter table public.site_config enable row level security;
create policy "Service role full access" on public.site_config using (true) with check (true);
