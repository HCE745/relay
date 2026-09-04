-- Migration 0018: In-App Messaging System
-- Adds Conversation, ConversationMember, ChatMessage, SupportConversation,
-- SupportMessage, Broadcast tables; adds messageEmailsEnabled to UserSettings

-- ─── Conversation ─────────────────────────────────────────────────────────────

CREATE TABLE "Conversation" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "name"        TEXT,
  "issueId"     TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_issueId_key" UNIQUE ("issueId");

CREATE INDEX "Conversation_orgId_idx"   ON "Conversation"("orgId");
CREATE INDEX "Conversation_type_idx"    ON "Conversation"("type");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_issueId_fkey"
  FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── ConversationMember ───────────────────────────────────────────────────────

CREATE TABLE "ConversationMember" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "joinedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt"     TIMESTAMP(3),
  "isTypingUntil"  TIMESTAMP(3),
  CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_userId_key"
  UNIQUE ("conversationId", "userId");

CREATE INDEX "ConversationMember_conversationId_idx" ON "ConversationMember"("conversationId");
CREATE INDEX "ConversationMember_userId_idx"         ON "ConversationMember"("userId");

ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ChatMessage ──────────────────────────────────────────────────────────────

CREATE TABLE "ChatMessage" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId"       TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "attachmentUrl"  TEXT,
  "attachmentName" TEXT,
  "attachmentType" TEXT,
  "isDeleted"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");
CREATE INDEX "ChatMessage_senderId_idx"       ON "ChatMessage"("senderId");
CREATE INDEX "ChatMessage_createdAt_idx"      ON "ChatMessage"("createdAt");

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── SupportConversation ──────────────────────────────────────────────────────

CREATE TABLE "SupportConversation" (
  "id"               TEXT NOT NULL,
  "orgId"            TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'open',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAdminReplyAt" TIMESTAMP(3),
  CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportConversation_orgId_idx"         ON "SupportConversation"("orgId");
CREATE INDEX "SupportConversation_status_idx"        ON "SupportConversation"("status");
CREATE INDEX "SupportConversation_lastMessageAt_idx" ON "SupportConversation"("lastMessageAt");

ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── SupportMessage ───────────────────────────────────────────────────────────

CREATE TABLE "SupportMessage" (
  "id"                    TEXT NOT NULL,
  "supportConversationId" TEXT NOT NULL,
  "body"                  TEXT NOT NULL,
  "senderType"            TEXT NOT NULL,
  "senderUserId"          TEXT,
  "senderSAId"            TEXT,
  "isRead"                BOOLEAN NOT NULL DEFAULT false,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportMessage_supportConversationId_idx" ON "SupportMessage"("supportConversationId");
CREATE INDEX "SupportMessage_createdAt_idx"             ON "SupportMessage"("createdAt");

ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_supportConversationId_fkey"
  FOREIGN KEY ("supportConversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderSAId_fkey"
  FOREIGN KEY ("senderSAId") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Broadcast ────────────────────────────────────────────────────────────────

CREATE TABLE "Broadcast" (
  "id"             TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "sentBySAId"     TEXT NOT NULL,
  "targetType"     TEXT NOT NULL,
  "targetPlan"     TEXT,
  "targetOrgId"    TEXT,
  "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Broadcast_sentBySAId_idx" ON "Broadcast"("sentBySAId");
CREATE INDEX "Broadcast_sentAt_idx"     ON "Broadcast"("sentAt");

ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_sentBySAId_fkey"
  FOREIGN KEY ("sentBySAId") REFERENCES "SuperAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_targetOrgId_fkey"
  FOREIGN KEY ("targetOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── UserSettings: add messageEmailsEnabled ───────────────────────────────────

ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "messageEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;
