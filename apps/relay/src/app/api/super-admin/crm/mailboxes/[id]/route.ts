import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"
import { sendViaTitanSmtp } from "@/lib/titan-smtp"
import { randomBytes } from "crypto"
import { createTransport } from "nodemailer"

export const maxDuration = 30

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

function serializeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const e = err as Error & Record<string, unknown>
  const parts: string[] = [e.message]
  if (e["code"])           parts.push(`code=${e["code"]}`)
  if (e["responseText"])   parts.push(String(e["responseText"]))
  if (e["serverResponse"]) parts.push(String(e["serverResponse"]))
  return parts.join(" — ")
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { action?: string; to?: string }

  const cfg = await prisma.imapConfig.findUnique({ where: { salesUserId: id } })
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "No mailbox configured for this user" }, { status: 404 })
  }

  let password: string
  try {
    password = decryptField(cfg.encryptedPassword)
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: `Password decryption failed — the encryption key may have changed. Re-save the password. (${err instanceof Error ? err.message : String(err)})`,
    }, { status: 400 })
  }

  // ── Test IMAP ─────────────────────────────────────────────────────────────
  if (body.action === "test_imap") {
    const { ImapFlow } = await import("imapflow") as typeof import("imapflow")

    const log: string[] = []
    const captureLogger = {
      debug: (o: Record<string, unknown>) => { if (o["msg"]) log.push(`DBG: ${o["msg"]}`) },
      info:  (o: Record<string, unknown>) => { if (o["msg"]) log.push(`INF: ${o["msg"]}`) },
      warn:  (o: Record<string, unknown>) => { if (o["msg"]) log.push(`WRN: ${o["msg"]}`) },
      error: (o: Record<string, unknown>) => { if (o["msg"]) log.push(`ERR: ${o["msg"]}`) },
      child: () => captureLogger,
      trace: () => {},
      fatal: () => {},
    }

    const client = new ImapFlow({
      host:               cfg.host,
      port:               cfg.port,
      secure:             cfg.port === 993,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger:             captureLogger as any,
      auth:               { user: cfg.emailAddress, pass: password },
      tls:                { rejectUnauthorized: false },
      connectionTimeout:  8000,
      greetingTimeout:    5000,
      socketTimeout:      10000,
    })

    try {
      log.push(`Connecting to ${cfg.host}:${cfg.port}…`)
      await client.connect()
      log.push("Connected + authenticated OK")

      const folderList = await client.list()
      const folders    = folderList.map(f => f.path)
      log.push(`Folders: ${folders.slice(0, 10).join(", ")}`)

      let messageCount = 0
      try {
        await client.mailboxOpen("INBOX")
        const uids = await client.search({ since: new Date(Date.now() - 30 * 86400_000) })
        messageCount = Array.isArray(uids) ? uids.length : 0
        log.push(`INBOX: ${messageCount} messages in last 30 days`)
      } catch (inboxErr) {
        log.push(`INBOX check: ${inboxErr instanceof Error ? inboxErr.message : String(inboxErr)}`)
      }

      try { await client.logout() } catch { /* ignore */ }

      return NextResponse.json({ ok: true, log, folders, messageCount })
    } catch (err) {
      log.push(`FAILED: ${err instanceof Error ? err.message : String(err)}`)
      try { client.close() } catch { /* ignore */ }
      return NextResponse.json({ ok: false, error: serializeError(err), log }, { status: 400 })
    }
  }

  // ── Test SMTP ─────────────────────────────────────────────────────────────
  if (body.action === "test_smtp") {
    const transport = createTransport({
      host:   cfg.smtpHost,
      port:   cfg.smtpPort,
      secure: cfg.smtpPort === 465,
      auth:   { user: cfg.emailAddress, pass: password },
      tls:    { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout:   8000,
      socketTimeout:     10000,
    })
    try {
      await transport.verify()
      transport.close()
      return NextResponse.json({
        ok:      true,
        message: `SMTP connection verified on ${cfg.smtpHost}:${cfg.smtpPort} as ${cfg.emailAddress}`,
      })
    } catch (err) {
      transport.close()
      return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 400 })
    }
  }

  // ── Send Test Email ───────────────────────────────────────────────────────
  if (body.action === "send_test") {
    const to = typeof body.to === "string" ? body.to.trim() : ""
    if (!to) return NextResponse.json({ error: "Recipient email (to) is required" }, { status: 400 })

    const messageId = `<relay-test-${randomBytes(8).toString("hex")}@relay>`
    try {
      await sendViaTitanSmtp(
        { smtpHost: cfg.smtpHost, smtpPort: cfg.smtpPort, emailAddress: cfg.emailAddress, password },
        {
          to,
          subject:   "Test email from Relay CRM",
          bodyHtml:  `<p>This is a test email sent from the Relay CRM super-admin mailbox management panel.</p><p>Sender: ${cfg.emailAddress}</p>`,
          bodyText:  `This is a test email sent from the Relay CRM super-admin mailbox management panel.\n\nSender: ${cfg.emailAddress}`,
          messageId,
        },
      )
      return NextResponse.json({ ok: true, message: `Test email sent to ${to} from ${cfg.emailAddress}` })
    } catch (err) {
      return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 400 })
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
