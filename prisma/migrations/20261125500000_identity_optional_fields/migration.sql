-- AlterTable
ALTER TABLE "IqamaRecord" ALTER COLUMN "profession" DROP NOT NULL,
ALTER COLUMN "issueDate" DROP NOT NULL,
ALTER COLUMN "expiryDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PassportRecord" ALTER COLUMN "issueCountry" DROP NOT NULL,
ALTER COLUMN "issueDate" DROP NOT NULL,
ALTER COLUMN "expiryDate" DROP NOT NULL;

