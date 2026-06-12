-- CreateTable: scheduled_sends
CREATE TABLE "scheduled_sends" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduledBy" TEXT NOT NULL,
    "scheduledByName" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "draftType" TEXT NOT NULL,
    "draftId" TEXT,
    "draftTitle" TEXT NOT NULL DEFAULT '',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "payload" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentCount" INTEGER,
    "failedCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "scheduled_sends_scheduledAt_idx" ON "scheduled_sends"("scheduledAt");
CREATE INDEX "scheduled_sends_status_idx" ON "scheduled_sends"("status");
