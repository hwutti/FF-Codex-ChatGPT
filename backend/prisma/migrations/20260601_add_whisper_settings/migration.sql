-- Add whisper model and language settings to AppSettings
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "whisperModel" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "whisperLanguage" TEXT NOT NULL DEFAULT 'de';
