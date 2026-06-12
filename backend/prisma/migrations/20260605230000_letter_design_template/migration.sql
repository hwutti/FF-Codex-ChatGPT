-- Migration: template Feld zu letter_designs hinzufügen
ALTER TABLE "letter_designs" ADD COLUMN IF NOT EXISTS "template" TEXT NOT NULL DEFAULT 'classic';
