-- Adds CRITICAL to the shared Priority enum.
--
-- Tasks use LOW/MEDIUM/HIGH/URGENT (brief §32) and IT tickets use
-- LOW/MEDIUM/HIGH/CRITICAL (brief §23). One enum carries both; each module
-- exposes only its own set in the UI.
--
-- ALTER TYPE ... ADD VALUE is safe here: it appends, so existing rows and
-- indexes are untouched, and no value is used in this same transaction.
ALTER TYPE "Priority" ADD VALUE IF NOT EXISTS 'CRITICAL';
