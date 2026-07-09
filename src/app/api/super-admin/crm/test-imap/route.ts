import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"

export const maxDuration = 30

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function GET() {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const steps: string[] = []

  // ── Step 1: Load config ───────────────────────────────────────────────────
  steps.push("1. Loading ImapConfig from database…")
  const config = await prisma.imapConfig.findUnique({
    where: { superAdminId: session.superAdminId! },
  })
  if (!config) {
    steps.push("   FAIL: No ImapConfig record found for this super admin")
    return NextResponse.json({ ok: false, steps })
  }
  steps.push(`   OK: Found config id=${config.id}`)
  steps.push(`   emailAddress: ${config.emailAddress}`)
  steps.push(`   host: ${config.host}, port: ${config.port}`)
  steps.push(`   smtpHost: ${config.smtpHost}, smtpPort: ${config.smtpPort}`)
  steps.push(`   enabled: ${config.enabled}`)
  steps.push(`   lastSyncAt: ${config.lastSyncAt?.toISOString() ?? "never"}`)
  steps.push(`   lastSyncEmailCount: ${config.lastSyncEmailCount}`)
  steps.push(`   encryptedPassword: ${config.encryptedPassword ? `[SET, length=${config.encryptedPassword.length}]` : "[EMPTY — this is the problem!]"}`)

  // ── Step 2: Decrypt password ──────────────────────────────────────────────
  steps.push("2. Decrypting password…")
  let password: string
  try {
    password = decryptField(config.encryptedPassword)
    steps.push(`   OK: Decrypted (length=${password.length})`)
  } catch (err) {
    steps.push(`   FAIL: ${err instanceof Error ? err.message : String(err)}`)
    steps.push("   → Check that IMAP_ENCRYPTION_KEY env var is set in Vercel and matches the key used when saving the password")
    return NextResponse.json({ ok: false, steps })
  }

  // ── Step 3: Connect to IMAP ───────────────────────────────────────────────
  steps.push(`3. Connecting to IMAP ${config.host}:${config.port}…`)
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
    steps.push("   OK: Connected and authenticated")
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    steps.push(`   FAIL: ${msg}`)
    return NextResponse.json({ ok: false, steps })
  }

  // ── Step 4: List folders ──────────────────────────────────────────────────
  steps.push("4. Listing mailbox folders…")
  try {
    const folderList = await client.list()
    const paths = folderList.map(f => f.path)
    steps.push(`   Found ${paths.length} folders: ${paths.join(", ")}`)
  } catch (err) {
    steps.push(`   FAIL listing folders: ${err instanceof Error ? err.message : String(err)}`)
  }

  // ── Step 5: Open INBOX ────────────────────────────────────────────────────
  steps.push("5. Opening INBOX…")
  try {
    const mb = await client.mailboxOpen("INBOX")
    steps.push(`   OK: INBOX has ${mb.exists} total messages`)

    const rawUids = await client.search({ since: new Date(Date.now() - 30 * 86400_000) })
    const uids = Array.isArray(rawUids) ? rawUids : []
    steps.push(`   Found ${uids.length} messages in last 30 days`)

    if (uids.length > 0) {
      steps.push("6. Fetching envelope of most recent 3 messages…")
      const sample = uids.slice(-3)
      for await (const msg of client.fetch(sample, { envelope: true })) {
        const from = msg.envelope?.from?.[0]?.address ?? "(unknown)"
        const subj = msg.envelope?.subject ?? "(no subject)"
        const date = msg.envelope?.date?.toISOString() ?? "(unknown)"
        steps.push(`   UID ${msg.uid}: from=${from} subject="${subj}" date=${date}`)
      }
    }
  } catch (err) {
    steps.push(`   FAIL opening INBOX: ${err instanceof Error ? err.message : String(err)}`)
  }

  try { await client.logout() } catch { /* ignore */ }

  // ── Step 6: Check CRM contact emails ─────────────────────────────────────
  steps.push("7. Checking CRM contacts (DemoCall.contactEmail)…")
  const demoCalls = await prisma.demoCall.findMany({
    select: { contactEmail: true, contactName: true },
  })
  if (demoCalls.length === 0) {
    steps.push("   No demo calls / CRM contacts found — incoming emails won't match any contact")
  } else {
    steps.push(`   Found ${demoCalls.length} contacts: ${demoCalls.map(d => d.contactEmail).join(", ")}`)
  }

  // ── Step 7: Count existing CrmEmail records ───────────────────────────────
  steps.push("8. Counting CrmEmail records in database…")
  const emailCount = await prisma.crmEmail.count()
  steps.push(`   Total CrmEmail records: ${emailCount}`)
  if (emailCount > 0) {
    const recent = await prisma.crmEmail.findMany({
      take: 5, orderBy: { sentAt: "desc" },
      select: { id: true, direction: true, fromAddress: true, toAddress: true, subject: true, sentAt: true, source: true },
    })
    steps.push("   Most recent 5:")
    for (const e of recent) {
      steps.push(`     [${e.source}] ${e.direction} from=${e.fromAddress} to=${e.toAddress} subj="${e.subject}" ${e.sentAt.toISOString()}`)
    }
  }

  steps.push("─── All checks complete ───")
  return NextResponse.json({ ok: true, steps })
}
