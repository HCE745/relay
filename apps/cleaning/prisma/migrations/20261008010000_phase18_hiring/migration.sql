-- CreateEnum
CREATE TYPE "cleaning"."JobPostingStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
CREATE TYPE "cleaning"."ApplicantStatus" AS ENUM ('NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED');

-- AlterTable
ALTER TABLE "cleaning"."EmployeeProfile" ADD COLUMN     "availability" TEXT;

-- CreateTable
CREATE TABLE "cleaning"."JobPosting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payRange" TEXT,
    "employmentType" TEXT,
    "locations" TEXT,
    "status" "cleaning"."JobPostingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."Applicant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobPostingId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "appliedFor" TEXT,
    "status" "cleaning"."ApplicantStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "resumeRef" TEXT,
    "availability" TEXT,
    "convertedUserId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning"."Interview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "interviewerId" TEXT,
    "outcomeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPosting_organizationId_idx" ON "cleaning"."JobPosting"("organizationId");
CREATE INDEX "Applicant_organizationId_idx" ON "cleaning"."Applicant"("organizationId");
CREATE INDEX "Applicant_status_idx" ON "cleaning"."Applicant"("status");
CREATE INDEX "Interview_organizationId_idx" ON "cleaning"."Interview"("organizationId");
CREATE INDEX "Interview_applicantId_idx" ON "cleaning"."Interview"("applicantId");

-- AddForeignKey
ALTER TABLE "cleaning"."JobPosting" ADD CONSTRAINT "JobPosting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."Applicant" ADD CONSTRAINT "Applicant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."Applicant" ADD CONSTRAINT "Applicant_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "cleaning"."JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cleaning"."Interview" ADD CONSTRAINT "Interview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."Interview" ADD CONSTRAINT "Interview_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "cleaning"."Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
