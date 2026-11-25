-- AlterEnum
ALTER TYPE "EmployeeStatus" ADD VALUE 'NEW_HIRE';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "contractYears" INTEGER,
ADD COLUMN     "familyStatus" TEXT,
ADD COLUMN     "homeAddressAr" TEXT,
ADD COLUMN     "homeAddressEn" TEXT,
ADD COLUMN     "homePhone" TEXT,
ADD COLUMN     "leavePlan" TEXT,
ADD COLUMN     "medicalCover" TEXT,
ADD COLUMN     "probationDays" INTEGER,
ADD COLUMN     "saudiAddressAr" TEXT,
ADD COLUMN     "saudiAddressEn" TEXT,
ADD COLUMN     "ticketCover" TEXT,
ADD COLUMN     "ticketDestination" TEXT;

-- AlterTable
ALTER TABLE "InterviewEvaluation" ADD COLUMN     "employeeId" TEXT;

-- CreateIndex
CREATE INDEX "InterviewEvaluation_employeeId_idx" ON "InterviewEvaluation"("employeeId");

-- AddForeignKey
ALTER TABLE "InterviewEvaluation" ADD CONSTRAINT "InterviewEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

