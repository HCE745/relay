import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"

export const maxDuration = 60

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function POST() {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Capture all console output during sync
  const logs: string[] = []
  const orig = { log: console.log, warn: console.warn, error: console.error }
  const capture = (...args: unknown[]) => {
    const line = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ")
    logs.push(line)
    orig.log(line)
  }
  console.log   = capture
  console.warn  = capture
  console.error = capture

  try {
    const config = await prisma.imapConfig.findUnique({ where: { superAdminId: session.superAdminId! } })
    if (!config) {
      logs.push("No ImapConfig found — save credentials in CRM Settings first")
      return NextResponse.json({ ok: false, logs })
    }
    if (!config.enabled) {
      logs.push("ImapConfig is disabled — enable it in CRM Settings")
      return NextResponse.json({ ok: false, logs })
    }

    logs.push(`Config: ${config.emailAddress} @ ${config.host}:${config.port}`)

    let password: string
    try {
      password = decryptField(config.encryptedPassword)
      logs.push(`Password decrypted OK (length=${password.length})`)
    } catch (err) {
      logs.push(`FAIL decrypt: ${err instanceof Error ? err.message : String(err)}`)
      return NextResponse.json({ ok: false, logs })
    }

    const { ImapFlow } = await import("imapflow") as typeof import("imapflow")
    const { simpleParser } = await import("mailparser") as typeof import("mailparser")

    const client = new ImapFlow({
      host:    config.host,
      port:    config.port,
      secure:  true,
      logger:  false,
      auth:    { user: config.emailAddress, pass: password },
      tls:     { rejectUnauthorized: false },
    })

    logs.push(`Connecting to IMAP ${config.host}:${config.port}…`)
    await client.connect()
    logs.push("Connected + authenticated OK")

    const since = new Date(Date.now() - 30 * 86400_000)
    const foldersToTry = ["INBOX", "Sent", "Sent Items", "Sent Messages"]
    let totalSynced = 0
    let totalSkipped = 0

    for (const folder of foldersToTry) {
      try {
        const mb = await client.mailboxOpen(folder)
        logs.push(`\nFolder: ${folder} — ${mb.exists} total messages`)

        const rawUids = await client.search({ since })
        const uids = Array.isArray(rawUids) ? rawUids : []
        logs.push(`  UIDs since 30 days ago: ${uids.length}`)
        if (uids.length === 0) continue

        for await (const raw of client.fetch(uids, { source: true })) {
          try {
            const parsed = await simpleParser(raw.source!)
            const from    = parsed.from?.value?.[0]?.address ?? ""
            const toAddr  = (parsed.to as import("mailparser").AddressObject)?.value?.[0]?.address ?? ""
            const subject = parsed.subject ?? "(no subject)"
            const msgId   = (parsed.messageId ?? "").replace(/^<|>$/g, "")

            logs.push(`  MSG uid=${raw.uid} from=${from} to=${toAddr} subj="${subject}"`)

            // Check for duplicate
            if (msgId) {
              const existing = await prisma.crmEmail.findFirst({ where: { messageId: { contains: msgId } } })
              if (existing) {
                logs.push(`    → SKIPPED (already in DB, id=${existing.id})`)
                totalSkipped++
                continue
              }
            }

            // Direction & contact match
            const isSent     = from.toLowerCase() === config.emailAddress.toLowerCase()
            const direction  = isSent ? "sent" : "received"
            const contact    = isSent ? toAddr : from
            logs.push(`    direction=${direction} contactEmail=${contact}`)

            const demoCall = await prisma.demoCall.findFirst({
              where: { contactEmail: { equals: contact, mode: "insensitive" } },
            })
            logs.push(`    demoCall match: ${demoCall ? `YES (id=${demoCall.id}, name=${demoCall.contactName})` : "NO (no matching demo call)"}`)

            // Thread resolution
            const inReply = (parsed.inReplyTo ?? "").replace(/^<|>$/g, "") || null
            let threadId: string | null = null
            if (inReply) {
              const parent = await prisma.crmEmail.findFirst({ where: { OR: [{ messageId: inReply }, { messageId: `<${inReply}>` }] } })
              threadId = parent?.threadId ?? parent?.id ?? null
              logs.push(`    inReplyTo=${inReply} → threadId=${threadId ?? "none"}`)
            }
            if (!threadId) {
              const prior = await prisma.crmEmail.findFirst({
                where: { contactEmail: { equals: contact, mode: "insensitive" } },
                orderBy: { sentAt: "desc" },
              })
              threadId = prior?.threadId ?? prior?.id ?? null
              logs.push(`    fallback threadId from prior email: ${threadId ?? "none (will create new thread)"}`)
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
            logs.push(`    → SAVED (id=${created.id})`)
            totalSynced++
          } catch (err) {
            logs.push(`    ERROR processing msg: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      } catch (err) {
        logs.push(`  Folder ${folder} skipped: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    try { await client.logout() } catch { /* ignore */ }

    await prisma.imapConfig.update({
      where: { id: config.id },
      data:  { lastSyncAt: new Date(), lastSyncEmailCount: totalSynced },
    })

    logs.push(`\n=== DONE: synced=${totalSynced}, skipped=${totalSkipped} ===`)
    return NextResponse.json({ ok: true, synced: totalSynced, skipped: totalSkipped, logs })
  } finally {
    console.log   = orig.log
    console.warn  = orig.warn
    console.error = orig.error
  }
}
