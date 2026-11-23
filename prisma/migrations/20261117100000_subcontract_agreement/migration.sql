-- CreateEnum
CREATE TYPE "RateUnit" AS ENUM ('HOUR', 'DAY', 'MONTH', 'LUMP_SUM');

-- AlterTable
ALTER TABLE "Subcontractor" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "SubcontractorContract" ADD COLUMN     "agreementDate" TIMESTAMP(3),
ADD COLUMN     "terms" TEXT;

-- CreateTable
CREATE TABLE "SubcontractorContractRate" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "unit" "RateUnit" NOT NULL DEFAULT 'HOUR',

    CONSTRAINT "SubcontractorContractRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractDefaults" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "terms" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractDefaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubcontractorContractRate_contractId_sortOrder_idx" ON "SubcontractorContractRate"("contractId", "sortOrder");

-- AddForeignKey
ALTER TABLE "SubcontractorContractRate" ADD CONSTRAINT "SubcontractorContractRate_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SubcontractorContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The default terms new agreements start from, taken from the company's
-- existing manpower sub-contract. Editable from the Subcontractors page.
INSERT INTO "SubcontractDefaults" ("id", "terms", "updatedAt") VALUES ('default', $terms$Duty hours will be 12 hours per day, 7 days a week.
Overtime not be allowed.
Iqama should be valid for all of the employees, second party not allow to provide any expired employees iqamas.
All employees should follow the rules and regulations of KSA. If any penalty comes it should be second party responsibility.
All employees should follow company rules and regulations.
The validity of contract will be six months mutually agreeable after first party approvals.
Tools will be provided to employees from first party, second party will be fully responsible for any damage or loss of that tool.
Transportation, renew Iqamas, Food, Accommodation and Medical will be provided from second party.
Company will not release any payment without biometric attendance.
All the above-mentioned rates per hour are excluding 15% VAT.
Profession on Iqama's of all workers will be "carpenter, painter, worker, labor, loading and unloading" and will not be "private driver, barber and housemaid/housecleaner" as per HRSD rules and regulations.
Invoices will be submitted along with approved by both parties timesheet + biometric attendance (every 30 days).$terms$, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
