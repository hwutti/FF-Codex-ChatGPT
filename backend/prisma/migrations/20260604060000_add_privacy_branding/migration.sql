-- AlterTable: AppSettings — Datenschutz Branding-Farben
ALTER TABLE "app_settings" ADD COLUMN "privacyHeaderBg"    TEXT DEFAULT '#1e293b';
ALTER TABLE "app_settings" ADD COLUMN "privacyHeaderText"  TEXT DEFAULT '#ffffff';
ALTER TABLE "app_settings" ADD COLUMN "privacyPageBg"      TEXT DEFAULT '#f1f5f9';
ALTER TABLE "app_settings" ADD COLUMN "privacyButtonBg"    TEXT DEFAULT '#16a34a';
ALTER TABLE "app_settings" ADD COLUMN "privacyContentText" TEXT DEFAULT '#374151';
