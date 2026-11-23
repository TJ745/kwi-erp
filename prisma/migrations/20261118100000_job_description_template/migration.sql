-- Job descriptions follow the company's template (title, department, reports
-- to, oversees, duties and desired profile). The table held no rows.

-- AlterTable
ALTER TABLE "JobDescription" DROP COLUMN "requirements",
DROP COLUMN "responsibilities",
DROP COLUMN "summary",
ADD COLUMN     "department" TEXT,
ADD COLUMN     "departmental" TEXT,
ADD COLUMN     "education" TEXT,
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "organizational" TEXT,
ADD COLUMN     "others" TEXT,
ADD COLUMN     "oversees" TEXT,
ADD COLUMN     "reportsTo" TEXT,
ADD COLUMN     "skills" TEXT;

