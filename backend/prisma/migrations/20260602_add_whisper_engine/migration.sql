-- Add whisper engine setting to AppSettings
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "whisperEngine" TEXT NOT NULL DEFAULT 'faster-whisper';