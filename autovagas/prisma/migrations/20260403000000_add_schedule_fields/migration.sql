-- AlterTable: add schedule fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scheduleDays" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::INTEGER[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scheduleTime" TEXT;
