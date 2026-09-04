import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"

export const maxDuration = 60
export const dynamic = "force-dynamic"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function POST() {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const logs: string[] = []
  function log(msg: string) {
    logs.push(msg)
    console.error(`[debug-sync] ${msg}`)
  }

  const config = await prisma.imapConfig.findUnique({ where: { superAdminId: session.superAdminId! } })
  if (!config) {
    log("No ImapConfig found — save credentials in CRM Settings first")
    return NextResponse.json({ ok: false, logs })
  }
  if (!config.enabled) {
    log("ImapConfig is disabled — enable it in CRM Settings")
    return NextResponse.json({ ok: false, logs })
  }

  log(`Config: ${config.emailAddress} @ ${config.host}:${config.port}`)
  log(`lastSyncAt: ${config.lastSyncAt?.toISOString() ?? "null (first run)"}`)

  let password: string
  try {
    password = decryptField(config.encryptedPassword)
    log(`Password decrypted OK (length=${password.length})`)
  } catch (err) {
    log(`FAIL decrypt: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json({ ok: false, logs })
  }

  const { ImapFlow } = await import("imapflow") as typeof import("imapflow")
  const { simpleParser } = await import("mailparser") as typeof import("mailparser")

  const since = config.lastSyncAt
    ? new Date(config.lastSyncAt.getTime() - 86_400_000)
    : new Date(Date.now() - 90 * 86_400_000)
  log(`Since: ${since.toISOString()} (~${Math.round((Date.now() - since.getTime()) / 86_400_000)} days ago)`)

  const client = new ImapFlow({
    host:    config.host,
    port:    config.port,
    secure:  true,
    logger:  false,
    auth:    { user: config.emailAddress, pass: password },
    tls:     { rejectUnauthorized: false },
  })

  let totalSynced = 0, totalSkipped = 0

  try {
    log(`Connecting to ${config.host}:${config.port}…`)
    await client.connect()
    log("Connected + authenticated OK")

    for (const folder of ["INBOX", "Sent", "Sent Items", "Sent Messages"]) {
      try {
        const mb = await client.mailboxOpen(folder)
        log(`\nFolder: ${folder} — ${mb.exists} messages total`)

        const rawUids = await client.search({ since })
        const uids = Array.isArray(rawUids) ? rawUids : []
        log(`  UIDs since ${since.toISOString()}: ${uids.length}`)
        if (uids.length === 0) continue

        for await (const raw of client.fetch(uids, { source: true })) {
          try {
            const parsed = await simpleParser(raw.source!)
            const fromAddr = parsed.from?.value?.[0]
            const toAddr   = (parsed.to as import("mailparser").AddressObject)?.value?.[0]?.address ?? ""
            const from     = fromAddr?.address ?? ""
            const subject  = parsed.subject ?? "(no subject)"
            const msgId    = (parsed.messageId ?? "").replace(/^<|>$/g, "").trim()

            log(`  uid=${raw.uid} from=${from} to=${toAddr} subj="${subject}"`)

            if (msgId) {
              const existing = await prisma.crmEmail.findFirst({ where: { messageId: { contains: msgId } } })
              if (existing) { log(`    → SKIPPED (already in DB)`); totalSkipped++; continue }
            }

            const isSent     = from.toLowerCase() === config.emailAddress.toLowerCase()
            const direction  = isSent ? "sent" : "received"
            const contact    = isSent ? toAddr : from

            const demoCall = await prisma.demoCall.findFirst({
              where: { contactEmail: { equals: contact, mode: "insensitive" } },
            })
            log(`    direction=${direction} contact=${contact} demoCall=${demoCall ? `YES (${demoCall.contactName})` : "NO"}`)

            const inReply = (parsed.inReplyTo ?? "").replace(/^<|>$/g, "").trim() || null
            let threadId: string | null = null
            if (inReply) {
              const parent = await prisma.crmEmail.findFirst({ where: { OR: [{ messageId: inReply }, { messageId: `<${inReply}>` }] } })
              threadId = parent?.threadId ?? parent?.id ?? null
            }
            if (!threadId) {
              const prior = await prisma.crmEmail.findFirst({ where: { contactEmail: { equals: contact, mode: "insensitive" } }, orderBy: { sentAt: "desc" } })
              threadId = prior?.threadId ?? prior?.id ?? null
            }

            const html = parsed.html || ""
            const text = parsed.text || ""
            const created = await prisma.crmEmail.create({
              data: {
                demoCallId:   demoCall?.id ?? null,
                contactEmail: contact,
                direction,
                fromAddress:  from,
                toAddress:    toAddr,
                subject,
                bodyHtml:     html || `<pre>${text}</pre>`,
                bodyText:     text,
                messageId:    msgId || null,
                inReplyTo:    inReply,
                threadId,
                sentAt:       parsed.date ?? new Date(),
                source:       "imap_sync",
                imapConfigId: config.id,
              },
            })
            if (!threadId) {
              await prisma.crmEmail.update({ where: { id: created.id }, data: { threadId: created.id } })
            }
            log(`    → SAVED (id=${created.id})`)
            totalSynced++
          } catch (err) {
            log(`    ERROR: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      } catch (err) {
        log(`  Folder "${folder}" skipped: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    try { await client.logout() } catch { /* ignore */ }

    await prisma.imapConfig.update({
      where: { id: config.id },
      data:  { lastSyncAt: new Date(), lastSyncEmailCount: totalSynced },
    })

    log(`\n=== DONE: synced=${totalSynced}, skipped=${totalSkipped} ===`)
    return NextResponse.json({ ok: true, synced: totalSynced, skipped: totalSkipped, logs })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    log(`FATAL: ${detail}`)
    try { client.close() } catch { /* ignore */ }
    return NextResponse.json({ ok: false, synced: totalSynced, skipped: totalSkipped, logs })
  }
}
