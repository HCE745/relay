import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"

export const maxDuration = 30

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

interface RecentMessage {
  uid:     number
  from:    string
  subject: string
  date:    string
}

export async function GET() {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── Config ────────────────────────────────────────────────────────────────
  const config = await prisma.imapConfig.findUnique({
    where: { superAdminId: session.superAdminId! },
  })

  if (!config) {
    return NextResponse.json({
      config:         null,
      connection:     { status: "skipped", error: "No ImapConfig record saved — configure credentials in CRM Settings first" },
      auth:           { status: "skipped" },
      folders:        [],
      recentMessages: [],
      crmContacts:    [],
      crmEmailCount:  0,
    })
  }

  const configSummary = {
    id:                 config.id,
    email:              config.emailAddress,
    host:               config.host,
    port:               config.port,
    smtpHost:           config.smtpHost,
    smtpPort:           config.smtpPort,
    enabled:            config.enabled,
    lastSyncAt:         config.lastSyncAt?.toISOString() ?? null,
    lastSyncEmailCount: config.lastSyncEmailCount,
    passwordStored:     config.encryptedPassword.length > 0,
  }

  // ── Decrypt password ──────────────────────────────────────────────────────
  let password: string
  try {
    password = decryptField(config.encryptedPassword)
  } catch (err) {
    return NextResponse.json({
      config:         configSummary,
      connection:     { status: "skipped", error: "Could not run — password decrypt failed" },
      auth:           { status: "failed", error: err instanceof Error ? err.message : String(err), hint: "Check that IMAP_ENCRYPTION_KEY env var is set in Vercel and has not changed since the password was saved" },
      folders:        [],
      recentMessages: [],
      crmContacts:    await getCrmContacts(),
      crmEmailCount:  await prisma.crmEmail.count(),
    })
  }

  // ── IMAP connect ──────────────────────────────────────────────────────────
  const { ImapFlow } = await import("imapflow") as typeof import("imapflow")
  const client = new ImapFlow({
    host:    config.host,
    port:    config.port,
    secure:  true,
    logger:  false,
    auth:    { user: config.emailAddress, pass: password },
    tls:     { rejectUnauthorized: false },
  })

  try {
    await client.connect()
  } catch (err) {
    return NextResponse.json({
      config:         configSummary,
      connection:     { status: "failed", error: err instanceof Error ? err.message : String(err) },
      auth:           { status: "unknown" },
      folders:        [],
      recentMessages: [],
      crmContacts:    await getCrmContacts(),
      crmEmailCount:  await prisma.crmEmail.count(),
    })
  }

  // Connection succeeded — authentication is implicit in ImapFlow on connect
  const connection = { status: "ok" as const }
  const auth       = { status: "ok" as const }

  // ── List folders ──────────────────────────────────────────────────────────
  let folders: string[] = []
  try {
    const list = await client.list()
    folders = list.map(f => f.path)
  } catch { /* ignore */ }

  // ── Recent 5 messages from INBOX ─────────────────────────────────────────
  const recentMessages: RecentMessage[] = []
  try {
    await client.mailboxOpen("INBOX")
    const rawUids = await client.search({ since: new Date(Date.now() - 90 * 86400_000) })
    const uids    = Array.isArray(rawUids) ? rawUids : []
    const sample  = uids.slice(-5)
    if (sample.length > 0) {
      for await (const msg of client.fetch(sample, { envelope: true })) {
        recentMessages.push({
          uid:     msg.uid,
          from:    msg.envelope?.from?.[0]?.address ?? "(unknown)",
          subject: msg.envelope?.subject ?? "(no subject)",
          date:    msg.envelope?.date?.toISOString() ?? "(unknown)",
        })
      }
    }
  } catch { /* ignore */ }

  try { await client.logout() } catch { /* ignore */ }

  // ── CRM data ──────────────────────────────────────────────────────────────
  const [crmContacts, crmEmailCount] = await Promise.all([
    getCrmContacts(),
    prisma.crmEmail.count(),
  ])

  return NextResponse.json({
    config:    configSummary,
    connection,
    auth,
    folders,
    recentMessages,
    crmContacts,
    crmEmailCount,
  })
}

async function getCrmContacts(): Promise<{ name: string; email: string }[]> {
  const calls = await prisma.demoCall.findMany({
    select: { contactName: true, contactEmail: true },
  })
  return calls.map(c => ({ name: c.contactName, email: c.contactEmail }))
}
