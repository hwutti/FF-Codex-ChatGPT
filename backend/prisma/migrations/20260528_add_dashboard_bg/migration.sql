ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "dashboardBgColor" TEXT DEFAULT '#2d2724';
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "dashboardBgImage" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "dashboardTextColor" TEXT DEFAULT '#ffffff';
