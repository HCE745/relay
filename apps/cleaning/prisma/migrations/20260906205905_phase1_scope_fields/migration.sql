-- AlterTable
ALTER TABLE "cleaning"."ChecklistTemplateItem" ADD COLUMN     "isRequired" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "cleaning"."JobChecklistItem" ADD COLUMN     "isRequired" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "cleaning"."ServiceLocation" ADD COLUMN     "siteContactEmail" TEXT,
ADD COLUMN     "siteContactName" TEXT,
ADD COLUMN     "siteContactPhone" TEXT;
