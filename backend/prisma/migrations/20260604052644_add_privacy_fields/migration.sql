-- AlterTable: AppSettings — Datenschutz-Felder
ALTER TABLE "app_settings" ADD COLUMN "privacyText" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "privacyVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "app_settings" ADD COLUMN "privacyVersionNote" TEXT;

-- AlterTable: users — Datenschutz-Bestätigung
ALTER TABLE "users" ADD COLUMN "privacyAcceptedVersion" INTEGER;
ALTER TABLE "users" ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);
