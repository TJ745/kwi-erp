-- Evaluations become evaluation lists with the company's Staff and Worker
-- forms. The old generic weighted evaluation (and its scores) held no rows.

-- CreateEnum
CREATE TYPE "EvaluationTemplate" AS ENUM ('STAFF', 'WORKER');

-- DropForeignKey
ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_documentId_fkey";

-- DropForeignKey
ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_evaluatorId_fkey";

-- DropForeignKey
ALTER TABLE "EvaluationScore" DROP CONSTRAINT "EvaluationScore_evaluationId_fkey";

-- DropIndex
DROP INDEX "Evaluation_documentId_idx";

-- DropIndex
DROP INDEX "Evaluation_employeeId_periodEnd_idx";

-- DropIndex
DROP INDEX "Evaluation_evaluatorId_idx";

-- DropIndex
DROP INDEX "Evaluation_status_idx";

-- AlterTable
ALTER TABLE "Evaluation" DROP COLUMN "documentId",
DROP COLUMN "evaluatorId",
DROP COLUMN "overallScore",
DROP COLUMN "periodEnd",
DROP COLUMN "periodStart",
DROP COLUMN "status",
DROP COLUMN "summary",
ADD COLUMN     "data" JSONB NOT NULL,
ADD COLUMN     "employeeComments" TEXT,
ADD COLUMN     "evaluationDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "finalRating" TEXT,
ADD COLUMN     "listId" TEXT NOT NULL,
ADD COLUMN     "managerComments" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "pdpCompleted" TIMESTAMP(3),
ADD COLUMN     "pdpStarted" TIMESTAMP(3),
ADD COLUMN     "section" TEXT,
ADD COLUMN     "template" "EvaluationTemplate" NOT NULL,
ADD COLUMN     "timeInPosition" TEXT;

-- DropTable
DROP TABLE "EvaluationScore";

-- CreateTable
CREATE TABLE "EvaluationList" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "listDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationList_listDate_idx" ON "EvaluationList"("listDate");

-- CreateIndex
CREATE INDEX "Evaluation_employeeId_evaluationDate_idx" ON "Evaluation"("employeeId", "evaluationDate");

-- CreateIndex
CREATE INDEX "Evaluation_managerId_idx" ON "Evaluation"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_listId_employeeId_key" ON "Evaluation"("listId", "employeeId");

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_listId_fkey" FOREIGN KEY ("listId") REFERENCES "EvaluationList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

