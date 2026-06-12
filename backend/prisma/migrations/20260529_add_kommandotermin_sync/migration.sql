-- KommandoTerminType enum
CREATE TYPE "KommandoTerminType" AS ENUM ('AUSSCHUSS', 'KOMMANDO');

-- KommandoTermine Tabelle
CREATE TABLE "kommando_termins" (
  "id" TEXT NOT NULL,
  "type" "KommandoTerminType" NOT NULL,
  "title" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "location" TEXT,
  "description" TEXT,
  "notes" TEXT,
  "calendarEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kommando_termins_pkey" PRIMARY KEY ("id")
);

-- KommandoTermin Anwesenheiten
CREATE TABLE "kommando_termin_attendances" (
  "id" TEXT NOT NULL,
  "kommandoTerminId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  CONSTRAINT "kommando_termin_attendances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kommando_termin_attendances_kommandoTerminId_fkey" FOREIGN KEY ("kommandoTerminId") REFERENCES "kommando_termins"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "kommando_termin_attendances_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kommando_termin_attendances_kommandoTerminId_memberId_key" UNIQUE ("kommandoTerminId", "memberId")
);

-- Sync-Felder zu calendar_events
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

-- Sync-Felder zu exercises und org_events
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT;
ALTER TABLE "org_events" ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT;
