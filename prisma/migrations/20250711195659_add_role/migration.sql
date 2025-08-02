-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "JobRole" AS ENUM ('developer', 'tester', 'analyst', 'other');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "jobRole" "JobRole" NOT NULL DEFAULT 'other',
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'user';
