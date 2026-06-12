-- LetterDesign: name Feld + signerPosition hinzufügen
ALTER TABLE "letter_designs" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'Standard';
ALTER TABLE "letter_designs" ADD COLUMN IF NOT EXISTS "signerPosition" TEXT NOT NULL DEFAULT 'right';
ALTER TABLE "letter_designs" ADD COLUMN IF NOT EXISTS "footerBgColor" TEXT;
ALTER TABLE "letter_designs" ADD COLUMN IF NOT EXISTS "accentColor" TEXT NOT NULL DEFAULT '#8B1A1A';
