-- CreateTable
CREATE TABLE "training_plans" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "designId" TEXT,
    "designSnapshot" TEXT,
    "signerUserIds" TEXT NOT NULL DEFAULT '[]',
    "closing" TEXT NOT NULL DEFAULT 'Mit kameradschaftlichen Grüßen',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_entries" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "leaderId" TEXT,
    "leaderName" TEXT,
    "calendarId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_plan_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_plans_year_key" ON "training_plans"("year");

-- CreateIndex
CREATE INDEX "training_plans_createdBy_idx" ON "training_plans"("createdBy");

-- CreateIndex
CREATE INDEX "training_plan_entries_planId_idx" ON "training_plan_entries"("planId");

-- AddForeignKey
ALTER TABLE "training_plan_entries" ADD CONSTRAINT "training_plan_entries_planId_fkey" FOREIGN KEY ("planId") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
