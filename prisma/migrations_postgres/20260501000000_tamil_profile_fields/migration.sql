-- Add Tamil-specific profile fields
-- birthDate: for 18+ age validation
-- gender: optional gender identity
-- community: defaults to 'tamil', enforced at application level

ALTER TABLE "public"."Profile"
  ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "community" TEXT NOT NULL DEFAULT 'tamil';
