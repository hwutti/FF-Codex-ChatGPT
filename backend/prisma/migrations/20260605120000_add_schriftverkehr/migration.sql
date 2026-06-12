-- Schriftverkehr: Letter Design
CREATE TABLE "letter_designs" (
    "id" TEXT NOT NULL,
    "headerBgColor" TEXT NOT NULL DEFAULT '#8B1A1A',
    "headerBgImage" TEXT,
    "headerBgImageOpacity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "headerLogoLeft" TEXT,
    "headerLogoRight" TEXT,
    "headerLogoCenter" TEXT,
    "headerLogoPosition" TEXT NOT NULL DEFAULT 'both',
    "headerTitle" TEXT NOT NULL DEFAULT '',
    "headerSubtitle" TEXT NOT NULL DEFAULT '',
    "headerTitleColor" TEXT NOT NULL DEFAULT '#ffffff',
    "headerTitleSize" INTEGER NOT NULL DEFAULT 16,
    "bodyBgColor" TEXT NOT NULL DEFAULT '#ffffff',
    "bodyBgImage" TEXT,
    "bodyBgImageOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "fontFamily" TEXT NOT NULL DEFAULT 'Arial',
    "fontSize" INTEGER NOT NULL DEFAULT 12,
    "senderName" TEXT NOT NULL DEFAULT '',
    "senderAddress" TEXT NOT NULL DEFAULT '',
    "senderPhone" TEXT NOT NULL DEFAULT '',
    "senderEmail" TEXT NOT NULL DEFAULT '',
    "senderWebsite" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "letter_designs_pkey" PRIMARY KEY ("id")
);

-- Schriftverkehr: Letter Templates
CREATE TABLE "letter_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL DEFAULT '',
    "salutation" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "closing" TEXT NOT NULL DEFAULT 'Mit freundlichen Grüßen,',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "letter_templates_pkey" PRIMARY KEY ("id")
);

-- Schriftverkehr: Letter Contacts
CREATE TABLE "letter_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "function" TEXT,
    "organization" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "letter_contacts_pkey" PRIMARY KEY ("id")
);

-- Schriftverkehr: Letter Sent (Historie)
CREATE TABLE "letter_sent" (
    "id" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "sentByName" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "salutation" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "closing" TEXT NOT NULL DEFAULT '',
    "signers" TEXT NOT NULL DEFAULT '[]',
    "sendMode" TEXT NOT NULL DEFAULT 'html_pdf',
    "templateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "letter_sent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "letter_sent_sentBy_idx" ON "letter_sent"("sentBy");
CREATE INDEX "letter_sent_createdAt_idx" ON "letter_sent"("createdAt");

-- Fremdschlüssel
ALTER TABLE "letter_sent" ADD CONSTRAINT "letter_sent_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "letter_templates"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- User: Unterschrift-Felder
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signatureImage" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signatureEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sentLettersRef" TEXT[] DEFAULT ARRAY[]::TEXT[];
