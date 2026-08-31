-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "budgetedHeadcount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reportsToPositionId" TEXT;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_reportsToPositionId_fkey" FOREIGN KEY ("reportsToPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
