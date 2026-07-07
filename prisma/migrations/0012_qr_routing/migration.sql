-- AlterTable
ALTER TABLE "QrCode" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "routingMode" TEXT NOT NULL DEFAULT 'AUTO';

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

