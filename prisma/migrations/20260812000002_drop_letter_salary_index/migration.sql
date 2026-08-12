-- Reverses the index added in 20260812000001.
--
-- containsSalary is only ever an extra predicate on a primary-key lookup
-- (getGeneratedLetter reads one row by id), so a two-value btree costs writes
-- and serves nothing. Dropped in its own migration rather than by editing the
-- applied one, which would invalidate that migration's checksum.
DROP INDEX IF EXISTS "GeneratedLetter_containsSalary_idx";
