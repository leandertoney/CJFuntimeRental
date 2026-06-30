-- Migration: Per-Vehicle Date Blocking
-- Created: 2026-06-30
--
-- Adds ability to block specific vehicles for date ranges while leaving
-- other vehicles available. Solves Turo co-listing issue where blocking
-- one rented vehicle was blocking entire fleet.
--
-- Use cases:
-- - Block specific vehicle when rented on Turo
-- - Block specific vehicle for maintenance
-- - Block specific vehicle for personal use
--
-- Note: Existing `site_config.blockedDates` remains for fleet-wide blocking
-- (holidays, business closures, etc.)

-- Create vehicle_blocks table
CREATE TABLE IF NOT EXISTS public.vehicle_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_key text NOT NULL,           -- Vehicle identifier (e.g. 'slingshot_2024_orange', 'canam_spyder')
  start_date  text NOT NULL,           -- ISO format YYYY-MM-DD
  end_date    text NOT NULL,           -- ISO format YYYY-MM-DD (inclusive)
  reason      text,                    -- Human-readable reason (e.g. 'Rented on Turo', 'Maintenance')
  created_at  timestamptz DEFAULT now(),
  created_by  text                     -- Admin user identifier
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.vehicle_blocks ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY "Service role full access on vehicle_blocks"
  ON public.vehicle_blocks
  USING (true)
  WITH CHECK (true);

-- Index for fast availability lookups
CREATE INDEX idx_vehicle_blocks_lookup
  ON public.vehicle_blocks(vehicle_key, start_date, end_date);

-- Index for chronological queries
CREATE INDEX idx_vehicle_blocks_dates
  ON public.vehicle_blocks(start_date, end_date);

-- Add column comments
COMMENT ON TABLE public.vehicle_blocks IS 'Per-vehicle date blocking for admin manual unavailability (Turo rentals, maintenance, etc.)';
COMMENT ON COLUMN public.vehicle_blocks.vehicle_key IS 'Vehicle identifier matching keys in site_config.vehicles';
COMMENT ON COLUMN public.vehicle_blocks.start_date IS 'First day vehicle is blocked (ISO YYYY-MM-DD)';
COMMENT ON COLUMN public.vehicle_blocks.end_date IS 'Last day vehicle is blocked, inclusive (ISO YYYY-MM-DD)';
COMMENT ON COLUMN public.vehicle_blocks.reason IS 'Admin-provided reason for blocking (e.g. "Rented on Turo", "Oil change")';
COMMENT ON COLUMN public.vehicle_blocks.created_by IS 'Admin user who created the block (for audit trail)';
