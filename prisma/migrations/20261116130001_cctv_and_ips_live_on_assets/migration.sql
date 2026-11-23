-- The hardware is always an IT asset now:
--   * ITAsset gains ipAddress; the hand-kept IpAddress register (empty) goes,
--     and the Device IPs page reads the column instead.
--   * Each CctvDevice keeps only CCTV-specific fields and points at an asset.
--     Existing CCTV rows are converted into assets here, so nothing is lost.

ALTER TABLE "ITAsset" ADD COLUMN "ipAddress" TEXT;
CREATE UNIQUE INDEX "ITAsset_ipAddress_key" ON "ITAsset"("ipAddress");

DROP TABLE "IpAddress";

-- --- Convert existing CCTV devices into assets -----------------------------
INSERT INTO "Counter" ("key", "value", "updatedAt") VALUES ('asset', 0, now())
  ON CONFLICT ("key") DO NOTHING;

ALTER TABLE "CctvDevice" ADD COLUMN "assetId" TEXT;

WITH numbered AS (
  SELECT c.*, row_number() OVER (ORDER BY c."createdAt", c."id") AS rn
  FROM "CctvDevice" c
),
base AS (SELECT "value" FROM "Counter" WHERE "key" = 'asset')
INSERT INTO "ITAsset" (
  "id", "assetCode", "type", "brand", "model", "companyId", "location",
  "ipAddress", "status", "notes", "createdAt", "updatedAt"
)
SELECT
  'cctv-' || n."id",
  'IT-' || lpad((b."value" + n.rn)::text, 5, '0'),
  (CASE WHEN n."type" IN ('NVR', 'DVR') THEN 'CCTV_RECORDER' ELSE 'CCTV_CAMERA' END)::"AssetType",
  n."name",
  n."type"::text,
  n."companyId",
  n."location",
  n."ipAddress",
  (CASE n."status" WHEN 'ACTIVE' THEN 'AVAILABLE' ELSE 'RETIRED' END)::"AssetStatus",
  'Converted from the CCTV register.',
  n."createdAt",
  now()
FROM numbered n CROSS JOIN base b;

UPDATE "Counter"
  SET "value" = "value" + (SELECT count(*) FROM "CctvDevice"), "updatedAt" = now()
  WHERE "key" = 'asset';

UPDATE "CctvDevice" SET "assetId" = 'cctv-' || "id";

-- --- Drop the duplicated hardware columns ----------------------------------
ALTER TABLE "CctvDevice" DROP CONSTRAINT "CctvDevice_companyId_fkey";
DROP INDEX "CctvDevice_companyId_status_idx";
ALTER TABLE "CctvDevice" DROP COLUMN "companyId",
  DROP COLUMN "ipAddress",
  DROP COLUMN "location",
  DROP COLUMN "name",
  DROP COLUMN "status",
  ALTER COLUMN "assetId" SET NOT NULL;

CREATE UNIQUE INDEX "CctvDevice_assetId_key" ON "CctvDevice"("assetId");
ALTER TABLE "CctvDevice" ADD CONSTRAINT "CctvDevice_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "ITAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
