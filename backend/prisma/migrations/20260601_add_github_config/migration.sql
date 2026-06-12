ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "githubToken" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "githubRepo"  TEXT;
