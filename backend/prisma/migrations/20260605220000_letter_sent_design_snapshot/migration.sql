-- Migration: designSnapshot zu letter_sent hinzufügen
ALTER TABLE "letter_sent" ADD COLUMN IF NOT EXISTS "designSnapshot" TEXT;
