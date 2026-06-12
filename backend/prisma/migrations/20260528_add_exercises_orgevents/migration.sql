-- ExerciseType enum
CREATE TYPE "ExerciseType" AS ENUM ('RADIO', 'DISTRICT', 'COMMUNITY', 'DISASTER', 'DRIVE', 'OTHER');

-- OrgEventType enum  
CREATE TYPE "OrgEventType" AS ENUM ('MEETING', 'FUNERAL', 'EVENT', 'TRAINING', 'OTHER');

-- Exercises table
CREATE TABLE "exercises" (
  "id" TEXT NOT NULL,
  "type" "ExerciseType" NOT NULL,
  "title" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "location" TEXT,
  "description" TEXT,
  "responsiblePersonId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exercises_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exercises_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Exercise attendances
CREATE TABLE "exercise_attendances" (
  "id" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  CONSTRAINT "exercise_attendances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exercise_attendances_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exercise_attendances_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "exercise_attendances_exerciseId_memberId_key" UNIQUE ("exerciseId", "memberId")
);

-- Exercise equipment
CREATE TABLE "exercise_equipment" (
  "id" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "durationMin" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exercise_equipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exercise_equipment_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exercise_equipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exercise_equipment_exerciseId_equipmentId_key" UNIQUE ("exerciseId", "equipmentId")
);

-- Org events table
CREATE TABLE "org_events" (
  "id" TEXT NOT NULL,
  "type" "OrgEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "location" TEXT,
  "description" TEXT,
  "responsiblePersonId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "org_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "org_events_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Org event attendances
CREATE TABLE "org_event_attendances" (
  "id" TEXT NOT NULL,
  "orgEventId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  CONSTRAINT "org_event_attendances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "org_event_attendances_orgEventId_fkey" FOREIGN KEY ("orgEventId") REFERENCES "org_events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "org_event_attendances_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "org_event_attendances_orgEventId_memberId_key" UNIQUE ("orgEventId", "memberId")
);
