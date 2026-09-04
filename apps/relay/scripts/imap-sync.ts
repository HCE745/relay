#!/usr/bin/env tsx
/**
 * Local IMAP sync — run from your machine, not on Vercel.
 *
 *   npm run imap-sync          # incremental (since lastSyncAt)
 *   npm run imap-sync -- --full  # force 90-day re-scan regardless of lastSyncAt
 *
 * Reads credentials from .env.local in the project root.
 * Writes results to the production database.
 */

import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

import { createDecipheriv } from "crypto"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { ImapFlow } from "imapflow"
import { simpleParser, type AddressObject } from "mailparser"

// ── Crypto (inlined — avoids "server-only" import in crypto-utils.ts) ───────

function decryptField(data: string): string {
  const raw = process.env.IMAP_ENCRYPTION_KEY ?? ""
  const key = Buffer.alloc(32)
  Buffer.from(raw, "utf8").copy(key)

  const [ivHex, tagHex, encHex] = data.split(":")
  if (!ivHex || !tagHex || !encHex) throw new Error("Invalid encrypted data format")

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString("utf8")
}

// ── Prisma ────────────────────────────────────────────────────────────────────

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is not set in .env.local")
  const adapter = new PrismaPg({ connectionString, max: 2 })
  return new PrismaClient({ adapter })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const full = process.argv.includes("--full")
  const log  = (msg: string) => console.log(`[imap-sync] ${msg}`)

  if (!process.env.IMAP_ENCRYPTION_KEY) {
    console.error("[imap-sync] ERROR: IMAP_ENCRYPTION_KEY is not set — add it to .env.local")
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error("[imap-sync] ERROR: DATABASE_URL is not set — add it to .env.local")
    process.exit(1)
  }

  log(`Starting${full ? " (full 90-day re-scan)" : " (incremental)"}`)

  const prisma = createPrisma()

  try {
    const configs = await prisma.imapConfig.findMany({ where: { enabled: true } })
    log(`Found ${configs.length} enabled IMAP config(s)`)

    if (configs.length === 0) {
      log("Nothing to do — configure IMAP in CRM Settings first")
      return
    }

    for (const config of configs) {
      log(`\n── ${config.emailAddress} @ ${config.host}:${config.port}`)
      log(`   lastSyncAt: ${config.lastSyncAt?.toISOString() ?? "null (first run — using 90-day window)"}`)

      // Decrypt password
      let password: string
      try {
        password = decryptField(config.encryptedPassword)
        log(`   Password decrypted OK (length=${password.length})`)
      } catch (err) {
        log(`   ERROR — could not decrypt password: ${err instanceof Error ? err.message : String(err)}`)
        log(`   Hint: make sure IMAP_ENCRYPTION_KEY in .env.local matches the one on Vercel`)
        continue
      }

      // Date range
      const nowMs = Date.now()
      const since = full || !config.lastSyncAt
        ? new Date(nowMs - 90 * 86_400_000)
        : new Date(config.lastSyncAt.getTime() - 86_400_000)
      const sinceDays = Math.round((nowMs - since.getTime()) / 86_400_000)
      log(`   Since: ${since.toISOString()} (~${sinceDays} days ago)`)

      // Connect
      const client = new ImapFlow({
        host:              config.host,
        port:              config.port,
        secure:            true,
        logger:            false,
        auth:              { user: config.emailAddress, pass: password },
        tls:               { rejectUnauthorized: false },
        connectionTimeout: 15_000,
        greetingTimeout:   10_000,
        socketTimeout:     30_000,
      })

      let fetched = 0, matched = 0, saved = 0, skipped = 0
      const errors: string[] = []

      try {
        log(`   Connecting to ${config.host}:${config.port}…`)
        await client.connect()
        log(`   Connected and authenticated`)

        // ── Process one folder ─────────────────────────────────────────────
        async function processFolder(folder: string) {
          log(`\n   ▸ ${folder}`)
          const mb = await client.mailboxOpen(folder)
          log(`     ${mb.exists} messages in mailbox`)

          const raw  = await client.search({ since })
          const uids = Array.isArray(raw) ? raw : []
          log(`     SEARCH SINCE ${since.toISOString()} → ${uids.length} UIDs${uids.length ? ` [${uids.slice(0, 10).join(",")}${uids.length > 10 ? "…" : ""}]` : ""}`)

          if (uids.length === 0) {
            if (mb.exists > 0) {
              log(`     WARNING: mailbox has ${mb.exists} messages but SEARCH returned 0`)
              log(`     The since date may be too recent — try: npm run imap-sync -- --full`)
            }
            return
          }

          for await (const msg of client.fetch(uids, { source: true })) {
            fetched++
            try {
              if (!msg.source) continue

              const p        = await simpleParser(msg.source)
              const fromAddr = p.from?.value?.[0]
              const toAddr   = p.to && !Array.isArray(p.to)
                ? p.to.value[0]
                : (p.to as AddressObject[])?.[0]?.value?.[0]

              const from     = fromAddr?.address ?? ""
              const fromName = (fromAddr?.name?.trim() && fromAddr.name.trim() !== from)
                ? fromAddr.name.trim()
                : from.split("@")[0]
              const to       = toAddr?.address ?? ""
              const subject  = p.subject ?? "(no subject)"
              const msgId    = (p.messageId ?? "").replace(/^<|>$/g, "").trim() || null
              const inReplyTo = (p.inReplyTo ?? "").replace(/^<|>$/g, "").trim() || null

              // Dedup by messageId
              if (msgId) {
                const exists = await prisma.crmEmail.findFirst({ where: { messageId: { contains: msgId } } })
                if (exists) {
                  log(`     uid=${msg.uid}: SKIP (already in DB)`)
                  skipped++
                  continue
                }
              }

              const isSent       = from.toLowerCase() === config.emailAddress.toLowerCase()
              const direction    = isSent ? "sent" : "received"
              const contactEmail = isSent ? to : from

              // Match or auto-create DemoCall for inbound from unknown senders
              let demoCall = await prisma.demoCall.findFirst({
                where:   { contactEmail: { equals: contactEmail, mode: "insensitive" } },
                orderBy: { createdAt: "desc" },
              })

              if (!demoCall && direction === "received" && contactEmail) {
                const domain = from.split("@")[1] ?? "Unknown"
                demoCall = await prisma.demoCall.create({
                  data: {
                    contactName:     fromName,
                    contactEmail:    from.toLowerCase(),
                    companyName:     domain,
                    leadSource:      "Email Inbound",
                    callStatus:      "Lead",
                    createdBySAName: "IMAP Sync",
                  },
                })
                log(`     uid=${msg.uid}: auto-created DemoCall for ${fromName} <${from}>`)
              }

              if (demoCall) matched++

              // Thread resolution
              let threadId: string | null = null
              if (inReplyTo) {
                const parent = await prisma.crmEmail.findFirst({
                  where: { OR: [{ messageId: inReplyTo }, { messageId: `<${inReplyTo}>` }] },
                })
                threadId = parent?.threadId ?? parent?.id ?? null
              }
              if (!threadId && contactEmail) {
                const prior = await prisma.crmEmail.findFirst({
                  where:   { contactEmail: { equals: contactEmail, mode: "insensitive" } },
                  orderBy: { sentAt: "desc" },
                })
                threadId = prior?.threadId ?? prior?.id ?? null
              }

              const html = p.html || ""
              const text = p.text || ""

              const created = await prisma.crmEmail.create({
                data: {
                  demoCallId:   demoCall?.id ?? null,
                  contactEmail,
                  direction,
                  fromAddress:  from,
                  toAddress:    to,
                  subject,
                  bodyHtml:     html || `<pre style="white-space:pre-wrap">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`,
                  bodyText:     text,
                  messageId:    msgId,
                  inReplyTo,
                  threadId,
                  sentAt:       p.date ?? new Date(),
                  source:       "imap_sync",
                  imapConfigId: config.id,
                },
              })

              if (!threadId) {
                await prisma.crmEmail.update({ where: { id: created.id }, data: { threadId: created.id } })
              }

              log(`     uid=${msg.uid}: SAVED ${direction} "${subject}" (id=${created.id})`)
              saved++
            } catch (err) {
              const detail = err instanceof Error ? err.message : String(err)
              log(`     uid=${msg.uid}: ERROR — ${detail}`)
              errors.push(`uid ${msg.uid}: ${detail}`)
            }
          }
        }

        await processFolder("INBOX")

        for (const folder of ["Sent", "Sent Items", "Sent Messages"]) {
          try {
            await processFolder(folder)
          } catch {
            // Folder doesn't exist on this server — expected
          }
        }

        try { await client.logout() } catch { /* ignore */ }

        // Update lastSyncAt only after a successful connection
        await prisma.imapConfig.update({
          where: { id: config.id },
          data:  { lastSyncAt: new Date(), lastSyncEmailCount: saved },
        })

        log(`\n   ✓ fetched=${fetched}  matched=${matched}  saved=${saved}  skipped=${skipped}  errors=${errors.length}`)
        if (errors.length) {
          for (const e of errors) log(`   ✗ ${e}`)
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        log(`   FATAL: ${detail}`)
        try { client.close() } catch { /* ignore */ }
      }
    }
  } finally {
    await prisma.$disconnect()
  }

  log("\nDone.")
}

main().catch(err => {
  console.error("[imap-sync] Unhandled error:", err)
  process.exit(1)
})
