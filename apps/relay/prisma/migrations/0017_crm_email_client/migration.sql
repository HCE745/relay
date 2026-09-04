-- Migration 0017: CRM Email Client
-- Adds CrmEmail, CrmEmailTemplate, ImapConfig tables
-- Adds contactEmail index to DemoCall

-- ─── ImapConfig ───────────────────────────────────────────────────────────────

CREATE TABLE "ImapConfig" (
  "id"                TEXT NOT NULL,
  "superAdminId"      TEXT NOT NULL,
  "host"              TEXT NOT NULL DEFAULT 'imap.titan.email',
  "port"              INTEGER NOT NULL DEFAULT 993,
  "emailAddress"      TEXT NOT NULL,
  "encryptedPassword" TEXT NOT NULL,
  "lastSyncAt"        TIMESTAMP(3),
  "enabled"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImapConfig_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImapConfig" ADD CONSTRAINT "ImapConfig_superAdminId_key" UNIQUE ("superAdminId");

ALTER TABLE "ImapConfig" ADD CONSTRAINT "ImapConfig_superAdminId_fkey"
  FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CrmEmailTemplate ─────────────────────────────────────────────────────────

CREATE TABLE "CrmEmailTemplate" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "subject"       TEXT NOT NULL,
  "body"          TEXT NOT NULL,
  "isSystem"      BOOLEAN NOT NULL DEFAULT false,
  "createdBySAId" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmEmailTemplate_createdBySAId_idx" ON "CrmEmailTemplate"("createdBySAId");

ALTER TABLE "CrmEmailTemplate" ADD CONSTRAINT "CrmEmailTemplate_createdBySAId_fkey"
  FOREIGN KEY ("createdBySAId") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── CrmEmail ─────────────────────────────────────────────────────────────────

CREATE TABLE "CrmEmail" (
  "id"             TEXT NOT NULL,
  "demoCallId"     TEXT,
  "contactEmail"   TEXT NOT NULL,
  "direction"      TEXT NOT NULL,
  "fromAddress"    TEXT NOT NULL,
  "toAddress"      TEXT NOT NULL,
  "cc"             TEXT,
  "subject"        TEXT NOT NULL,
  "bodyHtml"       TEXT NOT NULL DEFAULT '',
  "bodyText"       TEXT NOT NULL DEFAULT '',
  "messageId"      TEXT,
  "inReplyTo"      TEXT,
  "threadId"       TEXT,
  "sentAt"         TIMESTAMP(3) NOT NULL,
  "source"         TEXT NOT NULL DEFAULT 'compose',
  "followUpDate"   TIMESTAMP(3),
  "followUpDoneAt" TIMESTAMP(3),
  "imapConfigId"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmEmail_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmEmail" ADD CONSTRAINT "CrmEmail_messageId_key" UNIQUE ("messageId");

CREATE INDEX "CrmEmail_demoCallId_idx"   ON "CrmEmail"("demoCallId");
CREATE INDEX "CrmEmail_contactEmail_idx" ON "CrmEmail"("contactEmail");
CREATE INDEX "CrmEmail_threadId_idx"     ON "CrmEmail"("threadId");
CREATE INDEX "CrmEmail_sentAt_idx"       ON "CrmEmail"("sentAt");

ALTER TABLE "CrmEmail" ADD CONSTRAINT "CrmEmail_demoCallId_fkey"
  FOREIGN KEY ("demoCallId") REFERENCES "DemoCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmEmail" ADD CONSTRAINT "CrmEmail_imapConfigId_fkey"
  FOREIGN KEY ("imapConfigId") REFERENCES "ImapConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── DemoCall: add contactEmail index ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "DemoCall_contactEmail_idx" ON "DemoCall"("contactEmail");

-- ─── Seed default email templates ─────────────────────────────────────────────

INSERT INTO "CrmEmailTemplate" ("id", "name", "subject", "body", "isSystem", "createdAt", "updatedAt") VALUES
(
  gen_random_uuid()::text,
  'Initial Outreach',
  'Following up on Relay for {{company_name}}',
  'Hi {{contact_name}},

I wanted to reach out because I think Relay could be a great fit for {{company_name}}. We help operations teams streamline work orders, track assets, and manage teams across multiple locations.

Would you be open to a quick 20-minute demo this week? I''d love to show you how other companies in your industry are already using Relay.

Best,
Will
Relay — getrelay.software',
  true, NOW(), NOW()
),
(
  gen_random_uuid()::text,
  'Demo Follow-Up',
  'Great connecting today, {{contact_name}}!',
  'Hi {{contact_name}},

It was great chatting with you on {{demo_date}}! Thank you for taking the time to see Relay in action.

To recap what we covered:
- [Key pain points discussed]
- [Features that resonated most]
- [Next steps we agreed on]

I''ll get your trial access set up right away. Please feel free to reply with any questions, or forward this to anyone else at {{company_name}} who should be involved.

Looking forward to helping your team get started!

Best,
Will
Relay — getrelay.software',
  true, NOW(), NOW()
),
(
  gen_random_uuid()::text,
  'Trial Check-In',
  'How''s Relay going for {{company_name}}?',
  'Hi {{contact_name}},

I wanted to check in and see how your trial is going. Have you had a chance to explore the platform with your team?

Here are a few things worth trying if you haven''t yet:
- Create your first work order template
- Invite a team member to try the mobile app
- Set up your first location

If you have any questions or want a guided walkthrough of any feature, just reply to this email — I''m happy to jump on a quick call.

Best,
Will
Relay — getrelay.software',
  true, NOW(), NOW()
),
(
  gen_random_uuid()::text,
  'Pricing Question Response',
  'Relay pricing for {{company_name}}',
  'Hi {{contact_name}},

Great question! Relay is priced based on your team size and the number of locations you manage. Here''s a quick overview:

- **Essentials** — Great for smaller teams getting started
- **Professional** — Full feature set for growing operations
- **Enterprise** — Custom pricing for large or multi-site organizations

For {{company_name}}, I''d recommend starting with [plan], which works out to approximately $[X]/month. This includes [key features].

Want to hop on a quick call so I can walk you through the options and find the best fit? Just reply and we''ll find a time.

Best,
Will
Relay — getrelay.software',
  true, NOW(), NOW()
),
(
  gen_random_uuid()::text,
  'Referral Thank You',
  'Thank you for the referral, {{contact_name}}!',
  'Hi {{contact_name}},

I just wanted to say a huge thank you for referring {{company_name}} to Relay! Referrals like this mean the world to us and are truly the highest compliment we can receive.

We''re taking great care of them and will keep you posted on how things go. As a thank you, your referral credit will be applied once they complete their first 6 months with us.

Please don''t hesitate to reach out if you ever need anything at all.

With gratitude,
Will
Relay — getrelay.software',
  true, NOW(), NOW()
);
