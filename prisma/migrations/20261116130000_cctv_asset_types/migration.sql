-- CCTV hardware becomes ordinary IT assets. Added on their own because
-- Postgres will not use a new enum value inside the transaction that adds it;
-- the next migration needs these to convert existing CCTV rows.
ALTER TYPE "AssetType" ADD VALUE 'CCTV_CAMERA';
ALTER TYPE "AssetType" ADD VALUE 'CCTV_RECORDER';
