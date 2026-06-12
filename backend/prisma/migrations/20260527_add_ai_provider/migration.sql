-- Add AI provider fields to app_settings
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "openaiApiKey" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "ollamaUrl" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "activeAiProvider" TEXT DEFAULT 'gemini';
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "ollamaModel" TEXT DEFAULT 'llama3';
