-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "form" JSONB;

-- "Request to cash without exit" on the printed form.
INSERT INTO "LeaveType" ("id", "key", "name", "isPaid", "isSystem", "createdAt", "updatedAt")
VALUES ('leavetype_encashment', 'ENCASHMENT', 'Leave Encashment (cash without exit)', true, true, now(), now())
ON CONFLICT ("key") DO NOTHING;
