-- Migration: ID upload storage + rental agreement (contract) capture
-- Feature: Government photo ID upload (front/back) + rental-agreement acceptance
-- Created: 2026-07-01
--
-- Sensitive PII: this migration provisions a PRIVATE storage bucket for
-- government ID images. Access rules are the security-critical part below.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PRIVATE storage bucket for ID images
-- ─────────────────────────────────────────────────────────────────────────────
-- public = false  => objects are NOT served from the public CDN path
--                    (/storage/v1/object/public/...) and cannot be read anonymously.
-- We deliberately create NO Storage RLS policies for this bucket. RLS on
-- storage.objects is already enabled by Supabase, so with zero matching policies
-- the anon and authenticated roles get ZERO access (no list, no read, no insert).
-- Only the service_role key (used exclusively by our server-side Edge Functions)
-- bypasses RLS and can read/write these objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-ids',
  'booking-ids',
  false,
  10485760, -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. id_uploads table — links an uploaded ID set to its (eventual) booking
-- ─────────────────────────────────────────────────────────────────────────────
-- Uploads happen BEFORE payment, so the booking row does not exist yet. The
-- browser generates a booking_ref (UUID); once payment completes the Stripe
-- webhook back-fills booking_id (= Stripe session id) and copies the flags/
-- agreement snapshot onto the bookings row.
create table if not exists public.id_uploads (
  id                            uuid primary key default gen_random_uuid(),
  booking_ref                   text not null unique,
  booking_id                    text,                       -- filled by webhook after payment
  vehicle_key                   text,
  vehicle_type                  text,                       -- 'slingshot' | 'canam'
  required_id_type              text,                       -- 'drivers_license' | 'photo_id'
  front_path                    text not null,
  back_path                     text not null,
  -- Can-Am manual review: we do NOT read the license. We only require that a
  -- driver's license (not a state ID) was uploaded, and flag it so Chris
  -- manually confirms the motorcycle (M) endorsement before releasing the vehicle.
  canam_license_check_required  boolean default false,
  canam_license_verified        boolean default false,
  canam_verified_by             text,
  canam_verified_at             timestamptz,
  -- Rental agreement (contract) acceptance snapshot
  agreement_version             text,
  agreement_text                text,
  agreed_at                     timestamptz,
  created_at                    timestamptz default now()
);

alter table public.id_uploads enable row level security;
-- Service role only — no anon/authenticated policy is intentional (PII).
create policy "Service role full access" on public.id_uploads using (true) with check (true);

create index if not exists id_uploads_booking_id_idx on public.id_uploads (booking_id);

comment on table  public.id_uploads is 'Government ID image references + rental-agreement acceptance. PII — service role only.';
comment on column public.id_uploads.booking_ref is 'Client-generated UUID that links a pre-payment upload to the booking created after payment.';
comment on column public.id_uploads.canam_license_check_required is 'True for Can-Am bookings: Chris must manually confirm the M endorsement on the uploaded license.';
comment on column public.id_uploads.canam_license_verified is 'Set true once an admin has eyeballed the M endorsement on the license image.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. bookings columns — surface ID/contract state on the booking itself
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings
  add column if not exists id_ref                       text,
  add column if not exists id_upload_status             text,     -- 'received'
  add column if not exists requires_canam_license_check boolean default false,
  add column if not exists canam_license_verified       boolean default false,
  add column if not exists canam_verified_by            text,
  add column if not exists canam_verified_at            timestamptz,
  add column if not exists agreement_version            text,
  add column if not exists agreement_text               text,
  add column if not exists agreed_at                    timestamptz;

comment on column public.bookings.id_ref is 'booking_ref linking to public.id_uploads (uploaded government ID images).';
comment on column public.bookings.requires_canam_license_check is 'Can-Am rental: admin must manually confirm the M endorsement before release.';
comment on column public.bookings.canam_license_verified is 'True once an admin confirmed the M endorsement on the uploaded license.';
comment on column public.bookings.agreement_version is 'Version of the rental agreement the customer accepted.';
comment on column public.bookings.agreed_at is 'Timestamp the customer accepted the rental agreement.';
