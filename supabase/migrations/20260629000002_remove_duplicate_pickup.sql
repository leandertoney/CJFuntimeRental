-- Migration: Remove duplicate pickup reminder cron job
-- Purpose: Eliminate duplicate 9 AM pickup emails
-- This unschedules the OLD system's pickup-reminders job
-- The NEW send-pickup-reminders job remains active
-- Created: 2026-06-29

-- Unschedule old pickup reminder job (duplicate at 9 AM)
SELECT cron.unschedule('pickup-reminders');

-- Note: Function send_pickup_reminders() is NOT dropped - only unscheduled
-- Note: post-rental-followup remains active pending verification
