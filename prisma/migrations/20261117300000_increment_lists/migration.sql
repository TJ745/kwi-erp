-- Increments become increment lists (a printable document: current, demanded
-- and proposed salary per employee). The old one-per-employee Increment table
-- held no rows. Employees gain a monthly salary breakdown, which the lists
-- copy as 'current salary'.

-- DropForeignKey
ALTER TABLE "Increment" DROP CONSTRAINT "Increment_employeeId_fkey";

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "basicSalary" DECIMAL(12,2),
ADD COLUMN     "housingAllowance" DECIMAL(12,2),
ADD COLUMN     "otherAllowance" DECIMAL(12,2),
ADD COLUMN     "transportAllowance" DECIMAL(12,2);

-- DropTable
DROP TABLE "Increment";

-- CreateTable
CREATE TABLE "IncrementList" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "listDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncrementList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncrementListLine" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "curBasic" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "curTransport" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "curHousing" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "curOther" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "demBasic" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "demTransport" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "demHousing" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "demOther" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "propBasic" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "propTransport" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "propHousing" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "propOther" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "IncrementListLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncrementList_listDate_idx" ON "IncrementList"("listDate");

-- CreateIndex
CREATE INDEX "IncrementListLine_employeeId_idx" ON "IncrementListLine"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "IncrementListLine_listId_employeeId_key" ON "IncrementListLine"("listId", "employeeId");

-- AddForeignKey
ALTER TABLE "IncrementListLine" ADD CONSTRAINT "IncrementListLine_listId_fkey" FOREIGN KEY ("listId") REFERENCES "IncrementList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementListLine" ADD CONSTRAINT "IncrementListLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Permissions: salary becomes editable on the employee record, granted to the
-- roles that already edit bank details. Increment approval no longer exists
-- (RolePermission / UserPermission rows cascade).
INSERT INTO "Permission" ("id", "key", "module", "label", "isSensitive")
VALUES (gen_random_uuid()::text, 'employees.salary.manage', 'employees', 'Edit salary data', true)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT rp."roleId", np."id"
FROM "RolePermission" rp
JOIN "Permission" bp ON bp."id" = rp."permissionId" AND bp."key" = 'employees.bank.manage'
CROSS JOIN "Permission" np
WHERE np."key" = 'employees.salary.manage'
ON CONFLICT DO NOTHING;

UPDATE "Permission" SET "label" = 'View increment lists' WHERE "key" = 'hr.increments.view';
UPDATE "Permission" SET "label" = 'Manage increment lists' WHERE "key" = 'hr.increments.manage';
DELETE FROM "Permission" WHERE "key" = 'hr.increments.approve';
