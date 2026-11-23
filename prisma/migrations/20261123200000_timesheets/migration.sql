-- CreateEnum
CREATE TYPE "TimesheetGroup" AS ENUM ('ALL', 'NON_SAUDI', 'SAUDI');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'TIMESHEET';

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "companyIds" TEXT[],
    "group" "TimesheetGroup" NOT NULL DEFAULT 'NON_SAUDI',
    "signedFileId" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetEntry" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "weekend" TEXT NOT NULL DEFAULT 'FRI',
    "days" JSONB NOT NULL,
    "extra" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_signedFileId_key" ON "Timesheet"("signedFileId");

-- CreateIndex
CREATE INDEX "Timesheet_month_idx" ON "Timesheet"("month");

-- CreateIndex
CREATE INDEX "TimesheetEntry_employeeId_idx" ON "TimesheetEntry"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetEntry_timesheetId_employeeId_key" ON "TimesheetEntry"("timesheetId", "employeeId");

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_signedFileId_fkey" FOREIGN KEY ("signedFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

