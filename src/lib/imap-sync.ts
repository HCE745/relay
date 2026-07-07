import "server-only"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"
import { htmlToText } from "@/lib/html-to-text"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImapMessage {
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
  synced:  number
  skipped: number
  errors:  string[]
}

// ─── IMAP sync ────────────────────────────────────────────────────────────────

export async function syncImapForConfig(imapConfigId: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, errors: [] }

  const config = await prisma.imapConfig.findUnique({ where: { id: imapConfigId } })
  if (!config || !config.enabled) return result

  let password: string
  try {
    password = decryptField(config.encryptedPassword)
  } catch {
    result.errors.push("Failed to decrypt IMAP password — check IMAP_ENCRYPTION_KEY")
    return result
  }

  // Dynamic import to avoid loading imapflow at cold-start for routes that don't need it
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
    await client.connect()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    for (const folder of ["INBOX", "Sent", "Sent Items", "Sent Messages"]) {
      try {
        const mailbox = await client.mailboxOpen(folder)
        if (!mailbox) continue

        const messages = await fetchFolder(client, thirtyDaysAgo)
        for (const msg of messages) {
          const sub = await processMessage(msg, config.id, config.emailAddress)
          if (sub === "synced")  result.synced++
          if (sub === "skipped") result.skipped++
        }
      } catch {
        // Folder doesn't exist or can't open — skip silently
      }
    }

    await prisma.imapConfig.update({
      where: { id: imapConfigId },
      data:  { lastSyncAt: new Date() },
    })
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err))
  } finally {
    try { await client.logout() } catch { /* ignore */ }
  }

  return result
}

async function fetchFolder(client: import("imapflow").ImapFlow, since: Date): Promise<ImapMessage[]> {
  const messages: ImapMessage[] = []

  // Search for messages since date
  const uids = await client.search({ since })
  if (!uids || uids.length === 0) return messages

  for await (const msg of client.fetch(uids, {
    envelope: true,
    bodyStructure: true,
    source: true,
  })) {
    try {
      const envelope  = msg.envelope
      const source    = msg.source?.toString("utf8") ?? ""

      const from    = envelope?.from?.[0]?.address ?? ""
      const to      = envelope?.to?.[0]?.address ?? ""
      const subject = envelope?.subject ?? "(no subject)"
      const sentAt  = envelope?.date ?? new Date()
      const msgId   = envelope?.messageId ?? null
      const inReply = extractHeader(source, "in-reply-to")

      const { html, text } = extractBody(source)

      messages.push({
        messageId: msgId,
        inReplyTo: inReply,
        from,
        to,
        subject,
        bodyHtml: html,
        bodyText: text || htmlToText(html),
        sentAt,
      })
    } catch {
      // Skip malformed messages
    }
  }

  return messages
}

async function processMessage(
  msg:          ImapMessage,
  imapConfigId: string,
  configEmail:  string,
): Promise<"synced" | "skipped"> {
  // Skip if already stored
  if (msg.messageId) {
    const existing = await prisma.crmEmail.findUnique({ where: { messageId: msg.messageId } })
    if (existing) return "skipped"
  }

  // Determine direction relative to the config's email address
  const direction = msg.from.toLowerCase() === configEmail.toLowerCase() ? "sent" : "received"
  const contactEmail = direction === "sent" ? msg.to : msg.from

  // Find matching demo call
  const demoCall = await prisma.demoCall.findFirst({
    where: { contactEmail: { equals: contactEmail, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  })

  // Determine threadId: if In-Reply-To matches a known email, use that email's threadId
  let threadId: string | null = null
  if (msg.inReplyTo) {
    const parent = await prisma.crmEmail.findUnique({ where: { messageId: msg.inReplyTo } })
    threadId = parent?.threadId ?? parent?.id ?? null
  }

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

  // Set threadId = self if no parent found
  if (!threadId) {
    await prisma.crmEmail.update({ where: { id: created.id }, data: { threadId: created.id } })
  }

  return "synced"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractHeader(source: string, header: string): string | null {
  const lines = source.split(/\r?\n/)
  const prefix = header.toLowerCase() + ":"
  for (const line of lines) {
    if (line.toLowerCase().startsWith(prefix)) {
      return line.slice(prefix.length).trim().replace(/^<|>$/g, "") || null
    }
  }
  return null
}

function extractBody(source: string): { html: string; text: string } {
  // Find the boundary between headers and body
  const bodyMatch = source.match(/\r?\n\r?\n([\s\S]*)/)
  const body      = bodyMatch?.[1] ?? ""

  // Very simple: if body looks like HTML, use it; otherwise treat as text
  if (/<html|<body|<div|<p[^>]*>/i.test(body)) {
    return { html: body, text: "" }
  }

  return { html: `<pre style="white-space:pre-wrap">${escapeHtml(body)}</pre>`, text: body }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export async function syncAllImapConfigs(): Promise<Record<string, SyncResult>> {
  const configs = await prisma.imapConfig.findMany({ where: { enabled: true } })
  const results: Record<string, SyncResult> = {}
  for (const c of configs) {
    results[c.id] = await syncImapForConfig(c.id)
  }
  return results
}
