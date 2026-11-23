-- Correspondence module removed. The table was empty; the IqamaRenewal link column was never set.
-- EntityType CORRESPONDENCE stays so past audit entries keep their meaning.
-- DropForeignKey
ALTER TABLE "Correspondence" DROP CONSTRAINT "Correspondence_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Correspondence" DROP CONSTRAINT "Correspondence_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "IqamaRenewal" DROP CONSTRAINT "IqamaRenewal_correspondenceId_fkey";

-- DropIndex
DROP INDEX "IqamaRenewal_correspondenceId_idx";

-- AlterTable
ALTER TABLE "IqamaRenewal" DROP COLUMN "correspondenceId";

-- DropTable
DROP TABLE "Correspondence";

-- DropEnum
DROP TYPE "CorrespondenceStatus";

-- DropEnum
DROP TYPE "CorrespondenceType";



-- RolePermission and UserPermission rows cascade.
DELETE FROM "Permission" WHERE "key" IN ('hr.correspondence.view', 'hr.correspondence.manage');
