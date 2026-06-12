-- AlterTable: AppSettings — SMTP Felder
ALTER TABLE "app_settings" ADD COLUMN "smtpHost"   TEXT;
ALTER TABLE "app_settings" ADD COLUMN "smtpPort"   INTEGER DEFAULT 587;
ALTER TABLE "app_settings" ADD COLUMN "smtpUser"   TEXT;
ALTER TABLE "app_settings" ADD COLUMN "smtpPass"   TEXT;
ALTER TABLE "app_settings" ADD COLUMN "smtpFrom"   TEXT;
ALTER TABLE "app_settings" ADD COLUMN "smtpSecure" BOOLEAN DEFAULT false;

-- CreateTable: password_reset_tokens
CREATE TABLE "password_reset_tokens" (
    "id"        TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
