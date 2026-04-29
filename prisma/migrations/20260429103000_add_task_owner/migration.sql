-- Add task ownership to enforce per-user task isolation.
ALTER TABLE "Task" ADD COLUMN "userId" INTEGER;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Task_userId_createdAt_idx" ON "Task"("userId", "createdAt");
