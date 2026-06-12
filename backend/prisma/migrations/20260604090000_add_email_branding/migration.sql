-- AlterTable: AppSettings — E-Mail Branding
ALTER TABLE "app_settings" ADD COLUMN "emailHeaderBg"   TEXT DEFAULT '#a82828';
ALTER TABLE "app_settings" ADD COLUMN "emailButtonBg"   TEXT DEFAULT '#a82828';
ALTER TABLE "app_settings" ADD COLUMN "emailFooterText" TEXT;
