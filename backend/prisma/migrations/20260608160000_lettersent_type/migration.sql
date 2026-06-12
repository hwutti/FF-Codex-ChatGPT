-- AlterTable: letter_sent — type + extraData hinzufügen
ALTER TABLE "letter_sent" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'letter';
ALTER TABLE "letter_sent" ADD COLUMN "extraData" TEXT;
