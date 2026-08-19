-- Migration: ADDITIONAL DRIVER support (one optional second driver per booking)
-- Created: 2026-08-19
--
-- Real case that triggered this: a customer booked online for her father as a
-- surprise; at pickup he wanted to drive and it had to be handled by hand.
--
-- Design notes:
--  * ONE additional driver max, so these are flat driver2_* columns on the
--    existing id_uploads row rather than a child table. This matches the
--    existing flat canam_* idiom and keeps the checkout hard gate (exactly one
--    id_uploads row per booking_ref) as the single source of truth.
--  * NO new storage bucket and NO new storage policies. Driver 2 images live in
--    the same PRIVATE booking-ids bucket under <booking_ref>/driver2-*.<ext>.
--    storage.objects has RLS enabled with zero policies for this bucket, so the
--    anon and authenticated roles get zero access to driver 2 images for exactly
--    the same reason they get zero access to the primary driver's.
--  * The additional driver is FREE. Nothing here touches money.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. id_uploads — the additional driver's identity, images and Can-Am check
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.id_uploads
  add column if not exists driver2_name                          text,
  add column if not exists driver2_email                         text,
  add column if not exists driver2_front_path                    text,
  add column if not exists driver2_back_path                     text,
  add column if not exists driver2_required_id_type              text,     -- 'drivers_license' | 'photo_id'
  add column if not exists driver2_added_at                      timestamptz,
  add column if not exists driver2_added_by                      text,     -- admin email, or 'booking_flow'
  -- Same manual-review pattern as the primary driver: we never read the
  -- licence, we only require that a licence (not a state ID) was uploaded for
  -- a Can-Am and flag it so Chris confirms the M endorsement in person.
  add column if not exists driver2_canam_license_check_required  boolean default false,
  add column if not exists driver2_canam_license_verified        boolean default false,
  add column if not exists driver2_canam_verified_by             text,
  add column if not exists driver2_canam_verified_at             timestamptz,
  -- Post-booking upload link. Single use: the token is cleared once the images
  -- land, and is rejected after driver2_token_expires_at.
  add column if not exists driver2_upload_token                  text,
  add column if not exists driver2_token_expires_at              timestamptz;

comment on column public.id_uploads.driver2_name is 'Additional driver full name. NULL means the booking has no additional driver.';
comment on column public.id_uploads.driver2_canam_license_check_required is 'True for Can-Am: an admin must confirm the M endorsement on the additional driver''s licence.';
comment on column public.id_uploads.driver2_upload_token is 'Single-use token for the post-booking ID upload link emailed to the additional driver. Cleared on successful upload.';

-- Token lookup path for the public upload page. Partial index: only rows with a
-- live token are ever looked up this way.
create unique index if not exists id_uploads_driver2_token_idx
  on public.id_uploads (driver2_upload_token)
  where driver2_upload_token is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. bookings — surface additional-driver state on the booking row itself
-- ─────────────────────────────────────────────────────────────────────────────
-- The admin bookings LIST renders from bookings alone (no join), and the
-- owner's requirement is that the Can-Am M-endorsement warning stays lit until
-- BOTH drivers are confirmed. So the driver 2 Can-Am state is mirrored here.
-- requires_canam_license_check keeps its original primary-driver meaning; the
-- driver2_* pair is read alongside it.
alter table public.bookings
  add column if not exists additional_driver_name                text,
  add column if not exists driver2_requires_canam_license_check  boolean default false,
  add column if not exists driver2_canam_license_verified        boolean default false,
  add column if not exists driver2_canam_verified_by             text,
  add column if not exists driver2_canam_verified_at             timestamptz,
  add column if not exists driver2_id_upload_status              text;    -- 'pending' | 'received'

comment on column public.bookings.additional_driver_name is 'Name of the optional second driver. NULL means none.';
comment on column public.bookings.driver2_requires_canam_license_check is 'Can-Am rental with a second driver: admin must confirm that driver''s M endorsement too.';
comment on column public.bookings.driver2_id_upload_status is 'pending = driver added, upload link sent, images not in yet. received = images uploaded.';
