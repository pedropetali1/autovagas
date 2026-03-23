-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PLUS', 'PRO');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPLYING', 'SENT', 'FAILED', 'VIEWED');

-- CreateEnum
CREATE TYPE "ApplyType" AS ENUM ('EASY_APPLY', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('SCRAPE', 'MATCH', 'FILL_FORM', 'SUBMIT', 'SCREENSHOT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "zipCode" TEXT,
    "linkedinUrl" TEXT,
    "desiredRole" TEXT,
    "cvUrl" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "dailyQuota" INTEGER NOT NULL DEFAULT 1,
    "emailDigest" BOOLEAN NOT NULL DEFAULT true,
    "emailOnViewed" BOOLEAN NOT NULL DEFAULT true,
    "emailOnFailed" BOOLEAN NOT NULL DEFAULT true,
    "automationPaused" BOOLEAN NOT NULL DEFAULT false,
    "excludeCompanies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "minSalary" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "salary" DOUBLE PRECISION,
    "description" TEXT,
    "linkedinUrl" TEXT NOT NULL,
    "requirements" TEXT[] NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "applyType" "ApplyType" NOT NULL DEFAULT 'EASY_APPLY',

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_userId_key" ON "Skill"("name", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_linkedinUrl_key" ON "Job"("linkedinUrl");

-- CreateIndex
CREATE INDEX "Skill_userId_idx" ON "Skill"("userId");

-- CreateIndex
CREATE INDEX "Job_linkedinUrl_idx" ON "Job"("linkedinUrl");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE Cascade ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
