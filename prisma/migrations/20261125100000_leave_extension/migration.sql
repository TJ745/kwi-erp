-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "extendsLeaveId" TEXT;

-- CreateIndex
CREATE INDEX "LeaveRequest_extendsLeaveId_idx" ON "LeaveRequest"("extendsLeaveId");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_extendsLeaveId_fkey" FOREIGN KEY ("extendsLeaveId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

