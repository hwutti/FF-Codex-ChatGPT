CREATE TABLE "protocol_signatures" (
  "id" TEXT NOT NULL,
  "protocolId" TEXT NOT NULL,
  "signerName" TEXT NOT NULL,
  "signerRole" TEXT,
  "signatureData" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "protocol_signatures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "protocol_signatures_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
