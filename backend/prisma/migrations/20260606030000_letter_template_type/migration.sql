-- Migration: type Feld zu letter_templates hinzufügen
ALTER TABLE "letter_templates" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'letter';
