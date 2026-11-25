-- CreateEnum
CREATE TYPE "DailyTaskStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "receivedFrom" TEXT NOT NULL,
    "remarks" TEXT,
    "status" "DailyTaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyTask_userId_status_idx" ON "DailyTask"("userId", "status");

-- CreateIndex
CREATE INDEX "DailyTask_userId_taskDate_idx" ON "DailyTask"("userId", "taskDate");

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

