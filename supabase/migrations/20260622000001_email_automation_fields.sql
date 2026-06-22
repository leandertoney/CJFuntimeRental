-- Migration: Add pickup/return fields for email automation
-- Phase 1: Email Automation
-- Created: 2026-06-22
--
-- This migration adds fields to support:
-- - Pickup instructions email (48h before rental)
-- - Return instructions email (24h before return)
-- - Admin panel editing of pickup/return details per booking

-- Add pickup-related fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pickup_location TEXT,
  ADD COLUMN IF NOT EXISTS pickup_time TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_instructions TEXT;

-- Add return-related fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS return_location TEXT,
  ADD COLUMN IF NOT EXISTS return_time TEXT,
  ADD COLUMN IF NOT EXISTS return_address TEXT,
  ADD COLUMN IF NOT EXISTS return_instructions TEXT;

-- Add vehicle condition tracking fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS fuel_level TEXT,
  ADD COLUMN IF NOT EXISTS key_drop_location TEXT;

-- Add column comments for documentation
COMMENT ON COLUMN public.bookings.pickup_location IS 'Pickup location name (e.g., "CJ Funtime Rentals Office")';
COMMENT ON COLUMN public.bookings.pickup_time IS 'Pickup time in human-readable format (e.g., "3:00 PM")';
COMMENT ON COLUMN public.bookings.pickup_address IS 'Full pickup address for customer GPS';
COMMENT ON COLUMN public.bookings.pickup_instructions IS 'Detailed pickup instructions (parking, check-in process, etc.)';

COMMENT ON COLUMN public.bookings.return_location IS 'Return location name';
COMMENT ON COLUMN public.bookings.return_time IS 'Return time in human-readable format';
COMMENT ON COLUMN public.bookings.return_address IS 'Full return address (may differ from pickup)';
COMMENT ON COLUMN public.bookings.return_instructions IS 'Detailed return instructions (key drop, parking, hours, etc.)';

COMMENT ON COLUMN public.bookings.fuel_level IS 'Expected fuel level at pickup (e.g., "Full", "3/4 tank")';
COMMENT ON COLUMN public.bookings.key_drop_location IS 'Where to leave keys if returning after hours (e.g., "Lockbox on front door")';

-- Note: No default values set - admin will populate these per booking
-- Existing bookings will have NULL values until backfilled via admin panel
