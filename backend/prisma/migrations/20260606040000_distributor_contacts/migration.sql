-- Migration: contactIds zu distributors hinzufügen
ALTER TABLE "distributors" ADD COLUMN IF NOT EXISTS "contactIds" TEXT NOT NULL DEFAULT '[]';
