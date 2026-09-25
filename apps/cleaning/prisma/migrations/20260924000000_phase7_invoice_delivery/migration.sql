-- AlterEnum
ALTER TYPE "cleaning"."InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterTable
ALTER TABLE "cleaning"."Invoice" ADD COLUMN     "emailedAt" TIMESTAMP(3);

