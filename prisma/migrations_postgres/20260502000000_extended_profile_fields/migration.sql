-- Phase 4.1: Extended profile fields
-- Add new optional fields for richer profiles and filtering

ALTER TABLE "public"."Profile"
  ADD COLUMN IF NOT EXISTS "interestedIn" TEXT,
  ADD COLUMN IF NOT EXISTS "height"       INTEGER,
  ADD COLUMN IF NOT EXISTS "education"    TEXT,
  ADD COLUMN IF NOT EXISTS "job"          TEXT,
  ADD COLUMN IF NOT EXISTS "religion"     TEXT;
