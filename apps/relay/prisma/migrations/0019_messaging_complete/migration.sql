-- AlterTable: Conversation — add channel reference and archive flag
ALTER TABLE "Conversation" ADD COLUMN "channelRefType" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "channelRefId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Conversation_channelRefId_idx" ON "Conversation"("channelRefId");

-- AlterTable: ConversationMember — add isAdmin flag
ALTER TABLE "ConversationMember" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: ChatMessage — add reply threading
ALTER TABLE "ChatMessage" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: MessageReaction
CREATE TABLE "MessageReaction" (
    "id"        TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "emoji"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: SupportConversation — add internal notes and assignment
ALTER TABLE "SupportConversation" ADD COLUMN "internalNotes"  TEXT;
ALTER TABLE "SupportConversation" ADD COLUMN "assignedToSAId" TEXT;
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_assignedToSAId_fkey"
  FOREIGN KEY ("assignedToSAId") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
