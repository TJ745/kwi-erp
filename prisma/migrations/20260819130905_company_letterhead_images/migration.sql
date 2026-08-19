-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "footerImageFileId" TEXT,
ADD COLUMN     "headerImageFileId" TEXT;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_headerImageFileId_fkey" FOREIGN KEY ("headerImageFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_footerImageFileId_fkey" FOREIGN KEY ("footerImageFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
