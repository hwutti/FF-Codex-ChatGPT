ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "trainingLocation" TEXT;
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "commanderId" TEXT;
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PLANNED';
