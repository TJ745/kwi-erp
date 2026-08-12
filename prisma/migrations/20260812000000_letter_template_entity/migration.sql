-- Letter templates are audited in their own right (created, edited, deactivated),
-- separately from the letters generated from them.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'LETTER_TEMPLATE';
