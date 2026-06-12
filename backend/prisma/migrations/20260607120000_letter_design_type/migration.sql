-- Add designType field to letter_designs
-- Default 'brief' for all existing designs
ALTER TABLE "letter_designs" ADD COLUMN "designType" TEXT NOT NULL DEFAULT 'brief';
