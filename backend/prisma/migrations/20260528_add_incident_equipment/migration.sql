CREATE TABLE "incident_equipment" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "durationMin" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incident_equipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incident_equipment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "incident_equipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "incident_equipment_incidentId_equipmentId_key" UNIQUE ("incidentId", "equipmentId")
);
