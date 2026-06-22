-- Migration: Add default pickup/return details to site config
-- Phase 1: Email Automation - Default Location Settings
-- Created: 2026-06-22
--
-- This migration adds default_pickup_details to the site config JSONB.
-- These defaults will be used for all non-delivery bookings unless overridden.

UPDATE site_config
SET config = jsonb_set(
  config,
  '{default_pickup_details}',
  '{
    "pickup_location": "",
    "pickup_address": "",
    "pickup_time": "",
    "pickup_instructions": "",
    "return_location": "",
    "return_address": "",
    "return_time": "",
    "return_instructions": "",
    "fuel_level": "Full",
    "key_drop_location": ""
  }'::jsonb
)
WHERE id = 1;
