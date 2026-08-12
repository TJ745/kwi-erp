-- A generated letter can embed a salary figure in its rendered body, which
-- would otherwise let a role without employees.salary.view read one.
ALTER TABLE "GeneratedLetter"
  ADD COLUMN "containsSalary" BOOLEAN NOT NULL DEFAULT false;

-- Existing rows predate the flag. Assume sensitive rather than assume safe:
-- the false default would silently expose any letter generated before this.
UPDATE "GeneratedLetter" SET "containsSalary" = true;

-- Filtered lists check this alongside the company scope.
CREATE INDEX "GeneratedLetter_containsSalary_idx"
  ON "GeneratedLetter" ("containsSalary");
