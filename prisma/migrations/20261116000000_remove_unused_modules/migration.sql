-- Retires tasks, helpdesk, servers, Active Directory, software licences,
-- suppliers, petty cash and electricity bills. Network devices and electricity
-- bills are replaced by two hand-kept registers: device IPs (IpAddress) and
-- electricity meters (ElectricityMeter).
--
-- EntityType members of retired modules are deliberately kept: AuditLog rows
-- reference them, and the trail must stay readable.

ALTER TYPE "EntityType" ADD VALUE 'ELECTRICITY_METER';
ALTER TYPE "EntityType" ADD VALUE 'IP_ADDRESS';

-- DropForeignKey
ALTER TABLE "AdRecord" DROP CONSTRAINT "AdRecord_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "ElectricityBill" DROP CONSTRAINT "ElectricityBill_accommodationId_fkey";

-- DropForeignKey
ALTER TABLE "ElectricityBill" DROP CONSTRAINT "ElectricityBill_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ElectricityBill" DROP CONSTRAINT "ElectricityBill_fileId_fkey";

-- DropForeignKey
ALTER TABLE "ITTicket" DROP CONSTRAINT "ITTicket_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ITTicket" DROP CONSTRAINT "ITTicket_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ITTicket" DROP CONSTRAINT "ITTicket_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "ITTicket" DROP CONSTRAINT "ITTicket_relatedAssetId_fkey";

-- DropForeignKey
ALTER TABLE "IpAddress" DROP CONSTRAINT "IpAddress_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "NetworkDevice" DROP CONSTRAINT "NetworkDevice_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PettyCashAccount" DROP CONSTRAINT "PettyCashAccount_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PettyCashTransaction" DROP CONSTRAINT "PettyCashTransaction_accountId_fkey";

-- DropForeignKey
ALTER TABLE "PettyCashTransaction" DROP CONSTRAINT "PettyCashTransaction_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "PettyCashTransaction" DROP CONSTRAINT "PettyCashTransaction_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PettyCashTransaction" DROP CONSTRAINT "PettyCashTransaction_receiptFileId_fkey";

-- DropForeignKey
ALTER TABLE "PettyCashTransaction" DROP CONSTRAINT "PettyCashTransaction_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "Server" DROP CONSTRAINT "Server_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SoftwareLicense" DROP CONSTRAINT "SoftwareLicense_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SoftwareLicense" DROP CONSTRAINT "SoftwareLicense_licenseKeyCredentialId_fkey";

-- DropForeignKey
ALTER TABLE "Supplier" DROP CONSTRAINT "Supplier_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Supplier" DROP CONSTRAINT "Supplier_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_parentTaskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskComment" DROP CONSTRAINT "TaskComment_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TicketComment" DROP CONSTRAINT "TicketComment_ticketId_fkey";

-- DropIndex
DROP INDEX "IpAddress_deviceId_idx";

-- AlterTable
ALTER TABLE "IpAddress" DROP COLUMN "assignedTo",
DROP COLUMN "deviceId",
DROP COLUMN "isStatic",
DROP COLUMN "subnet",
ADD COLUMN     "deviceName" TEXT NOT NULL,
ADD COLUMN     "location" TEXT;

-- DropTable
DROP TABLE "AdRecord";

-- DropTable
DROP TABLE "ElectricityBill";

-- DropTable
DROP TABLE "ITTicket";

-- DropTable
DROP TABLE "NetworkDevice";

-- DropTable
DROP TABLE "PettyCashAccount";

-- DropTable
DROP TABLE "PettyCashCategory";

-- DropTable
DROP TABLE "PettyCashTransaction";

-- DropTable
DROP TABLE "Server";

-- DropTable
DROP TABLE "SoftwareLicense";

-- DropTable
DROP TABLE "Supplier";

-- DropTable
DROP TABLE "SupplierCategory";

-- DropTable
DROP TABLE "Task";

-- DropTable
DROP TABLE "TaskComment";

-- DropTable
DROP TABLE "TicketCategory";

-- DropTable
DROP TABLE "TicketComment";

-- DropEnum
DROP TYPE "BillStatus";

-- DropEnum
DROP TYPE "CashFlowType";

-- DropEnum
DROP TYPE "PaymentMethod";

-- DropEnum
DROP TYPE "PaymentType";

-- DropEnum
DROP TYPE "Priority";

-- DropEnum
DROP TYPE "TaskStatus";

-- DropEnum
DROP TYPE "TicketStatus";

-- CreateTable
CREATE TABLE "ElectricityMeter" (
    "id" TEXT NOT NULL,
    "meterNumber" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectricityMeter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElectricityMeter_meterNumber_key" ON "ElectricityMeter"("meterNumber");

-- CreateIndex
CREATE INDEX "IpAddress_deviceName_idx" ON "IpAddress"("deviceName");


-- ---------------------------------------------------------------------------
-- Reference data that pointed at the retired modules.
-- ---------------------------------------------------------------------------

-- Electricity permissions now govern meters. Renamed in place so existing role
-- mappings and per-user overrides carry over.
UPDATE "Permission" SET "key" = 'meters.view', "label" = 'View electricity meters'
  WHERE "key" = 'bills.view';
UPDATE "Permission" SET "key" = 'meters.manage', "label" = 'Manage electricity meters'
  WHERE "key" = 'bills.manage';

-- RolePermission and UserPermission rows cascade.
DELETE FROM "Permission" WHERE "key" IN (
  'pettycash.view', 'pettycash.create', 'pettycash.approve',
  'suppliers.view', 'suppliers.manage',
  'it.tickets.view', 'it.tickets.create', 'it.tickets.assign', 'it.tickets.resolve',
  'tasks.view', 'tasks.viewAll', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.assign'
);

DELETE FROM "ExpiryIndex" WHERE "source" = 'SOFTWARE_LICENSE';

DELETE FROM "Notification" WHERE "kind" IN ('TASK_DUE', 'TASK_OVERDUE', 'TICKET_ASSIGNED');
DELETE FROM "NotificationRule" WHERE "kind" IN ('TASK_DUE', 'TASK_OVERDUE', 'TICKET_ASSIGNED');

DELETE FROM "Counter" WHERE "key" IN ('task', 'ticket') OR "key" LIKE 'ticket:%';

DELETE FROM "DocumentType" WHERE "key" IN ('BILL_SCAN', 'BILL_PAYMENT', 'VENDOR_QUOTE')
  AND NOT EXISTS (SELECT 1 FROM "Document" d WHERE d."documentTypeId" = "DocumentType"."id");
UPDATE "DocumentType"
  SET "appliesTo" = array_remove(array_remove("appliesTo", 'SUPPLIER'::"EntityType"), 'ELECTRICITY_BILL'::"EntityType")
  WHERE 'SUPPLIER'::"EntityType" = ANY("appliesTo") OR 'ELECTRICITY_BILL'::"EntityType" = ANY("appliesTo");
