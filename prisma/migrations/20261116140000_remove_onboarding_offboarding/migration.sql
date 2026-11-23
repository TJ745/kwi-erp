-- Removes onboarding, offboarding and clearance checklists entirely: templates,
-- started checklists and their steps. CHECKLIST_* EntityType members stay so
-- the audit trail remains readable.


-- DropForeignKey
ALTER TABLE "ChecklistInstance" DROP CONSTRAINT "ChecklistInstance_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistInstance" DROP CONSTRAINT "ChecklistInstance_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistInstance" DROP CONSTRAINT "ChecklistInstance_templateId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistItem" DROP CONSTRAINT "ChecklistItem_attachmentId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistItem" DROP CONSTRAINT "ChecklistItem_instanceId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistItem" DROP CONSTRAINT "ChecklistItem_templateItemId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistTemplate" DROP CONSTRAINT "ChecklistTemplate_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistTemplateItem" DROP CONSTRAINT "ChecklistTemplateItem_responsibleDepartmentId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistTemplateItem" DROP CONSTRAINT "ChecklistTemplateItem_templateId_fkey";

-- DropTable
DROP TABLE "ChecklistInstance";

-- DropTable
DROP TABLE "ChecklistItem";

-- DropTable
DROP TABLE "ChecklistTemplate";

-- DropTable
DROP TABLE "ChecklistTemplateItem";

-- DropEnum
DROP TYPE "ChecklistCategory";

-- DropEnum
DROP TYPE "ChecklistItemStatus";

-- DropEnum
DROP TYPE "ChecklistStatus";

-- DropEnum
DROP TYPE "ChecklistType";


-- RolePermission and UserPermission rows cascade.
DELETE FROM "Permission" WHERE "key" IN (
  'hr.onboarding.view', 'hr.onboarding.manage',
  'hr.offboarding.view', 'hr.offboarding.manage',
  'hr.clearance.confirm'
);
