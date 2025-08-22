/*
  Warnings:

  - The values [open] on the enum `BugStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BugStatus_new" AS ENUM ('in_progress', 'testing', 'fixed');
ALTER TABLE "Bug" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Bug" ALTER COLUMN "status" TYPE "BugStatus_new" USING ("status"::text::"BugStatus_new");
ALTER TYPE "BugStatus" RENAME TO "BugStatus_old";
ALTER TYPE "BugStatus_new" RENAME TO "BugStatus";
DROP TYPE "BugStatus_old";
ALTER TABLE "Bug" ALTER COLUMN "status" SET DEFAULT 'in_progress';
COMMIT;

-- AlterTable
ALTER TABLE "Bug" ALTER COLUMN "status" SET DEFAULT 'in_progress';

-- CreateTable
CREATE TABLE "TaskParticipant" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskParticipant_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateIndex
CREATE INDEX "TaskParticipant_userId_idx" ON "TaskParticipant"("userId");

-- CreateIndex
CREATE INDEX "Bug_taskId_status_idx" ON "Bug"("taskId", "status");

-- CreateIndex
CREATE INDEX "Task_userId_createdAt_idx" ON "Task"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- AddForeignKey
ALTER TABLE "TaskParticipant" ADD CONSTRAINT "TaskParticipant_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskParticipant" ADD CONSTRAINT "TaskParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
