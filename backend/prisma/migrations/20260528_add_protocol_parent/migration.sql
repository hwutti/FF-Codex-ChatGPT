ALTER TABLE "protocols" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "protocols"("id") ON DELETE SET NULL ON UPDATE CASCADE;
