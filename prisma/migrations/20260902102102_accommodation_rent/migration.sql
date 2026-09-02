-- CreateEnum
CREATE TYPE "RentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- AlterTable
ALTER TABLE "Accommodation" ADD COLUMN     "leaseEndDate" TIMESTAMP(3),
ADD COLUMN     "leaseStartDate" TIMESTAMP(3),
ADD COLUMN     "rentAmount" DECIMAL(14,2),
ADD COLUMN     "rentCurrency" TEXT NOT NULL DEFAULT 'SAR',
ADD COLUMN     "rentDueDate" TIMESTAMP(3),
ADD COLUMN     "rentFrequency" "RentFrequency";

-- CreateIndex
CREATE INDEX "Accommodation_rentDueDate_idx" ON "Accommodation"("rentDueDate");
