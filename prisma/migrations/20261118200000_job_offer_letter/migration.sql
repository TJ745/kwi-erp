-- Job offers carry everything the printed employment offer needs: candidate
-- ID and address, reference, salary breakdown and the chosen terms.

-- AlterTable
ALTER TABLE "JobOffer" ADD COLUMN     "basicSalary" DECIMAL(12,2),
ADD COLUMN     "candidateAddress" TEXT,
ADD COLUMN     "candidateIdNumber" TEXT,
ADD COLUMN     "candidateIdType" TEXT,
ADD COLUMN     "contractYears" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "familyStatus" TEXT NOT NULL DEFAULT 'WITHOUT_FAMILY',
ADD COLUMN     "housingAllowance" DECIMAL(12,2),
ADD COLUMN     "leavePlan" TEXT NOT NULL DEFAULT '30_AFTER_1Y',
ADD COLUMN     "medicalCover" TEXT NOT NULL DEFAULT 'SELF',
ADD COLUMN     "mobileAllowance" DECIMAL(12,2),
ADD COLUMN     "offerDate" TIMESTAMP(3),
ADD COLUMN     "probationDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "refNo" TEXT,
ADD COLUMN     "salutation" TEXT NOT NULL DEFAULT 'Mr.',
ADD COLUMN     "ticketCover" TEXT NOT NULL DEFAULT 'SELF',
ADD COLUMN     "ticketDestination" TEXT,
ADD COLUMN     "transportAllowance" DECIMAL(12,2);

