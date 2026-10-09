-- CreateTable: SalesAlert — in-app notifications for admin_sales users
CREATE TABLE "SalesAlert" (
    "id"          TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "message"     TEXT NOT NULL,
    "isRead"      BOOLEAN NOT NULL DEFAULT false,
    "relatedId"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesAlert_recipientId_idx" ON "SalesAlert"("recipientId");
CREATE INDEX "SalesAlert_isRead_idx" ON "SalesAlert"("isRead");

ALTER TABLE "SalesAlert"
    ADD CONSTRAINT "SalesAlert_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "SalesUser"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
