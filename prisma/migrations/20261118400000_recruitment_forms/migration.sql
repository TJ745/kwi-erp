-- The joining letter and clearance form are their own modules now: their
-- Letters & Memos templates go (no letter was ever generated from them).
DELETE FROM "LetterTemplate" WHERE "type" IN ('JOINING_LETTER', 'CLEARANCE_FORM');


-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'PERSONNEL_REQUEST';
ALTER TYPE "EntityType" ADD VALUE 'INTERVIEW_EVALUATION';
ALTER TYPE "EntityType" ADD VALUE 'JOINING_LETTER';
ALTER TYPE "EntityType" ADD VALUE 'CLEARANCE_FORM';

-- AlterEnum
BEGIN;
CREATE TYPE "LetterType_new" AS ENUM ('JOB_OFFER', 'EMPLOYMENT_LETTER', 'SALARY_LETTER', 'EXPERIENCE_LETTER', 'WARNING_LETTER', 'VEHICLE_HANDOVER', 'ASSET_HANDOVER', 'RETURN_CONFIRMATION', 'MEMO', 'OTHER');
ALTER TABLE "LetterTemplate" ALTER COLUMN "type" TYPE "LetterType_new" USING ("type"::text::"LetterType_new");
ALTER TYPE "LetterType" RENAME TO "LetterType_old";
ALTER TYPE "LetterType_new" RENAME TO "LetterType";
DROP TYPE "public"."LetterType_old";
COMMIT;

-- AlterTable
ALTER TABLE "JobOffer" ADD COLUMN     "interviewId" TEXT;

-- CreateTable
CREATE TABLE "PersonnelRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "prrNo" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL,
    "positionId" TEXT,
    "departmentId" TEXT,
    "jobTitle" TEXT NOT NULL,
    "vacancies" INTEGER NOT NULL DEFAULT 1,
    "details" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonnelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewEvaluation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "prrId" TEXT,
    "applicantName" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "interviewDate" TIMESTAMP(3) NOT NULL,
    "details" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoiningLetter" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "letterDate" TIMESTAMP(3) NOT NULL,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JoiningLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClearanceForm" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "formDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "details" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClearanceForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelRequest_prrNo_key" ON "PersonnelRequest"("prrNo");

-- CreateIndex
CREATE INDEX "PersonnelRequest_companyId_requestDate_idx" ON "PersonnelRequest"("companyId", "requestDate");

-- CreateIndex
CREATE INDEX "PersonnelRequest_positionId_idx" ON "PersonnelRequest"("positionId");

-- CreateIndex
CREATE INDEX "PersonnelRequest_departmentId_idx" ON "PersonnelRequest"("departmentId");

-- CreateIndex
CREATE INDEX "InterviewEvaluation_companyId_interviewDate_idx" ON "InterviewEvaluation"("companyId", "interviewDate");

-- CreateIndex
CREATE INDEX "InterviewEvaluation_prrId_idx" ON "InterviewEvaluation"("prrId");

-- CreateIndex
CREATE INDEX "JoiningLetter_employeeId_idx" ON "JoiningLetter"("employeeId");

-- CreateIndex
CREATE INDEX "JoiningLetter_letterDate_idx" ON "JoiningLetter"("letterDate");

-- CreateIndex
CREATE INDEX "ClearanceForm_employeeId_idx" ON "ClearanceForm"("employeeId");

-- CreateIndex
CREATE INDEX "ClearanceForm_formDate_idx" ON "ClearanceForm"("formDate");

-- CreateIndex
CREATE INDEX "JobOffer_interviewId_idx" ON "JobOffer"("interviewId");

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "InterviewEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelRequest" ADD CONSTRAINT "PersonnelRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelRequest" ADD CONSTRAINT "PersonnelRequest_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelRequest" ADD CONSTRAINT "PersonnelRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewEvaluation" ADD CONSTRAINT "InterviewEvaluation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewEvaluation" ADD CONSTRAINT "InterviewEvaluation_prrId_fkey" FOREIGN KEY ("prrId") REFERENCES "PersonnelRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoiningLetter" ADD CONSTRAINT "JoiningLetter_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClearanceForm" ADD CONSTRAINT "ClearanceForm_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

