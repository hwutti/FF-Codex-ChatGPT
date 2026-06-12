-- User: Erinnerungs-Einstellungen
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pushReminder7" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pushReminder3" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pushReminder1" BOOLEAN NOT NULL DEFAULT true;

-- AppSettings: Push-Uhrzeit
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "pushReminderHour"   INTEGER DEFAULT 19;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "pushReminderMinute" INTEGER DEFAULT 0;
