
-- AlterTable
ALTER TABLE "VehicleMaintenance" ADD COLUMN     "additionalDetails" TEXT,
ADD COLUMN     "driverId" TEXT,
ADD COLUMN     "driverNotes" TEXT,
ADD COLUMN     "otherService" TEXT,
ADD COLUMN     "previousMileage" INTEGER,
ADD COLUMN     "requestNo" TEXT,
ADD COLUMN     "requiredParts" TEXT,
ADD COLUMN     "services" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMaintenance_requestNo_key" ON "VehicleMaintenance"("requestNo");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_driverId_idx" ON "VehicleMaintenance"("driverId");

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

