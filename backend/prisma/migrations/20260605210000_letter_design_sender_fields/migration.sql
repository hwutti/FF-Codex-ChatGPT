-- Migration: senderCity und senderLineText zu letter_designs hinzufügen
ALTER TABLE "letter_designs" ADD COLUMN IF NOT EXISTS "senderCity" TEXT NOT NULL DEFAULT '';
ALTER TABLE "letter_designs" ADD COLUMN IF NOT EXISTS "senderLineText" TEXT NOT NULL DEFAULT '';
