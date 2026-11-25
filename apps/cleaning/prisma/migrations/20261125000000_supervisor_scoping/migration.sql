-- AlterTable
ALTER TABLE "cleaning"."EmployeeProfile" ADD COLUMN     "supervisorId" TEXT;

-- AlterTable
ALTER TABLE "cleaning"."ServiceLocation" ADD COLUMN     "supervisorId" TEXT;

-- AddForeignKey
ALTER TABLE "cleaning"."EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning"."ServiceLocation" ADD CONSTRAINT "ServiceLocation_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "cleaning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

