ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "splashBgColor" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "splashBgImage" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "splashTextColor" TEXT DEFAULT '#333333';
