import "server-only"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedMessage {
  messageId:   string | null
  inReplyTo:   string | null
  from:        string  // email address only
  fromName:    string  // display name from From header
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
  const t0 = Date.now()
  console.error(`[imap-sync] ═══ START syncImapForConfig(${imapConfigId}) ═══`)

  // ── Load config ───────────────────────────────────────────────────────────
  const config = await prisma.imapConfig.findUnique({ where: { id: imapConfigId } })
  if (!config) {
    console.error("[imap-sync] ABORT: config not found in DB")
    return result
  }
  console.error(`[imap-sync] Config loaded:`)
  console.error(`[imap-sync]   email:       ${config.emailAddress}`)
  console.error(`[imap-sync]   host:        ${config.host}`)
  console.error(`[imap-sync]   port:        ${config.port}`)
  console.error(`[imap-sync]   enabled:     ${config.enabled}`)
  console.error(`[imap-sync]   lastSyncAt:  ${config.lastSyncAt?.toISOString() ?? "null (first run)"}`)
  console.error(`[imap-sync]   encPwdLen:   ${config.encryptedPassword?.length ?? 0} chars`)

  if (!config.enabled) {
    console.error("[imap-sync] ABORT: sync disabled in config")
    return result
  }

  // ── Decrypt password ──────────────────────────────────────────────────────
  let password: string
  try {
    password = decryptField(config.encryptedPassword)
    console.error(`[imap-sync] Password decrypted OK (length: ${password.length})`)
  } catch (err) {
    const msg = `Failed to decrypt IMAP password: ${err instanceof Error ? err.message : String(err)}`
    console.error("[imap-sync] ABORT:", msg)
    result.errors.push(msg)
    return result
  }

  // ── Compute date range ────────────────────────────────────────────────────
  // First run (lastSyncAt=null): go back 90 days to capture all recent history.
  // Subsequent runs: overlap 1 day so we don't miss messages at the boundary.
  // IMPORTANT: if lastSyncAt was set by a previous zero-result sync, it may be
  // too recent and will miss older emails. Warn when this is the case.
  const INITIAL_DAYS = 90
  const sinceDate = config.lastSyncAt
    ? new Date(config.lastSyncAt.getTime() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() - INITIAL_DAYS * 24 * 60 * 60 * 1000)

  const sinceDaysAgo = Math.round((Date.now() - sinceDate.getTime()) / (24 * 60 * 60 * 1000))
  console.error(`[imap-sync] Since date: ${sinceDate.toISOString()} (~${sinceDaysAgo} days ago)`)
  if (config.lastSyncAt && sinceDaysAgo < 2) {
    console.error(`[imap-sync] WARNING: lastSyncAt is very recent (${sinceDaysAgo} days ago). If a previous sync returned 0, this will also return 0. Reset lastSyncAt to null to force a full re-scan.`)
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  const { ImapFlow } = await import("imapflow") as typeof import("imapflow")
  console.error(`[imap-sync] Connecting to ${config.host}:${config.port} (secure=true)…`)

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
    console.error("[imap-sync] Connected and authenticated OK")

    const folders = ["INBOX", "Sent", "Sent Items", "Sent Messages"]

    for (const folder of folders) {
      console.error(`[imap-sync] ── folder: ${folder} ──`)
      try {
        const mailbox = await client.mailboxOpen(folder)
        if (!mailbox) {
          console.error(`[imap-sync] mailboxOpen returned null — skipping`)
          continue
        }
        console.error(`[imap-sync] Opened ${folder}: ${mailbox.exists} messages total in mailbox`)

        const messages = await fetchFolder(client, sinceDate)
        result.fetched += messages.length
        console.error(`[imap-sync] fetchFolder returned ${messages.length} parsed messages`)

        for (const msg of messages) {
          const sub = await processMessage(msg, config.id, config.emailAddress, result)
          if (sub === "synced")  result.synced++
          if (sub === "skipped") result.skipped++
        }
        console.error(`[imap-sync] Folder ${folder} done — synced=${result.synced} skipped=${result.skipped}`)
      } catch (err) {
        const detail = err instanceof Error
          ? `${err.message} | response=${(err as unknown as Record<string,unknown>)["responseText"] ?? (err as unknown as Record<string,unknown>)["response"] ?? "n/a"}`
          : String(err)
        console.error(`[imap-sync] Folder ${folder} error (will skip): ${detail}`)
        // Expected for folders that don't exist — don't push to result.errors
      }
    }

    // Only update lastSyncAt when we actually connected successfully.
    // Use lastSyncEmailCount = total synced so far (cumulative).
    await prisma.imapConfig.update({
      where: { id: imapConfigId },
      data:  { lastSyncAt: new Date(), lastSyncEmailCount: result.synced },
    })
    console.error(`[imap-sync] ═══ DONE in ${Date.now() - t0}ms — fetched=${result.fetched} synced=${result.synced} skipped=${result.skipped} errors=${result.errors.length} ═══`)
  } catch (err) {
    const detail = err instanceof Error
      ? `${err.message} | code=${(err as unknown as Record<string,unknown>)["code"] ?? "n/a"} | response=${(err as unknown as Record<string,unknown>)["responseText"] ?? (err as unknown as Record<string,unknown>)["response"] ?? "n/a"}`
      : String(err)
    console.error(`[imap-sync] FATAL: ${detail}`)
    result.errors.push(detail)
  } finally {
    try { await client.logout() } catch { /* ignore */ }
  }

  return result
}

// ─── Folder fetch ─────────────────────────────────────────────────────────────

async function fetchFolder(client: import("imapflow").ImapFlow, since: Date): Promise<ParsedMessage[]> {
  const messages: ParsedMessage[] = []

  console.error(`[imap-sync] IMAP SEARCH SINCE ${since.toISOString()}`)
  let rawUids: number[] | false
  try {
    rawUids = await client.search({ since })
  } catch (err) {
    console.error(`[imap-sync] client.search() threw: ${err instanceof Error ? err.message : String(err)}`)
    return messages
  }
  const uids = Array.isArray(rawUids) ? rawUids : []
  console.error(`[imap-sync] client.search() returned: ${Array.isArray(rawUids) ? `${rawUids.length} UIDs` : "false (server returned no match or empty mailbox)"}`)
  if (uids.length === 0) {
    console.error("[imap-sync] 0 UIDs — nothing to fetch for this folder/date range")
    return messages
  }
  console.error(`[imap-sync] Fetching full source for UIDs: ${uids.slice(0, 10).join(",")}${uids.length > 10 ? `… (+${uids.length - 10} more)` : ""}`)

  const { simpleParser } = await import("mailparser") as typeof import("mailparser")
  let fetchCount = 0

  for await (const msg of client.fetch(uids, { source: true })) {
    fetchCount++
    try {
      if (!msg.source) {
        console.error(`[imap-sync] UID ${msg.uid}: source is empty — skipping`)
        continue
      }

      const parsed = await simpleParser(msg.source)

      const fromAddr = parsed.from?.value?.[0]
      const toAddr   = parsed.to && !Array.isArray(parsed.to)
        ? parsed.to.value[0]
        : (parsed.to as import("mailparser").AddressObject[])?.[0]?.value?.[0]

      const from     = fromAddr?.address ?? ""
      const fromName = (fromAddr?.name?.trim() && fromAddr.name.trim() !== fromAddr.address)
        ? fromAddr.name.trim()
        : from.split("@")[0]
      const to      = toAddr?.address ?? ""
      const subject = parsed.subject ?? "(no subject)"
      const sentAt  = parsed.date ?? new Date()
      const msgId   = normalizeMessageId(parsed.messageId ?? null)
      const inReply = normalizeMessageId(parsed.inReplyTo ?? null)
      const html    = parsed.html || ""
      const text    = parsed.text || ""

      console.error(`[imap-sync] UID ${msg.uid}: from=${from} to=${to} subject="${subject}" msgId=${msgId ?? "none"}`)

      messages.push({
        messageId: msgId,
        inReplyTo: inReply,
        from,
        fromName,
        to,
        subject,
        bodyHtml: html || `<pre style="white-space:pre-wrap">${escapeHtml(text)}</pre>`,
        bodyText: text || stripHtml(html),
        sentAt,
      })
    } catch (err) {
      console.error(`[imap-sync] UID ${msg.uid}: parse error — ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  console.error(`[imap-sync] fetch loop done: ${fetchCount} streamed, ${messages.length} successfully parsed`)

  return messages
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

  // Try to find a matching demo call, or auto-create one for inbound emails
  let demoCall = await prisma.demoCall.findFirst({
    where: { contactEmail: { equals: contactEmail, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  })

  if (!demoCall && direction === "received" && contactEmail) {
    // Auto-create a Lead from an unknown inbound sender
    const domain = msg.from.split("@")[1] ?? "Unknown"
    demoCall = await prisma.demoCall.create({
      data: {
        contactName:     msg.fromName,
        contactEmail:    msg.from.toLowerCase(),
        companyName:     domain,
        leadSource:      "Email Inbound",
        callStatus:      "Lead",
        createdBySAName: "IMAP Sync",
      },
    })
    console.log(`[imap-sync] Auto-created Lead: ${msg.fromName} <${msg.from}>`)
  }

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
