-- "Electricity Meters" becomes "Utility Bills", and its free-text field is a
-- description entered when the meter is added. Renamed in place: no data moves.

ALTER TABLE "ElectricityMeter" RENAME TO "UtilityMeter";
ALTER TABLE "UtilityMeter" RENAME CONSTRAINT "ElectricityMeter_pkey" TO "UtilityMeter_pkey";
ALTER INDEX "ElectricityMeter_meterNumber_key" RENAME TO "UtilityMeter_meterNumber_key";
ALTER TABLE "UtilityMeter" RENAME COLUMN "notes" TO "description";

-- Audit rows written against the old name follow the rename.
ALTER TYPE "EntityType" RENAME VALUE 'ELECTRICITY_METER' TO 'UTILITY_METER';

UPDATE "Permission" SET "label" = 'View utility bills' WHERE "key" = 'meters.view';
UPDATE "Permission" SET "label" = 'Manage utility bills' WHERE "key" = 'meters.manage';
