-- The employment contract prints from the system: company Arabic details and
-- signatory, and per-contract document fields. Contracts held no rows.

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "addressAr" TEXT,
ADD COLUMN     "cityAr" TEXT,
ADD COLUMN     "headOfficeCity" TEXT,
ADD COLUMN     "headOfficeCityAr" TEXT,
ADD COLUMN     "signatoryName" TEXT,
ADD COLUMN     "signatoryNameAr" TEXT,
ADD COLUMN     "signatoryTitle" TEXT,
ADD COLUMN     "signatoryTitleAr" TEXT;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "contractDate" TIMESTAMP(3),
ADD COLUMN     "hoursPerDay" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "jobDescriptionId" TEXT,
ADD COLUMN     "particulars" JSONB,
ADD COLUMN     "positionTitle" TEXT,
ADD COLUMN     "termYears" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "workDaysPerWeek" INTEGER NOT NULL DEFAULT 5;

