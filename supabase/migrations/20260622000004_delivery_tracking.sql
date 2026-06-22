-- Migration: Add delivery tracking fields to bookings
-- Phase 1: Email Automation - Delivery Tracking
-- Created: 2026-06-22
--
-- This migration adds fields to track customer delivery preferences:
-- - delivery_dropoff: Customer paid for vehicle delivery to their location
-- - delivery_pickup: Customer paid for vehicle pickup from their location
-- - delivery_address: Customer's address for delivery service

ALTER TABLE bookings
ADD COLUMN delivery_dropoff BOOLEAN DEFAULT FALSE,
ADD COLUMN delivery_pickup BOOLEAN DEFAULT FALSE,
ADD COLUMN delivery_address TEXT;

-- Add comments for clarity
COMMENT ON COLUMN bookings.delivery_dropoff IS 'Customer paid $50 for vehicle delivery to their location';
COMMENT ON COLUMN bookings.delivery_pickup IS 'Customer paid $50 for vehicle pickup from their location';
COMMENT ON COLUMN bookings.delivery_address IS 'Customer address for delivery/pickup service';
