CREATE TABLE "einsatzplan_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#16a34a',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "einsatzplan_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "einsatzplaene" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "folderId" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "einsatzplaene_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "einsatzplan_folders" ADD CONSTRAINT "einsatzplan_folders_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "einsatzplan_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "einsatzplaene" ADD CONSTRAINT "einsatzplaene_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "einsatzplan_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
