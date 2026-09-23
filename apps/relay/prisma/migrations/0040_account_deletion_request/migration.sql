-- CreateTable
CREATE TABLE "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_email_idx" ON "AccountDeletionRequest"("email");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_requestedAt_idx" ON "AccountDeletionRequest"("requestedAt");
