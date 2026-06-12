CREATE TABLE "trip_signatures" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "signerName" TEXT NOT NULL,
  "signerRole" TEXT,
  "signatureData" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trip_signatures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trip_signatures_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
