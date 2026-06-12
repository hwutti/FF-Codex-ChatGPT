-- AlterTable: AppSettings — Schriftarten pro Bereich
ALTER TABLE "app_settings" ADD COLUMN "fontGeneral"   TEXT DEFAULT 'DM Sans';
ALTER TABLE "app_settings" ADD COLUMN "fontHeadings"  TEXT DEFAULT 'Outfit';
ALTER TABLE "app_settings" ADD COLUMN "fontLogin"     TEXT DEFAULT 'Outfit';
ALTER TABLE "app_settings" ADD COLUMN "fontSidebar"   TEXT DEFAULT 'DM Sans';
ALTER TABLE "app_settings" ADD COLUMN "fontDashboard" TEXT DEFAULT 'Outfit';
ALTER TABLE "app_settings" ADD COLUMN "fontPrivacy"   TEXT DEFAULT 'DM Sans';
