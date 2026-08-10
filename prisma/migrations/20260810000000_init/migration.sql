-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CashFlowType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CASH', 'CREDIT');

-- CreateEnum
CREATE TYPE "AccommodationType" AS ENUM ('APARTMENT', 'VILLA', 'CAMP', 'HOTEL', 'OTHER');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING_RENEWAL');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('ONBOARDING', 'OFFBOARDING', 'CLEARANCE');

-- CreateEnum
CREATE TYPE "ChecklistCategory" AS ENUM ('HR', 'IT', 'ADMIN', 'FINANCE', 'ACCOMMODATION', 'FLEET', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED', 'EXITED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERN');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'IN_MAINTENANCE', 'OUT_OF_SERVICE', 'SOLD', 'DISPOSED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('ROUTINE_SERVICE', 'OIL_CHANGE', 'TYRES', 'BRAKES', 'BODYWORK', 'ELECTRICAL', 'AC', 'INSPECTION', 'REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "FuelLevel" AS ENUM ('EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTER', 'FULL');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'PROBATION', 'TEMPORARY', 'CONSULTANCY');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarningLevel" AS ENUM ('VERBAL', 'FIRST_WRITTEN', 'SECOND_WRITTEN', 'FINAL');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN', 'CONVERTED');

-- CreateEnum
CREATE TYPE "CorrespondenceType" AS ENUM ('IQAMA_RENEWAL', 'VISA', 'GOVERNMENT', 'INSURANCE', 'BANK', 'INTERNAL', 'SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "CorrespondenceStatus" AS ENUM ('DRAFT', 'SENT', 'WAITING', 'FOLLOW_UP_REQUIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('LAPTOP', 'DESKTOP', 'MONITOR', 'PRINTER', 'MOBILE', 'TABLET', 'IP_PHONE', 'NETWORK', 'SERVER', 'PERIPHERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'UNDER_REPAIR', 'LOST', 'RETIRED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "CctvType" AS ENUM ('DOME', 'BULLET', 'PTZ', 'NVR', 'DVR');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpirySource" AS ENUM ('IQAMA', 'PASSPORT', 'EMPLOYEE_CONTRACT', 'DOCUMENT', 'COMPANY_CERTIFICATE', 'VEHICLE_REGISTRATION', 'VEHICLE_INSURANCE', 'SUBCONTRACTOR_CONTRACT', 'SUPPLIER_CONTRACT', 'MEDICAL_INSURANCE_POLICY', 'IT_ASSET_WARRANTY', 'SOFTWARE_LICENSE');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('EXPIRY', 'TASK_DUE', 'TASK_OVERDUE', 'APPROVAL_REQUIRED', 'TICKET_ASSIGNED', 'MENTION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'APPROVE', 'REJECT', 'ASSIGN', 'UNASSIGN', 'RETURN', 'UPLOAD', 'DOWNLOAD', 'VIEW', 'GENERATE', 'COMPLETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PERMISSION_CHANGE', 'EXPORT');

-- CreateEnum
CREATE TYPE "LetterType" AS ENUM ('JOINING_LETTER', 'JOB_OFFER', 'EMPLOYMENT_LETTER', 'SALARY_LETTER', 'EXPERIENCE_LETTER', 'WARNING_LETTER', 'CLEARANCE_FORM', 'VEHICLE_HANDOVER', 'ASSET_HANDOVER', 'RETURN_CONFIRMATION', 'MEMO', 'OTHER');

-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('GENERATED', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('EMPLOYEE', 'COMPANY', 'DEPARTMENT', 'VEHICLE', 'IT_ASSET', 'IT_TICKET', 'SERVER', 'NETWORK_DEVICE', 'CCTV_DEVICE', 'IP_PHONE', 'SOFTWARE_LICENSE', 'CREDENTIAL', 'SUPPLIER', 'SUBCONTRACTOR', 'CONTRACT', 'LEAVE_REQUEST', 'EVALUATION', 'WARNING_LETTER', 'INCREMENT', 'JOB_OFFER', 'CORRESPONDENCE', 'CHECKLIST_INSTANCE', 'CHECKLIST_ITEM', 'TASK', 'ACCOMMODATION', 'BED_ASSIGNMENT', 'PETTY_CASH_TRANSACTION', 'ELECTRICITY_BILL', 'COMPANY_CERTIFICATE', 'MEDICAL_INSURANCE_POLICY', 'GENERATED_LETTER', 'USER', 'ROLE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GrantEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'REJECTED');

-- CreateEnum
CREATE TYPE "VaultAccessLevel" AS ENUM ('READ', 'REVEAL', 'MANAGE');

-- CreateEnum
CREATE TYPE "VaultAction" AS ENUM ('LIST', 'VIEW', 'REVEAL', 'COPY', 'CREATE', 'UPDATE', 'DELETE', 'ROTATE', 'EXPORT', 'UNLOCK');

-- CreateTable
CREATE TABLE "PettyCashAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "custodianId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCashAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CashFlowType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCashCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "CashFlowType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "requesterId" TEXT,
    "receiptFileId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accommodation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "type" "AccommodationType" NOT NULL DEFAULT 'APARTMENT',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationRoom" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "floor" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccommodationRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationBed" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedLabel" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccommodationBed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedAssignment" (
    "id" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3),
    "assignedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "companyId" TEXT,
    "categoryId" TEXT,
    "paymentType" "PaymentType" NOT NULL DEFAULT 'CASH',
    "creditDays" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "crNumber" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractorContract" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "scope" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractorContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectricityBill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accommodationId" TEXT,
    "location" TEXT NOT NULL,
    "meterNumber" TEXT NOT NULL,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "fileId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectricityBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCertificate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "certificateTypeId" TEXT NOT NULL,
    "certificateNo" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "issuingAuthority" TEXT,
    "documentId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "portalCredentialId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalInsurancePolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "className" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "isWorking" BOOLEAN NOT NULL DEFAULT true,
    "coverageLimit" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalInsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeInsurance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "memberNumber" TEXT,
    "className" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleId" TEXT NOT NULL,
    "employeeId" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "effect" "GrantEffect" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId","permissionId")
);

-- CreateTable
CREATE TABLE "UserCompanyAccess" (
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCompanyAccess_pkey" PRIMARY KEY ("userId","companyId")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL,
    "companyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "category" "ChecklistCategory" NOT NULL,
    "responsibleDepartmentId" TEXT,
    "responsibleRoleId" TEXT,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "requiresDate" BOOLEAN NOT NULL DEFAULT false,
    "defaultDueDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "category" "ChecklistCategory" NOT NULL,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "attachmentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "detectedType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliesTo" "EntityType"[],
    "requiresExpiry" BOOLEAN NOT NULL DEFAULT false,
    "defaultWarningDays" INTEGER[] DEFAULT ARRAY[90, 60, 30, 15, 7, 1]::INTEGER[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentNo" TEXT,
    "fileId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "issuedBy" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "positionId" TEXT,
    "managerId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fullNameAr" TEXT,
    "gender" "Gender" NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT NOT NULL,
    "maritalStatus" "MaritalStatus",
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "lastWorkingDate" TIMESTAMP(3),
    "mobile" TEXT,
    "workEmail" TEXT,
    "personalEmail" TEXT,
    "photoFileId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeBankDetail" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "accountNo" TEXT,
    "swift" TEXT,
    "documentId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeBankDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "altPhone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IqamaRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "iqamaNumber" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "professionAr" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "sponsorName" TEXT,
    "renewalStatus" "RenewalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IqamaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IqamaRenewal" (
    "id" TEXT NOT NULL,
    "iqamaRecordId" TEXT NOT NULL,
    "previousExpiry" TIMESTAMP(3) NOT NULL,
    "newExpiry" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "RenewalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "correspondenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IqamaRenewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "passportNumber" TEXT NOT NULL,
    "issueCountry" TEXT NOT NULL,
    "issuePlace" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vehicleCode" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "plateNumberAr" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT,
    "vin" TEXT,
    "companyId" TEXT NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentDriverId" TEXT,
    "currentMileage" INTEGER,
    "registrationNo" TEXT,
    "registrationExpiry" TIMESTAMP(3),
    "insurancePolicyNo" TEXT,
    "insuranceProvider" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAssignment" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "unassignedAt" TIMESTAMP(3),
    "assignedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mileage" INTEGER,
    "type" "MaintenanceType" NOT NULL,
    "description" TEXT NOT NULL,
    "workshop" TEXT,
    "cost" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "receiptFileId" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "nextDueMileage" INTEGER,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleHandover" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fromEmployeeId" TEXT,
    "toEmployeeId" TEXT,
    "handoverDate" TIMESTAMP(3) NOT NULL,
    "mileage" INTEGER,
    "fuelLevel" "FuelLevel" NOT NULL,
    "condition" "AssetCondition" NOT NULL,
    "accessories" JSONB,
    "damages" JSONB,
    "remarks" TEXT,
    "issuedById" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "probationEndDate" TIMESTAMP(3),
    "basicSalary" DECIMAL(14,2),
    "allowances" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "maxDaysPerYear" INTEGER,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" DECIMAL(5,1) NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "handoverToId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "normalHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "delayedHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "overallScore" DECIMAL(4,2),
    "summary" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationScore" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "comment" TEXT,

    CONSTRAINT "EvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Increment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "currentSalary" DECIMAL(14,2) NOT NULL,
    "newSalary" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "percentage" DECIMAL(6,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Increment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarningLetter" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "level" "WarningLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "issuedById" TEXT NOT NULL,
    "documentId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarningLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDescription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "positionId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "responsibilities" TEXT,
    "requirements" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT,
    "candidatePhone" TEXT,
    "positionId" TEXT,
    "jobDescriptionId" TEXT,
    "proposedSalary" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "benefits" JSONB,
    "proposedJoiningDate" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "convertedEmployeeId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correspondence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "type" "CorrespondenceType" NOT NULL,
    "subject" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "sentDate" TIMESTAMP(3),
    "status" "CorrespondenceStatus" NOT NULL DEFAULT 'DRAFT',
    "followUpDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correspondence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultSlaHours" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITTicket" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "departmentId" TEXT,
    "categoryId" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignedToId" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "relatedAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITAsset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "assetTag" TEXT,
    "type" "AssetType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT,
    "companyId" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "warrantyExpiry" TIMESTAMP(3),
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "location" TEXT,
    "specifications" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ITAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITAssetAssignment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "assignedById" TEXT NOT NULL,
    "conditionOut" "AssetCondition" NOT NULL,
    "accessoriesOut" JSONB,
    "remarksOut" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "conditionIn" "AssetCondition",
    "missingAccessories" JSONB,
    "remarksIn" TEXT,
    "handoverDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITAssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "os" TEXT,
    "role" TEXT,
    "location" TEXT,
    "cpuSpec" TEXT,
    "ramGb" INTEGER,
    "storageGb" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "model" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "location" TEXT,
    "vlan" TEXT,
    "portCount" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpAddress" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "subnet" TEXT,
    "assignedTo" TEXT,
    "deviceId" TEXT,
    "isStatic" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpPhone" (
    "id" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "employeeId" TEXT,
    "deviceModel" TEXT,
    "macAddress" TEXT,
    "location" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CctvDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CctvType" NOT NULL,
    "location" TEXT NOT NULL,
    "ipAddress" TEXT,
    "recorderId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastMaintenanceAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CctvDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareLicense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "companyId" TEXT NOT NULL,
    "licenseKeyCredentialId" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "seatsUsed" INTEGER NOT NULL DEFAULT 0,
    "purchaseDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRecord" (
    "id" TEXT NOT NULL,
    "samAccountName" TEXT NOT NULL,
    "employeeId" TEXT,
    "ou" TEXT,
    "groups" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "shortName" TEXT NOT NULL,
    "registrationNo" TEXT,
    "crNumber" TEXT,
    "vatNumber" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SA',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoFileId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "parentId" TEXT,
    "headEmployeeId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "grade" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "taskNo" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "followUpDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "entityType" "EntityType",
    "entityId" TEXT,
    "parentTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpiryIndex" (
    "id" TEXT NOT NULL,
    "source" "ExpirySource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "companyId" TEXT,
    "employeeId" TEXT,
    "vehicleId" TEXT,
    "label" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "warningDays" INTEGER[] DEFAULT ARRAY[90, 60, 30, 15, 7, 1]::INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpiryIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "source" "ExpirySource",
    "thresholds" INTEGER[] DEFAULT ARRAY[90, 60, 30, 15, 7, 1, 0]::INTEGER[],
    "roleIds" TEXT[],
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" "EntityType",
    "entityId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "companyId" TEXT,
    "summary" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LetterType" NOT NULL,
    "companyId" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "bodyHtmlAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LetterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedLetter" (
    "id" TEXT NOT NULL,
    "letterNo" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "employeeId" TEXT,
    "renderedHtml" TEXT NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "fileId" TEXT,
    "status" "LetterStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "companyId" TEXT,
    "url" TEXT,
    "username" TEXT,
    "email" TEXT,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "wrappedDek" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "notesCipher" BYTEA,
    "notesIv" BYTEA,
    "notesAuthTag" BYTEA,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastRotatedAt" TIMESTAMP(3),
    "rotationDueAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialVersion" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "wrappedDek" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "CredentialVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialGrant" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT,
    "categoryId" TEXT,
    "userId" TEXT,
    "roleId" TEXT,
    "level" "VaultAccessLevel" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialAccess" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "VaultAction" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialFavorite" (
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialFavorite_pkey" PRIMARY KEY ("userId","credentialId")
);

-- CreateTable
CREATE TABLE "VaultSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,

    CONSTRAINT "VaultSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PettyCashAccount_companyId_isActive_idx" ON "PettyCashAccount"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashAccount_companyId_name_key" ON "PettyCashAccount"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashCategory_key_key" ON "PettyCashCategory"("key");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_accountId_date_idx" ON "PettyCashTransaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_companyId_date_type_idx" ON "PettyCashTransaction"("companyId", "date", "type");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_status_idx" ON "PettyCashTransaction"("status");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_categoryId_idx" ON "PettyCashTransaction"("categoryId");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_requesterId_idx" ON "PettyCashTransaction"("requesterId");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_receiptFileId_idx" ON "PettyCashTransaction"("receiptFileId");

-- CreateIndex
CREATE INDEX "Accommodation_companyId_status_idx" ON "Accommodation"("companyId", "status");

-- CreateIndex
CREATE INDEX "AccommodationRoom_accommodationId_status_idx" ON "AccommodationRoom"("accommodationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccommodationRoom_accommodationId_roomNumber_key" ON "AccommodationRoom"("accommodationId", "roomNumber");

-- CreateIndex
CREATE INDEX "AccommodationBed_status_idx" ON "AccommodationBed"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AccommodationBed_roomId_bedLabel_key" ON "AccommodationBed"("roomId", "bedLabel");

-- CreateIndex
CREATE INDEX "BedAssignment_bedId_checkOutDate_idx" ON "BedAssignment"("bedId", "checkOutDate");

-- CreateIndex
CREATE INDEX "BedAssignment_employeeId_checkOutDate_idx" ON "BedAssignment"("employeeId", "checkOutDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCategory_key_key" ON "SupplierCategory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_companyId_status_idx" ON "Supplier"("companyId", "status");

-- CreateIndex
CREATE INDEX "Supplier_categoryId_idx" ON "Supplier"("categoryId");

-- CreateIndex
CREATE INDEX "Supplier_deletedAt_idx" ON "Supplier"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subcontractor_code_key" ON "Subcontractor"("code");

-- CreateIndex
CREATE INDEX "Subcontractor_status_idx" ON "Subcontractor"("status");

-- CreateIndex
CREATE INDEX "Subcontractor_deletedAt_idx" ON "Subcontractor"("deletedAt");

-- CreateIndex
CREATE INDEX "SubcontractorContract_endDate_idx" ON "SubcontractorContract"("endDate");

-- CreateIndex
CREATE INDEX "SubcontractorContract_companyId_status_idx" ON "SubcontractorContract"("companyId", "status");

-- CreateIndex
CREATE INDEX "SubcontractorContract_documentId_idx" ON "SubcontractorContract"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubcontractorContract_subcontractorId_contractNo_key" ON "SubcontractorContract"("subcontractorId", "contractNo");

-- CreateIndex
CREATE INDEX "ElectricityBill_status_dueDate_idx" ON "ElectricityBill"("status", "dueDate");

-- CreateIndex
CREATE INDEX "ElectricityBill_companyId_dueDate_idx" ON "ElectricityBill"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "ElectricityBill_accommodationId_idx" ON "ElectricityBill"("accommodationId");

-- CreateIndex
CREATE INDEX "ElectricityBill_fileId_idx" ON "ElectricityBill"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectricityBill_meterNumber_billingPeriodStart_key" ON "ElectricityBill"("meterNumber", "billingPeriodStart");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateType_key_key" ON "CertificateType"("key");

-- CreateIndex
CREATE INDEX "CompanyCertificate_companyId_expiryDate_idx" ON "CompanyCertificate"("companyId", "expiryDate");

-- CreateIndex
CREATE INDEX "CompanyCertificate_certificateTypeId_idx" ON "CompanyCertificate"("certificateTypeId");

-- CreateIndex
CREATE INDEX "CompanyCertificate_documentId_idx" ON "CompanyCertificate"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyCertificate_companyId_certificateTypeId_certificateN_key" ON "CompanyCertificate"("companyId", "certificateTypeId", "certificateNo");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceProvider_name_key" ON "InsuranceProvider"("name");

-- CreateIndex
CREATE INDEX "MedicalInsurancePolicy_companyId_expiryDate_idx" ON "MedicalInsurancePolicy"("companyId", "expiryDate");

-- CreateIndex
CREATE INDEX "MedicalInsurancePolicy_status_expiryDate_idx" ON "MedicalInsurancePolicy"("status", "expiryDate");

-- CreateIndex
CREATE INDEX "MedicalInsurancePolicy_documentId_idx" ON "MedicalInsurancePolicy"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalInsurancePolicy_providerId_policyNumber_key" ON "MedicalInsurancePolicy"("providerId", "policyNumber");

-- CreateIndex
CREATE INDEX "EmployeeInsurance_policyId_status_idx" ON "EmployeeInsurance"("policyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeInsurance_employeeId_policyId_key" ON "EmployeeInsurance"("employeeId", "policyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_expiresAt_idx" ON "Verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_identifier_value_key" ON "Verification"("identifier", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE INDEX "Role_rank_idx" ON "Role"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserPermission_permissionId_idx" ON "UserPermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserPermission_grantedById_idx" ON "UserPermission"("grantedById");

-- CreateIndex
CREATE INDEX "UserPermission_expiresAt_idx" ON "UserPermission"("expiresAt");

-- CreateIndex
CREATE INDEX "UserCompanyAccess_companyId_idx" ON "UserCompanyAccess"("companyId");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_key_key" ON "ChecklistTemplate"("key");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_type_isActive_idx" ON "ChecklistTemplate"("type", "isActive");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_companyId_idx" ON "ChecklistTemplate"("companyId");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_responsibleDepartmentId_idx" ON "ChecklistTemplateItem"("responsibleDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplateItem_templateId_order_key" ON "ChecklistTemplateItem"("templateId", "order");

-- CreateIndex
CREATE INDEX "ChecklistInstance_employeeId_type_idx" ON "ChecklistInstance"("employeeId", "type");

-- CreateIndex
CREATE INDEX "ChecklistInstance_status_type_idx" ON "ChecklistInstance"("status", "type");

-- CreateIndex
CREATE INDEX "ChecklistInstance_companyId_type_idx" ON "ChecklistInstance"("companyId", "type");

-- CreateIndex
CREATE INDEX "ChecklistInstance_templateId_idx" ON "ChecklistInstance"("templateId");

-- CreateIndex
CREATE INDEX "ChecklistItem_instanceId_order_idx" ON "ChecklistItem"("instanceId", "order");

-- CreateIndex
CREATE INDEX "ChecklistItem_assignedToId_status_idx" ON "ChecklistItem"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "ChecklistItem_status_dueDate_idx" ON "ChecklistItem"("status", "dueDate");

-- CreateIndex
CREATE INDEX "ChecklistItem_templateItemId_idx" ON "ChecklistItem"("templateItemId");

-- CreateIndex
CREATE INDEX "ChecklistItem_attachmentId_idx" ON "ChecklistItem"("attachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_fileKey_key" ON "FileObject"("fileKey");

-- CreateIndex
CREATE INDEX "FileObject_checksumSha256_idx" ON "FileObject"("checksumSha256");

-- CreateIndex
CREATE INDEX "FileObject_scanStatus_idx" ON "FileObject"("scanStatus");

-- CreateIndex
CREATE INDEX "FileObject_uploadedById_idx" ON "FileObject"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_key_key" ON "DocumentType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Document_supersedesId_key" ON "Document"("supersedesId");

-- CreateIndex
CREATE INDEX "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Document_expiryDate_idx" ON "Document"("expiryDate");

-- CreateIndex
CREATE INDEX "Document_companyId_documentTypeId_idx" ON "Document"("companyId", "documentTypeId");

-- CreateIndex
CREATE INDEX "Document_fileId_idx" ON "Document"("fileId");

-- CreateIndex
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Attachment_fileId_idx" ON "Attachment"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNo_key" ON "Employee"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_workEmail_key" ON "Employee"("workEmail");

-- CreateIndex
CREATE INDEX "Employee_companyId_status_idx" ON "Employee"("companyId", "status");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");

-- CreateIndex
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

-- CreateIndex
CREATE INDEX "Employee_status_joiningDate_idx" ON "Employee"("status", "joiningDate");

-- CreateIndex
CREATE INDEX "Employee_deletedAt_idx" ON "Employee"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeBankDetail_employeeId_key" ON "EmployeeBankDetail"("employeeId");

-- CreateIndex
CREATE INDEX "EmergencyContact_employeeId_idx" ON "EmergencyContact"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "IqamaRecord_employeeId_key" ON "IqamaRecord"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "IqamaRecord_iqamaNumber_key" ON "IqamaRecord"("iqamaNumber");

-- CreateIndex
CREATE INDEX "IqamaRecord_expiryDate_idx" ON "IqamaRecord"("expiryDate");

-- CreateIndex
CREATE INDEX "IqamaRecord_renewalStatus_idx" ON "IqamaRecord"("renewalStatus");

-- CreateIndex
CREATE INDEX "IqamaRenewal_iqamaRecordId_idx" ON "IqamaRenewal"("iqamaRecordId");

-- CreateIndex
CREATE INDEX "IqamaRenewal_status_idx" ON "IqamaRenewal"("status");

-- CreateIndex
CREATE INDEX "IqamaRenewal_correspondenceId_idx" ON "IqamaRenewal"("correspondenceId");

-- CreateIndex
CREATE UNIQUE INDEX "PassportRecord_employeeId_key" ON "PassportRecord"("employeeId");

-- CreateIndex
CREATE INDEX "PassportRecord_expiryDate_idx" ON "PassportRecord"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "PassportRecord_passportNumber_issueCountry_key" ON "PassportRecord"("passportNumber", "issueCountry");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vehicleCode_key" ON "Vehicle"("vehicleCode");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_companyId_status_idx" ON "Vehicle"("companyId", "status");

-- CreateIndex
CREATE INDEX "Vehicle_registrationExpiry_idx" ON "Vehicle"("registrationExpiry");

-- CreateIndex
CREATE INDEX "Vehicle_insuranceExpiry_idx" ON "Vehicle"("insuranceExpiry");

-- CreateIndex
CREATE INDEX "Vehicle_currentDriverId_idx" ON "Vehicle"("currentDriverId");

-- CreateIndex
CREATE INDEX "Vehicle_deletedAt_idx" ON "Vehicle"("deletedAt");

-- CreateIndex
CREATE INDEX "VehicleAssignment_vehicleId_unassignedAt_idx" ON "VehicleAssignment"("vehicleId", "unassignedAt");

-- CreateIndex
CREATE INDEX "VehicleAssignment_employeeId_unassignedAt_idx" ON "VehicleAssignment"("employeeId", "unassignedAt");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_vehicleId_date_idx" ON "VehicleMaintenance"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_nextDueDate_idx" ON "VehicleMaintenance"("nextDueDate");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_receiptFileId_idx" ON "VehicleMaintenance"("receiptFileId");

-- CreateIndex
CREATE INDEX "VehicleHandover_vehicleId_handoverDate_idx" ON "VehicleHandover"("vehicleId", "handoverDate");

-- CreateIndex
CREATE INDEX "VehicleHandover_fromEmployeeId_idx" ON "VehicleHandover"("fromEmployeeId");

-- CreateIndex
CREATE INDEX "VehicleHandover_toEmployeeId_idx" ON "VehicleHandover"("toEmployeeId");

-- CreateIndex
CREATE INDEX "VehicleHandover_documentId_idx" ON "VehicleHandover"("documentId");

-- CreateIndex
CREATE INDEX "Contract_employeeId_status_idx" ON "Contract"("employeeId", "status");

-- CreateIndex
CREATE INDEX "Contract_endDate_idx" ON "Contract"("endDate");

-- CreateIndex
CREATE INDEX "Contract_companyId_status_idx" ON "Contract"("companyId", "status");

-- CreateIndex
CREATE INDEX "Contract_documentId_idx" ON "Contract"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_key_key" ON "LeaveType"("key");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_status_idx" ON "LeaveRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_startDate_idx" ON "LeaveRequest"("status", "startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_leaveTypeId_idx" ON "LeaveRequest"("leaveTypeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_approverId_idx" ON "LeaveRequest"("approverId");

-- CreateIndex
CREATE INDEX "LeaveRequest_handoverToId_idx" ON "LeaveRequest"("handoverToId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_date_status_idx" ON "TimesheetEntry"("date", "status");

-- CreateIndex
CREATE INDEX "TimesheetEntry_status_idx" ON "TimesheetEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetEntry_employeeId_date_key" ON "TimesheetEntry"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Evaluation_employeeId_periodEnd_idx" ON "Evaluation"("employeeId", "periodEnd");

-- CreateIndex
CREATE INDEX "Evaluation_evaluatorId_idx" ON "Evaluation"("evaluatorId");

-- CreateIndex
CREATE INDEX "Evaluation_status_idx" ON "Evaluation"("status");

-- CreateIndex
CREATE INDEX "Evaluation_documentId_idx" ON "Evaluation"("documentId");

-- CreateIndex
CREATE INDEX "EvaluationScore_evaluationId_idx" ON "EvaluationScore"("evaluationId");

-- CreateIndex
CREATE INDEX "Increment_employeeId_effectiveDate_idx" ON "Increment"("employeeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "Increment_status_effectiveDate_idx" ON "Increment"("status", "effectiveDate");

-- CreateIndex
CREATE INDEX "WarningLetter_employeeId_issuedDate_idx" ON "WarningLetter"("employeeId", "issuedDate");

-- CreateIndex
CREATE INDEX "WarningLetter_level_idx" ON "WarningLetter"("level");

-- CreateIndex
CREATE INDEX "WarningLetter_documentId_idx" ON "WarningLetter"("documentId");

-- CreateIndex
CREATE INDEX "JobDescription_companyId_isActive_idx" ON "JobDescription"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "JobDescription_positionId_idx" ON "JobDescription"("positionId");

-- CreateIndex
CREATE INDEX "JobOffer_companyId_status_idx" ON "JobOffer"("companyId", "status");

-- CreateIndex
CREATE INDEX "JobOffer_positionId_idx" ON "JobOffer"("positionId");

-- CreateIndex
CREATE INDEX "JobOffer_jobDescriptionId_idx" ON "JobOffer"("jobDescriptionId");

-- CreateIndex
CREATE INDEX "JobOffer_convertedEmployeeId_idx" ON "JobOffer"("convertedEmployeeId");

-- CreateIndex
CREATE INDEX "Correspondence_status_followUpDate_idx" ON "Correspondence"("status", "followUpDate");

-- CreateIndex
CREATE INDEX "Correspondence_employeeId_idx" ON "Correspondence"("employeeId");

-- CreateIndex
CREATE INDEX "Correspondence_companyId_type_idx" ON "Correspondence"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TicketCategory_key_key" ON "TicketCategory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ITTicket_ticketNo_key" ON "ITTicket"("ticketNo");

-- CreateIndex
CREATE INDEX "ITTicket_status_priority_idx" ON "ITTicket"("status", "priority");

-- CreateIndex
CREATE INDEX "ITTicket_assignedToId_status_idx" ON "ITTicket"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "ITTicket_companyId_createdAt_idx" ON "ITTicket"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ITTicket_requesterId_idx" ON "ITTicket"("requesterId");

-- CreateIndex
CREATE INDEX "ITTicket_categoryId_idx" ON "ITTicket"("categoryId");

-- CreateIndex
CREATE INDEX "ITTicket_departmentId_idx" ON "ITTicket"("departmentId");

-- CreateIndex
CREATE INDEX "ITTicket_relatedAssetId_idx" ON "ITTicket"("relatedAssetId");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ITAsset_assetCode_key" ON "ITAsset"("assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "ITAsset_assetTag_key" ON "ITAsset"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "ITAsset_serialNumber_key" ON "ITAsset"("serialNumber");

-- CreateIndex
CREATE INDEX "ITAsset_status_type_idx" ON "ITAsset"("status", "type");

-- CreateIndex
CREATE INDEX "ITAsset_companyId_status_idx" ON "ITAsset"("companyId", "status");

-- CreateIndex
CREATE INDEX "ITAsset_warrantyExpiry_idx" ON "ITAsset"("warrantyExpiry");

-- CreateIndex
CREATE INDEX "ITAsset_deletedAt_idx" ON "ITAsset"("deletedAt");

-- CreateIndex
CREATE INDEX "ITAssetAssignment_assetId_returnedAt_idx" ON "ITAssetAssignment"("assetId", "returnedAt");

-- CreateIndex
CREATE INDEX "ITAssetAssignment_employeeId_returnedAt_idx" ON "ITAssetAssignment"("employeeId", "returnedAt");

-- CreateIndex
CREATE INDEX "ITAssetAssignment_handoverDocumentId_idx" ON "ITAssetAssignment"("handoverDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Server_name_key" ON "Server"("name");

-- CreateIndex
CREATE INDEX "Server_companyId_status_idx" ON "Server"("companyId", "status");

-- CreateIndex
CREATE INDEX "NetworkDevice_companyId_status_idx" ON "NetworkDevice"("companyId", "status");

-- CreateIndex
CREATE INDEX "NetworkDevice_macAddress_idx" ON "NetworkDevice"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_address_key" ON "IpAddress"("address");

-- CreateIndex
CREATE INDEX "IpAddress_deviceId_idx" ON "IpAddress"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "IpPhone_extension_key" ON "IpPhone"("extension");

-- CreateIndex
CREATE INDEX "IpPhone_employeeId_idx" ON "IpPhone"("employeeId");

-- CreateIndex
CREATE INDEX "IpPhone_status_idx" ON "IpPhone"("status");

-- CreateIndex
CREATE INDEX "CctvDevice_companyId_status_idx" ON "CctvDevice"("companyId", "status");

-- CreateIndex
CREATE INDEX "CctvDevice_recorderId_idx" ON "CctvDevice"("recorderId");

-- CreateIndex
CREATE INDEX "SoftwareLicense_companyId_idx" ON "SoftwareLicense"("companyId");

-- CreateIndex
CREATE INDEX "SoftwareLicense_expiryDate_idx" ON "SoftwareLicense"("expiryDate");

-- CreateIndex
CREATE INDEX "SoftwareLicense_licenseKeyCredentialId_idx" ON "SoftwareLicense"("licenseKeyCredentialId");

-- CreateIndex
CREATE UNIQUE INDEX "AdRecord_samAccountName_key" ON "AdRecord"("samAccountName");

-- CreateIndex
CREATE INDEX "AdRecord_employeeId_idx" ON "AdRecord"("employeeId");

-- CreateIndex
CREATE INDEX "AdRecord_enabled_idx" ON "AdRecord"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "Company_deletedAt_idx" ON "Company"("deletedAt");

-- CreateIndex
CREATE INDEX "Department_companyId_status_idx" ON "Department"("companyId", "status");

-- CreateIndex
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

-- CreateIndex
CREATE INDEX "Department_headEmployeeId_idx" ON "Department"("headEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_code_key" ON "Department"("companyId", "code");

-- CreateIndex
CREATE INDEX "Position_companyId_status_idx" ON "Position"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Task_taskNo_key" ON "Task"("taskNo");

-- CreateIndex
CREATE INDEX "Task_assignedToId_status_idx" ON "Task"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_entityType_entityId_idx" ON "Task"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Task_companyId_status_idx" ON "Task"("companyId", "status");

-- CreateIndex
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "ExpiryIndex_isActive_expiryDate_idx" ON "ExpiryIndex"("isActive", "expiryDate");

-- CreateIndex
CREATE INDEX "ExpiryIndex_companyId_isActive_expiryDate_idx" ON "ExpiryIndex"("companyId", "isActive", "expiryDate");

-- CreateIndex
CREATE INDEX "ExpiryIndex_employeeId_idx" ON "ExpiryIndex"("employeeId");

-- CreateIndex
CREATE INDEX "ExpiryIndex_vehicleId_idx" ON "ExpiryIndex"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpiryIndex_source_sourceId_key" ON "ExpiryIndex"("source", "sourceId");

-- CreateIndex
CREATE INDEX "NotificationRule_kind_isActive_idx" ON "NotificationRule"("kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LetterTemplate_key_key" ON "LetterTemplate"("key");

-- CreateIndex
CREATE INDEX "LetterTemplate_type_isActive_idx" ON "LetterTemplate"("type", "isActive");

-- CreateIndex
CREATE INDEX "LetterTemplate_companyId_idx" ON "LetterTemplate"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedLetter_letterNo_key" ON "GeneratedLetter"("letterNo");

-- CreateIndex
CREATE INDEX "GeneratedLetter_entityType_entityId_idx" ON "GeneratedLetter"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "GeneratedLetter_templateId_generatedAt_idx" ON "GeneratedLetter"("templateId", "generatedAt");

-- CreateIndex
CREATE INDEX "GeneratedLetter_companyId_generatedAt_idx" ON "GeneratedLetter"("companyId", "generatedAt");

-- CreateIndex
CREATE INDEX "GeneratedLetter_employeeId_idx" ON "GeneratedLetter"("employeeId");

-- CreateIndex
CREATE INDEX "GeneratedLetter_fileId_idx" ON "GeneratedLetter"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "CredentialCategory_key_key" ON "CredentialCategory"("key");

-- CreateIndex
CREATE INDEX "CredentialCategory_parentId_idx" ON "CredentialCategory"("parentId");

-- CreateIndex
CREATE INDEX "Credential_categoryId_status_idx" ON "Credential"("categoryId", "status");

-- CreateIndex
CREATE INDEX "Credential_companyId_idx" ON "Credential"("companyId");

-- CreateIndex
CREATE INDEX "Credential_rotationDueAt_idx" ON "Credential"("rotationDueAt");

-- CreateIndex
CREATE INDEX "Credential_deletedAt_idx" ON "Credential"("deletedAt");

-- CreateIndex
CREATE INDEX "CredentialVersion_credentialId_changedAt_idx" ON "CredentialVersion"("credentialId", "changedAt");

-- CreateIndex
CREATE INDEX "CredentialGrant_credentialId_idx" ON "CredentialGrant"("credentialId");

-- CreateIndex
CREATE INDEX "CredentialGrant_categoryId_idx" ON "CredentialGrant"("categoryId");

-- CreateIndex
CREATE INDEX "CredentialGrant_userId_idx" ON "CredentialGrant"("userId");

-- CreateIndex
CREATE INDEX "CredentialGrant_roleId_idx" ON "CredentialGrant"("roleId");

-- CreateIndex
CREATE INDEX "CredentialGrant_expiresAt_idx" ON "CredentialGrant"("expiresAt");

-- CreateIndex
CREATE INDEX "CredentialAccess_credentialId_createdAt_idx" ON "CredentialAccess"("credentialId", "createdAt");

-- CreateIndex
CREATE INDEX "CredentialAccess_userId_createdAt_idx" ON "CredentialAccess"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CredentialAccess_action_createdAt_idx" ON "CredentialAccess"("action", "createdAt");

-- CreateIndex
CREATE INDEX "CredentialFavorite_credentialId_idx" ON "CredentialFavorite"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultSession_tokenHash_key" ON "VaultSession"("tokenHash");

-- CreateIndex
CREATE INDEX "VaultSession_userId_expiresAt_idx" ON "VaultSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "VaultSession_expiresAt_idx" ON "VaultSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "PettyCashAccount" ADD CONSTRAINT "PettyCashAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTransaction" ADD CONSTRAINT "PettyCashTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PettyCashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTransaction" ADD CONSTRAINT "PettyCashTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTransaction" ADD CONSTRAINT "PettyCashTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PettyCashCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTransaction" ADD CONSTRAINT "PettyCashTransaction_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTransaction" ADD CONSTRAINT "PettyCashTransaction_receiptFileId_fkey" FOREIGN KEY ("receiptFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationRoom" ADD CONSTRAINT "AccommodationRoom_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationBed" ADD CONSTRAINT "AccommodationBed_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AccommodationRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedAssignment" ADD CONSTRAINT "BedAssignment_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "AccommodationBed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedAssignment" ADD CONSTRAINT "BedAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SupplierCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractorContract" ADD CONSTRAINT "SubcontractorContract_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractorContract" ADD CONSTRAINT "SubcontractorContract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractorContract" ADD CONSTRAINT "SubcontractorContract_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricityBill" ADD CONSTRAINT "ElectricityBill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricityBill" ADD CONSTRAINT "ElectricityBill_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricityBill" ADD CONSTRAINT "ElectricityBill_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCertificate" ADD CONSTRAINT "CompanyCertificate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCertificate" ADD CONSTRAINT "CompanyCertificate_certificateTypeId_fkey" FOREIGN KEY ("certificateTypeId") REFERENCES "CertificateType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCertificate" ADD CONSTRAINT "CompanyCertificate_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalInsurancePolicy" ADD CONSTRAINT "MedicalInsurancePolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalInsurancePolicy" ADD CONSTRAINT "MedicalInsurancePolicy_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "InsuranceProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalInsurancePolicy" ADD CONSTRAINT "MedicalInsurancePolicy_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeInsurance" ADD CONSTRAINT "EmployeeInsurance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeInsurance" ADD CONSTRAINT "EmployeeInsurance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "MedicalInsurancePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompanyAccess" ADD CONSTRAINT "UserCompanyAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompanyAccess" ADD CONSTRAINT "UserCompanyAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_responsibleDepartmentId_fkey" FOREIGN KEY ("responsibleDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ChecklistInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "ChecklistTemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBankDetail" ADD CONSTRAINT "EmployeeBankDetail_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IqamaRecord" ADD CONSTRAINT "IqamaRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IqamaRenewal" ADD CONSTRAINT "IqamaRenewal_iqamaRecordId_fkey" FOREIGN KEY ("iqamaRecordId") REFERENCES "IqamaRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IqamaRenewal" ADD CONSTRAINT "IqamaRenewal_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportRecord" ADD CONSTRAINT "PassportRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_receiptFileId_fkey" FOREIGN KEY ("receiptFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleHandover" ADD CONSTRAINT "VehicleHandover_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleHandover" ADD CONSTRAINT "VehicleHandover_fromEmployeeId_fkey" FOREIGN KEY ("fromEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleHandover" ADD CONSTRAINT "VehicleHandover_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleHandover" ADD CONSTRAINT "VehicleHandover_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_handoverToId_fkey" FOREIGN KEY ("handoverToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Increment" ADD CONSTRAINT "Increment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarningLetter" ADD CONSTRAINT "WarningLetter_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarningLetter" ADD CONSTRAINT "WarningLetter_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_convertedEmployeeId_fkey" FOREIGN KEY ("convertedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITTicket" ADD CONSTRAINT "ITTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITTicket" ADD CONSTRAINT "ITTicket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITTicket" ADD CONSTRAINT "ITTicket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITTicket" ADD CONSTRAINT "ITTicket_relatedAssetId_fkey" FOREIGN KEY ("relatedAssetId") REFERENCES "ITAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ITTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITAsset" ADD CONSTRAINT "ITAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITAssetAssignment" ADD CONSTRAINT "ITAssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ITAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITAssetAssignment" ADD CONSTRAINT "ITAssetAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITAssetAssignment" ADD CONSTRAINT "ITAssetAssignment_handoverDocumentId_fkey" FOREIGN KEY ("handoverDocumentId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkDevice" ADD CONSTRAINT "NetworkDevice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "NetworkDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpPhone" ADD CONSTRAINT "IpPhone_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CctvDevice" ADD CONSTRAINT "CctvDevice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CctvDevice" ADD CONSTRAINT "CctvDevice_recorderId_fkey" FOREIGN KEY ("recorderId") REFERENCES "CctvDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareLicense" ADD CONSTRAINT "SoftwareLicense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareLicense" ADD CONSTRAINT "SoftwareLicense_licenseKeyCredentialId_fkey" FOREIGN KEY ("licenseKeyCredentialId") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRecord" ADD CONSTRAINT "AdRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headEmployeeId_fkey" FOREIGN KEY ("headEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpiryIndex" ADD CONSTRAINT "ExpiryIndex_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpiryIndex" ADD CONSTRAINT "ExpiryIndex_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterTemplate" ADD CONSTRAINT "LetterTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedLetter" ADD CONSTRAINT "GeneratedLetter_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "LetterTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedLetter" ADD CONSTRAINT "GeneratedLetter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedLetter" ADD CONSTRAINT "GeneratedLetter_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedLetter" ADD CONSTRAINT "GeneratedLetter_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialCategory" ADD CONSTRAINT "CredentialCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CredentialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CredentialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialVersion" ADD CONSTRAINT "CredentialVersion_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialGrant" ADD CONSTRAINT "CredentialGrant_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialGrant" ADD CONSTRAINT "CredentialGrant_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CredentialCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialGrant" ADD CONSTRAINT "CredentialGrant_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialAccess" ADD CONSTRAINT "CredentialAccess_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialFavorite" ADD CONSTRAINT "CredentialFavorite_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultSession" ADD CONSTRAINT "VaultSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
