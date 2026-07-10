import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST() {
  // ── This is the very first line — confirms the handler is reached ──────────
  process.stdout.write("[run-imap-sync] HANDLER CALLED\n")
  console.error("[run-imap-sync] HANDLER CALLED")

  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getSession()
  if (!session?.superAdmin) {
    console.error("[run-imap-sync] UNAUTHORIZED — no superAdmin session")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  console.error(`[run-imap-sync] SA session OK — superAdminId=${session.superAdminId}`)

  // ── Load config ───────────────────────────────────────────────────────────
  console.error("[run-imap-sync] Querying ImapConfig…")
  const config = await prisma.imapConfig.findFirst({
    where: { superAdminId: session.superAdminId! },
  })

  if (!config) {
    console.error("[run-imap-sync] No ImapConfig row found in DB")
    return NextResponse.json({ error: "No IMAP config found. Configure it in CRM Settings." }, { status: 404 })
  }
  console.error(`[run-imap-sync] Config: email=${config.emailAddress} host=${config.host}:${config.port} enabled=${config.enabled} lastSyncAt=${config.lastSyncAt?.toISOString() ?? "null"}`)

  if (!config.enabled) {
    console.error("[run-imap-sync] Config disabled — aborting")
    return NextResponse.json({ error: "IMAP sync is disabled." }, { status: 400 })
  }

  // ── Decrypt password ──────────────────────────────────────────────────────
  let password: string
  try {
    password = decryptField(config.encryptedPassword)
    console.error(`[run-imap-sync] Password decrypted OK — length=${password.length} first=${password[0] ?? "?"} last=${password[password.length - 1] ?? "?"}`)
  } catch (err) {
    const msg = `Decrypt failed: ${err instanceof Error ? err.message : String(err)}`
    console.error(`[run-imap-sync] ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // ── Import imapflow ───────────────────────────────────────────────────────
  console.error("[run-imap-sync] Importing imapflow…")
  let ImapFlow: typeof import("imapflow").ImapFlow
  try {
    ;({ ImapFlow } = await import("imapflow") as typeof import("imapflow"))
    console.error("[run-imap-sync] imapflow imported OK")
  } catch (err) {
    const msg = `imapflow import failed: ${err instanceof Error ? err.message : String(err)}`
    console.error(`[run-imap-sync] ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // ── Date range ────────────────────────────────────────────────────────────
  const since = config.lastSyncAt
    ? new Date(config.lastSyncAt.getTime() - 86_400_000)   // 1-day overlap on subsequent runs
    : new Date(Date.now() - 90 * 86_400_000)               // 90-day window on first run
  const sinceDays = Math.round((Date.now() - since.getTime()) / 86_400_000)
  console.error(`[run-imap-sync] Since: ${since.toISOString()} (~${sinceDays} days ago)`)
  if (sinceDays < 2) {
    console.error("[run-imap-sync] WARNING: since date is very recent — a previous zero-result sync may have set lastSyncAt. Use Reset & Re-sync to clear it.")
  }

  // Non-null assertion after guard above — captured so the closure below sees it
  const cfg = config

  // ── Connect ───────────────────────────────────────────────────────────────
  const client = new ImapFlow({
    host:   config.host,
    port:   config.port,
    secure: true,
    logger: false,
    auth:   { user: config.emailAddress, pass: password },
    tls:    { rejectUnauthorized: false },
  })

  let fetched = 0, matched = 0, saved = 0, skipped = 0
  const errors: string[] = []

  try {
    console.error(`[run-imap-sync] Connecting to ${config.host}:${config.port}…`)
    await client.connect()
    console.error("[run-imap-sync] Connected + authenticated")

    const { simpleParser } = await import("mailparser") as typeof import("mailparser")

    // Process one folder — shared logic
    async function processFolder(folder: string) {
      console.error(`[run-imap-sync] Opening ${folder}…`)
      const mb = await client.mailboxOpen(folder)
      console.error(`[run-imap-sync] ${folder}: ${mb.exists} messages total in mailbox`)

      const raw = await client.search({ since })
      const uids = Array.isArray(raw) ? raw : []
      console.error(`[run-imap-sync] ${folder}: search SINCE ${since.toISOString()} → ${uids.length} UIDs${uids.length ? `: ${uids.slice(0, 15).join(",")}${uids.length > 15 ? "…" : ""}` : ""}`)

      if (uids.length === 0) return

      for await (const msg of client.fetch(uids, { source: true })) {
        fetched++
        try {
          if (!msg.source) {
            console.error(`[run-imap-sync] UID ${msg.uid}: no source — skipping`)
            continue
          }

          const p          = await simpleParser(msg.source)
          const fromAddr   = p.from?.value?.[0]
          const toAddr     = p.to && !Array.isArray(p.to)
            ? p.to.value[0]
            : (p.to as import("mailparser").AddressObject[])?.[0]?.value?.[0]

          const from       = fromAddr?.address ?? ""
          const fromName   = (fromAddr?.name?.trim() && fromAddr.name.trim() !== from)
            ? fromAddr.name.trim()
            : from.split("@")[0]
          const to         = toAddr?.address ?? ""
          const subject    = p.subject ?? "(no subject)"
          const msgId      = (p.messageId ?? "").replace(/^<|>$/g, "").trim() || null
          const inReplyTo  = (p.inReplyTo  ?? "").replace(/^<|>$/g, "").trim() || null

          console.error(`[run-imap-sync] UID ${msg.uid}: from=${from} to=${to} subject="${subject}" msgId=${msgId ?? "none"}`)

          // Dedup by messageId
          if (msgId) {
            const exists = await prisma.crmEmail.findFirst({ where: { messageId: { contains: msgId } } })
            if (exists) {
              console.error(`[run-imap-sync] UID ${msg.uid}: already in DB (crmEmail.id=${exists.id}) — skip`)
              skipped++
              continue
            }
          }

          const isSent       = from.toLowerCase() === cfg.emailAddress.toLowerCase()
          const direction    = isSent ? "sent" : "received"
          const contactEmail = isSent ? to : from
          console.error(`[run-imap-sync] UID ${msg.uid}: direction=${direction} contact=${contactEmail}`)

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
            console.error(`[run-imap-sync] UID ${msg.uid}: auto-created Lead demoCall.id=${demoCall.id}`)
          }

          if (demoCall) {
            matched++
            console.error(`[run-imap-sync] UID ${msg.uid}: matched demoCall.id=${demoCall.id} (${demoCall.contactName})`)
          } else {
            console.error(`[run-imap-sync] UID ${msg.uid}: no demoCall match (sent email to untracked contact)`)
          }

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
              imapConfigId: cfg.id,
            },
          })

          if (!threadId) {
            await prisma.crmEmail.update({ where: { id: created.id }, data: { threadId: created.id } })
          }

          console.error(`[run-imap-sync] UID ${msg.uid}: SAVED crmEmail.id=${created.id}`)
          saved++

        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err)
          console.error(`[run-imap-sync] UID ${msg.uid}: ERROR — ${detail}`)
          errors.push(`UID ${msg.uid}: ${detail}`)
        }
      }
    }

    // Run INBOX first, then Sent variants
    await processFolder("INBOX")

    for (const folder of ["Sent", "Sent Items", "Sent Messages"]) {
      try {
        await processFolder(folder)
      } catch {
        console.error(`[run-imap-sync] Folder "${folder}" not found — skipping`)
      }
    }

    try { await client.logout() } catch { /* ignore */ }

    await prisma.imapConfig.update({
      where: { id: cfg.id },
      data:  { lastSyncAt: new Date(), lastSyncEmailCount: saved },
    })

    console.error(`[run-imap-sync] DONE — fetched=${fetched} matched=${matched} saved=${saved} skipped=${skipped} errors=${errors.length}`)
    return NextResponse.json({ fetched, matched, saved, skipped, errors })

  } catch (err) {
    const detail = err instanceof Error
      ? `${err.message} | code=${(err as unknown as Record<string,unknown>)["code"] ?? "n/a"} | response=${(err as unknown as Record<string,unknown>)["responseText"] ?? (err as unknown as Record<string,unknown>)["response"] ?? "n/a"}`
      : String(err)
    console.error(`[run-imap-sync] FATAL: ${detail}`)
    try { client.close() } catch { /* ignore */ }
    return NextResponse.json({ error: detail, fetched, matched, saved, skipped, errors }, { status: 500 })
  }
}
