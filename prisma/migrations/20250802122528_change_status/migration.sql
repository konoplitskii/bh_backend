/*
  Warnings:

  - The `status` column on the `Bug` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('open', 'in_progress', 'testing', 'fixed');

-- AlterTable
ALTER TABLE "Bug" DROP COLUMN "status",
ADD COLUMN     "status" "BugStatus" NOT NULL DEFAULT 'open';
