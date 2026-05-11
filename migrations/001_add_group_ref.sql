-- Migration: Add group_ref column for multi-seat booking support
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Add group_ref column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_ref TEXT;

-- 2. Create index for efficient group lookups
CREATE INDEX IF NOT EXISTS idx_bookings_group_ref ON bookings(group_ref);

-- 3. Backfill existing bookings: set group_ref = booking_ref for single-seat bookings
UPDATE bookings SET group_ref = booking_ref WHERE group_ref IS NULL;

-- Verify
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name = 'group_ref';
