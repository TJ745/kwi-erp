-- An IP phone entry is now an extension pointing at its handset asset. Model,
-- MAC, location, status and holder are read from the asset instead of being
-- typed a second time. MAC address moves onto ITAsset.

-- DropForeignKey
ALTER TABLE "IpPhone" DROP CONSTRAINT "IpPhone_employeeId_fkey";

-- DropIndex
DROP INDEX "IpPhone_employeeId_idx";

-- DropIndex
DROP INDEX "IpPhone_status_idx";

-- AlterTable
ALTER TABLE "ITAsset" ADD COLUMN     "macAddress" TEXT;

-- AlterTable
ALTER TABLE "IpPhone" DROP COLUMN "deviceModel",
DROP COLUMN "employeeId",
DROP COLUMN "location",
DROP COLUMN "macAddress",
DROP COLUMN "status",
ADD COLUMN     "assetId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ITAsset_macAddress_key" ON "ITAsset"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "IpPhone_assetId_key" ON "IpPhone"("assetId");

-- AddForeignKey
ALTER TABLE "IpPhone" ADD CONSTRAINT "IpPhone_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ITAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

