-- Phase 4.2: Profile photos
-- Multiple photos per user, ordered, with metadata

CREATE TABLE IF NOT EXISTS "public"."ProfilePhoto" (
  "id"        SERIAL PRIMARY KEY,
  "userId"    INTEGER NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "url"       TEXT NOT NULL,
  "filename"  TEXT NOT NULL,
  "mimeType"  TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProfilePhoto_userId_sortOrder_idx"
  ON "public"."ProfilePhoto"("userId", "sortOrder");
