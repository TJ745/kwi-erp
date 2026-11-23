-- Warning letters print as the bilingual English / Arabic letter. The incident
-- sentence gains its Arabic text and an optional project / site; the
-- acknowledgement step is retired (the letter is signed on paper).
ALTER TABLE "WarningLetter" ADD COLUMN "descriptionAr" TEXT,
ADD COLUMN "project" TEXT;

ALTER TABLE "WarningLetter" DROP COLUMN "acknowledgedAt";
