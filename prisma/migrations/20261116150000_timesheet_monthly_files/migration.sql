-- The day-by-day timesheet is replaced by monthly files: the timesheet is kept
-- in Excel and uploaded here, one file per company per month.


-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'TIMESHEET_FILE';

-- DropForeignKey
ALTER TABLE "TimesheetEntry" DROP CONSTRAINT "TimesheetEntry_employeeId_fkey";

-- DropTable
DROP TABLE "TimesheetEntry";

-- CreateTable
CREATE TABLE "TimesheetFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "fileId" TEXT NOT NULL,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetFile_fileId_key" ON "TimesheetFile"("fileId");

-- CreateIndex
CREATE INDEX "TimesheetFile_month_idx" ON "TimesheetFile"("month");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetFile_companyId_month_key" ON "TimesheetFile"("companyId", "month");

-- AddForeignKey
ALTER TABLE "TimesheetFile" ADD CONSTRAINT "TimesheetFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetFile" ADD CONSTRAINT "TimesheetFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Approval belonged to the day-by-day entries. RolePermission and
-- UserPermission rows cascade.
DELETE FROM "Permission" WHERE "key" = 'hr.timesheet.approve';
UPDATE "Permission" SET "label" = 'View and download timesheet files' WHERE "key" = 'hr.timesheet.view';
UPDATE "Permission" SET "label" = 'Upload and delete timesheet files' WHERE "key" = 'hr.timesheet.manage';
