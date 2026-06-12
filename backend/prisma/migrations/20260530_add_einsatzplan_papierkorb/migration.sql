ALTER TABLE "einsatzplaene" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE TABLE "einsatzplan_papierkorb" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "folderId" TEXT,
    "folderName" TEXT,
    "deletedBy" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "einsatzplan_papierkorb_pkey" PRIMARY KEY ("id")
);
