-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- DropIndex
DROP INDEX "credential_name_trgm";

-- DropIndex
DROP INDEX "document_title_trgm";

-- DropIndex
DROP INDEX "employee_employee_no_trgm";

-- DropIndex
DROP INDEX "employee_full_name_ar_trgm";

-- DropIndex
DROP INDEX "employee_full_name_trgm";

-- DropIndex
DROP INDEX "it_asset_code_trgm";

-- DropIndex
DROP INDEX "it_asset_serial_trgm";

-- DropIndex
DROP INDEX "ticket_subject_trgm";

-- DropIndex
DROP INDEX "subcontractor_name_trgm";

-- DropIndex
DROP INDEX "supplier_name_trgm";

-- DropIndex
DROP INDEX "task_title_trgm";

-- DropIndex
DROP INDEX "vehicle_plate_trgm";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "emailAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailError" TEXT,
ADD COLUMN     "emailMessageId" TEXT,
ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "emailStatus" "EmailStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Notification_emailStatus_emailAttempts_idx" ON "Notification"("emailStatus", "emailAttempts");
