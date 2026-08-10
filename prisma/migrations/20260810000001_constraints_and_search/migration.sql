-- =============================================================================
-- Constraints and search indexes that the Prisma schema language cannot express.
--
-- The three partial unique indexes below are what actually make the business
-- rules in docs/MODULES.md §7 true under concurrency. Service-layer checks
-- alone lose a race between two simultaneous requests.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rule: "An asset cannot be assigned to two employees simultaneously."
-- An assignment is active while returnedAt IS NULL.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX "it_asset_single_active_assignment"
  ON "ITAssetAssignment" ("assetId")
  WHERE "returnedAt" IS NULL;

-- -----------------------------------------------------------------------------
-- Rule: "A vehicle has one active driver."
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX "vehicle_single_active_driver"
  ON "VehicleAssignment" ("vehicleId")
  WHERE "unassignedAt" IS NULL;

-- -----------------------------------------------------------------------------
-- Rule: "A bed holds one occupant."
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX "bed_single_active_occupant"
  ON "BedAssignment" ("bedId")
  WHERE "checkOutDate" IS NULL;

-- -----------------------------------------------------------------------------
-- Rule: an employee may hold only one active (non-returned) assignment per
-- asset type is NOT enforced -- an employee may legitimately hold a laptop and
-- a monitor. Documented here so the omission is understood as deliberate.
-- -----------------------------------------------------------------------------


-- =============================================================================
-- Global search (docs/DATABASE.md §17).
--
-- Trigram indexes serve the "find the employee called Ahmed" case with
-- ILIKE '%...%'. Full-text search (tsvector) is deliberately deferred.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "employee_full_name_trgm"
  ON "Employee" USING GIN ("fullName" gin_trgm_ops);

CREATE INDEX "employee_full_name_ar_trgm"
  ON "Employee" USING GIN ("fullNameAr" gin_trgm_ops);

CREATE INDEX "employee_employee_no_trgm"
  ON "Employee" USING GIN ("employeeNo" gin_trgm_ops);

CREATE INDEX "it_asset_serial_trgm"
  ON "ITAsset" USING GIN ("serialNumber" gin_trgm_ops);

CREATE INDEX "it_asset_code_trgm"
  ON "ITAsset" USING GIN ("assetCode" gin_trgm_ops);

CREATE INDEX "vehicle_plate_trgm"
  ON "Vehicle" USING GIN ("plateNumber" gin_trgm_ops);

CREATE INDEX "supplier_name_trgm"
  ON "Supplier" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "subcontractor_name_trgm"
  ON "Subcontractor" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "document_title_trgm"
  ON "Document" USING GIN ("title" gin_trgm_ops);

CREATE INDEX "task_title_trgm"
  ON "Task" USING GIN ("title" gin_trgm_ops);

CREATE INDEX "ticket_subject_trgm"
  ON "ITTicket" USING GIN ("subject" gin_trgm_ops);

CREATE INDEX "credential_name_trgm"
  ON "Credential" USING GIN ("name" gin_trgm_ops);


-- =============================================================================
-- Data integrity guards.
-- =============================================================================

-- A leave request cannot end before it starts.
ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "leave_request_date_order" CHECK ("endDate" >= "startDate");

-- Contract end date, when present, must follow the start date.
ALTER TABLE "Contract"
  ADD CONSTRAINT "contract_date_order"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

-- Document expiry, when present, must follow issue date.
ALTER TABLE "Document"
  ADD CONSTRAINT "document_date_order"
  CHECK ("issueDate" IS NULL OR "expiryDate" IS NULL OR "expiryDate" >= "issueDate");

-- Iqama and passport expiry must follow issue.
ALTER TABLE "IqamaRecord"
  ADD CONSTRAINT "iqama_date_order" CHECK ("expiryDate" >= "issueDate");

ALTER TABLE "PassportRecord"
  ADD CONSTRAINT "passport_date_order" CHECK ("expiryDate" >= "issueDate");

-- A bed cannot be checked out before check-in.
ALTER TABLE "BedAssignment"
  ADD CONSTRAINT "bed_assignment_date_order"
  CHECK ("checkOutDate" IS NULL OR "checkOutDate" >= "checkInDate");

-- An asset cannot be returned before it was assigned.
ALTER TABLE "ITAssetAssignment"
  ADD CONSTRAINT "asset_assignment_date_order"
  CHECK ("returnedAt" IS NULL OR "returnedAt" >= "assignedAt");

-- Petty cash and bill amounts are never negative; direction is carried by
-- the type/status column, not by the sign of the amount.
ALTER TABLE "PettyCashTransaction"
  ADD CONSTRAINT "petty_cash_amount_non_negative" CHECK ("amount" >= 0);

ALTER TABLE "ElectricityBill"
  ADD CONSTRAINT "electricity_bill_amount_non_negative" CHECK ("amount" >= 0);

-- Accommodation capacity must be positive.
ALTER TABLE "AccommodationRoom"
  ADD CONSTRAINT "room_capacity_positive" CHECK ("capacity" > 0);

-- Software licence seat usage cannot exceed the seats owned.
ALTER TABLE "SoftwareLicense"
  ADD CONSTRAINT "software_seats_valid"
  CHECK ("seatsUsed" >= 0 AND "seatsUsed" <= "seats");

-- Vault: a credential must always carry a complete GCM payload. This makes a
-- partially-written encryption record impossible to persist.
ALTER TABLE "Credential"
  ADD CONSTRAINT "credential_payload_complete"
  CHECK (
    octet_length("ciphertext") > 0
    AND octet_length("iv") = 12
    AND octet_length("authTag") = 16
    AND octet_length("wrappedDek") > 0
    AND "keyVersion" >= 1
  );

ALTER TABLE "CredentialVersion"
  ADD CONSTRAINT "credential_version_payload_complete"
  CHECK (
    octet_length("ciphertext") > 0
    AND octet_length("iv") = 12
    AND octet_length("authTag") = 16
    AND octet_length("wrappedDek") > 0
    AND "keyVersion" >= 1
  );
