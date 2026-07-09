import "server-only"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedMessage {
  messageId:   string | null
  inReplyTo:   string | null
  from:        string
  to:          string
  subject:     string
  bodyHtml:    string
  bodyText:    string
  sentAt:      Date
}

export interface SyncResult {
  fetched:  number   // total messages fetched from IMAP folders
  matched:  number   // messages matched to a CRM contact (demoCall)
  synced:   number   // messages newly saved to DB
  skipped:  number   // duplicates already in DB
  errors:   string[]
}

// ─── Main sync entry point ────────────────────────────────────────────────────

export async function syncImapForConfig(imapConfigId: string): Promise<SyncResult> {
  const result: SyncResult = { fetched: 0, matched: 0, synced: 0, skipped: 0, errors: [] }
  console.log(`[imap-sync] Starting sync for config ${imapConfigId}`)

  const config = await prisma.imapConfig.findUnique({ where: { id: imapConfigId } })
  if (!config) {
    console.log("[imap-sync] Config not found — skipping")
    return result
  }
  if (!config.enabled) {
    console.log("[imap-sync] Config disabled — skipping")
    return result
  }
  console.log(`[imap-sync] Config: ${config.emailAddress} @ ${config.host}:${config.port}`)

  let password: string
  try {
    password = decryptField(config.encryptedPassword)
    console.log("[imap-sync] Decrypted IMAP password OK")
  } catch (err) {
    const msg = "Failed to decrypt IMAP password — check IMAP_ENCRYPTION_KEY"
    console.error("[imap-sync]", msg, err)
    result.errors.push(msg)
    return result
  }

  const { ImapFlow } = await import("imapflow") as typeof import("imapflow")

  const client = new ImapFlow({
    host:    config.host,
    port:    config.port,
    secure:  true,
    logger:  false,
    auth: {
      user: config.emailAddress,
      pass: password,
    },
    tls: { rejectUnauthorized: false },
  })

  try {
    console.log(`[imap-sync] Connecting to ${config.host}:${config.port}…`)
    await client.connect()
    console.log("[imap-sync] Connected and authenticated")

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const folders = ["INBOX", "Sent", "Sent Items", "Sent Messages"]

    for (const folder of folders) {
      try {
        console.log(`[imap-sync] Opening folder: ${folder}`)
        const mailbox = await client.mailboxOpen(folder)
        if (!mailbox) { console.log(`[imap-sync] Folder ${folder} not found — skipping`); continue }
        console.log(`[imap-sync] Folder ${folder} has ${mailbox.exists} messages total`)

        const messages = await fetchFolder(client, thirtyDaysAgo)
        result.fetched += messages.length
        console.log(`[imap-sync] Fetched ${messages.length} messages from ${folder}`)

        for (const msg of messages) {
          const sub = await processMessage(msg, config.id, config.emailAddress, result)
          if (sub === "synced")  result.synced++
          if (sub === "skipped") result.skipped++
        }
        console.log(`[imap-sync] Folder ${folder} done — synced: ${result.synced}, skipped: ${result.skipped}`)
      } catch (err) {
        const msg = `Folder ${folder}: ${err instanceof Error ? err.message : String(err)}`
        console.log(`[imap-sync] Skipping folder (${msg})`)
        // Don't push to errors — missing folders are expected
      }
    }

    await prisma.imapConfig.update({
      where: { id: imapConfigId },
      data:  { lastSyncAt: new Date(), lastSyncEmailCount: result.synced },
    })
    console.log(`[imap-sync] Sync complete — synced: ${result.synced}, skipped: ${result.skipped}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[imap-sync] Fatal error:", err)
    result.errors.push(msg)
  } finally {
    try { await client.logout() } catch { /* ignore */ }
  }

  return result
}

// ─── Folder fetch ─────────────────────────────────────────────────────────────

async function fetchFolder(client: import("imapflow").ImapFlow, since: Date): Promise<ParsedMessage[]> {
  const messages: ParsedMessage[] = []

  const uids = await client.search({ since })
  if (!uids || uids.length === 0) {
    console.log("[imap-sync] No messages found in this date range")
    return messages
  }
  console.log(`[imap-sync] Found ${uids.length} UIDs to fetch`)

  // Import mailparser for proper MIME handling
  const { simpleParser } = await import("mailparser") as typeof import("mailparser")

  for await (const msg of client.fetch(uids, { source: true })) {
    try {
      if (!msg.source) continue

      const parsed = await simpleParser(msg.source)

      const from    = addressToString(parsed.from?.value?.[0]) ?? ""
      const to      = addressToString(parsed.to && !Array.isArray(parsed.to) ? parsed.to.value[0] : (parsed.to as import("mailparser").AddressObject[])?.[0]?.value?.[0]) ?? ""
      const subject = parsed.subject ?? "(no subject)"
      const sentAt  = parsed.date ?? new Date()
      const msgId   = normalizeMessageId(parsed.messageId ?? null)
      const inReply = normalizeMessageId(parsed.inReplyTo ?? null)
      const html    = parsed.html || ""
      const text    = parsed.text || ""

      messages.push({
        messageId: msgId,
        inReplyTo: inReply,
        from,
        to,
        subject,
        bodyHtml: html || `<pre style="white-space:pre-wrap">${escapeHtml(text)}</pre>`,
        bodyText: text || stripHtml(html),
        sentAt,
      })
    } catch (err) {
      console.warn("[imap-sync] Failed to parse message:", err instanceof Error ? err.message : err)
    }
  }

  return messages
}

function addressToString(addr: import("mailparser").EmailAddress | undefined): string | undefined {
  if (!addr) return undefined
  if (addr.address) return addr.address
  return undefined
}

function normalizeMessageId(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Strip angle brackets if present
  return raw.replace(/^<|>$/g, "").trim() || null
}

// ─── Process one message ──────────────────────────────────────────────────────

async function processMessage(
  msg:          ParsedMessage,
  imapConfigId: string,
  configEmail:  string,
  result:       SyncResult,
): Promise<"synced" | "skipped"> {
  // Skip if already stored (deduplicate by messageId)
  if (msg.messageId) {
    const existing = await prisma.crmEmail.findFirst({
      where: { messageId: { contains: msg.messageId } },
    })
    if (existing) return "skipped"
  }

  // Determine direction relative to the config email address
  const fromLower    = msg.from.toLowerCase()
  const configLower  = configEmail.toLowerCase()
  const direction    = fromLower === configLower ? "sent" : "received"
  const contactEmail = direction === "sent" ? msg.to : msg.from

  // Try to find a matching demo call by either From or To
  const demoCall = await prisma.demoCall.findFirst({
    where: { contactEmail: { equals: contactEmail, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  })
  if (demoCall) result.matched++

  // Resolve threadId: check In-Reply-To first, then look for prior emails in same thread
  let threadId: string | null = null
  if (msg.inReplyTo) {
    const parent = await prisma.crmEmail.findFirst({
      where: {
        OR: [
          { messageId: msg.inReplyTo },
          { messageId: `<${msg.inReplyTo}>` },
        ],
      },
    })
    threadId = parent?.threadId ?? parent?.id ?? null
  }

  // Also check if there's an existing thread for this contact (fallback)
  if (!threadId && contactEmail) {
    const prior = await prisma.crmEmail.findFirst({
      where:   { contactEmail: { equals: contactEmail, mode: "insensitive" } },
      orderBy: { sentAt: "desc" },
    })
    threadId = prior?.threadId ?? prior?.id ?? null
  }

  console.log(`[imap-sync] Saving ${direction} email: "${msg.subject}" from ${msg.from} → threadId=${threadId ?? "new"}`)

  const created = await prisma.crmEmail.create({
    data: {
      demoCallId:   demoCall?.id ?? null,
      contactEmail,
      direction,
      fromAddress:  msg.from,
      toAddress:    msg.to,
      subject:      msg.subject,
      bodyHtml:     msg.bodyHtml,
      bodyText:     msg.bodyText,
      messageId:    msg.messageId,
      inReplyTo:    msg.inReplyTo,
      threadId,
      sentAt:       msg.sentAt,
      source:       "imap_sync",
      imapConfigId,
    },
  })

  if (!threadId) {
    await prisma.crmEmail.update({ where: { id: created.id }, data: { threadId: created.id } })
  }

  return "synced"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export async function syncAllImapConfigs(): Promise<Record<string, SyncResult>> {
  const configs = await prisma.imapConfig.findMany({ where: { enabled: true } })
  console.log(`[imap-sync] syncAll: ${configs.length} enabled config(s)`)
  const results: Record<string, SyncResult> = {}
  for (const c of configs) {
    results[c.id] = await syncImapForConfig(c.id)
  }
  return results
}
