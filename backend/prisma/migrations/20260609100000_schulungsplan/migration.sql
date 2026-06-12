-- CreateTable: schulungsplaene
CREATE TABLE "schulungsplaene" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "designId" TEXT,
    "designSnapshot" TEXT,
    "signerUserIds" TEXT NOT NULL DEFAULT '[]',
    "closing" TEXT NOT NULL DEFAULT 'Mit kameradschaftlichen Grüßen',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schulungsplaene_pkey" PRIMARY KEY ("id")
);

-- CreateTable: schulungsplan_eintraege
CREATE TABLE "schulungsplan_eintraege" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "trainerId" TEXT,
    "trainerName" TEXT,
    "calendarId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schulungsplan_eintraege_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "schulungsplaene_createdBy_idx" ON "schulungsplaene"("createdBy");
CREATE INDEX "schulungsplan_eintraege_planId_idx" ON "schulungsplan_eintraege"("planId");

-- ForeignKey
ALTER TABLE "schulungsplan_eintraege" ADD CONSTRAINT "schulungsplan_eintraege_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "schulungsplaene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
