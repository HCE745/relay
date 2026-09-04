import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"

export const maxDuration = 30

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// Pull every useful property off an imapflow (or any) error
function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { raw: String(err) }
  // imapflow errors carry responseText, response, serverResponse, code, command
  const e = err as Error & Record<string, unknown>
  return {
    message:        e.message,
    code:           e["code"],
    command:        e["command"],
    response:       e["response"],
    responseText:   e["responseText"],
    serverResponse: e["serverResponse"],
    stack:          e.stack?.split("\n").slice(0, 4).join(" | "),
  }
}

interface AttemptResult {
  config:    string
  status:    "ok" | "failed"
  error?:    Record<string, unknown>
  log:       string[]
  folders?:  string[]
  messages?: { uid: number; from: string; subject: string; date: string }[]
}

async function tryConnect(
  email: string,
  password: string,
  host: string,
  port: number,
  secure: boolean,
): Promise<AttemptResult> {
  const label = `${host}:${port} ${secure ? "SSL/TLS" : "STARTTLS"}`
  const log: string[] = []

  const { ImapFlow } = await import("imapflow") as typeof import("imapflow")

  // Capture protocol-level log lines from imapflow
  const captureLogger = {
    debug: (obj: Record<string, unknown>) => { if (obj["msg"]) log.push(`DBG: ${obj["msg"]}`) },
    info:  (obj: Record<string, unknown>) => { if (obj["msg"]) log.push(`INF: ${obj["msg"]}`) },
    warn:  (obj: Record<string, unknown>) => { if (obj["msg"]) log.push(`WRN: ${obj["msg"]}`) },
    error: (obj: Record<string, unknown>) => { if (obj["msg"]) log.push(`ERR: ${obj["msg"]}`) },
    child: () => captureLogger,
    trace: () => {},
    fatal: () => {},
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger: captureLogger as any,
    auth: { user: email, pass: password },
    tls:  { rejectUnauthorized: false },
    // Give up quickly so we don't hang the request
    connectionTimeout: 8000,
    greetingTimeout:   5000,
    socketTimeout:     10000,
  })

  try {
    log.push(`Connecting to ${label}…`)
    await client.connect()
    log.push("Connected + authenticated OK")

    // List folders
    const folderList = await client.list()
    const folders    = folderList.map(f => f.path)
    log.push(`Folders: ${folders.join(", ")}`)

    // Peek at recent INBOX messages
    const messages: AttemptResult["messages"] = []
    try {
      await client.mailboxOpen("INBOX")
      const rawUids = await client.search({ since: new Date(Date.now() - 90 * 86400_000) })
      const uids    = Array.isArray(rawUids) ? rawUids : []
      log.push(`INBOX: ${uids.length} messages in last 90 days`)
      const sample = uids.slice(-5)
      if (sample.length) {
        for await (const msg of client.fetch(sample, { envelope: true })) {
          messages.push({
            uid:     msg.uid,
            from:    msg.envelope?.from?.[0]?.address ?? "(unknown)",
            subject: msg.envelope?.subject ?? "(no subject)",
            date:    msg.envelope?.date?.toISOString() ?? "(unknown)",
          })
        }
      }
    } catch (inboxErr) {
      log.push(`INBOX error: ${inboxErr instanceof Error ? inboxErr.message : String(inboxErr)}`)
    }

    try { await client.logout() } catch { /* ignore */ }

    return { config: label, status: "ok", log, folders, messages }
  } catch (err) {
    log.push(`FAILED: ${err instanceof Error ? err.message : String(err)}`)
    try { client.close() } catch { /* ignore */ }
    return { config: label, status: "failed", error: serializeError(err), log }
  }
}

export async function GET() {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── Environment check ─────────────────────────────────────────────────────
  const encKeySet    = !!(process.env.IMAP_ENCRYPTION_KEY)
  const encKeyLength = (process.env.IMAP_ENCRYPTION_KEY ?? "").length

  // ── Config ────────────────────────────────────────────────────────────────
  const config = await prisma.imapConfig.findUnique({
    where: { superAdminId: session.superAdminId! },
  })

  if (!config) {
    return NextResponse.json({
      env:            { IMAP_ENCRYPTION_KEY: encKeySet ? `set (${encKeyLength} chars)` : "NOT SET — password cannot be decrypted" },
      config:         null,
      decrypt:        { status: "skipped" },
      attempts:       [],
      crmContacts:    [],
      crmEmailCount:  0,
    })
  }

  const configSummary = {
    email:              config.emailAddress,
    host:               config.host,
    port:               config.port,
    smtpHost:           config.smtpHost,
    smtpPort:           config.smtpPort,
    enabled:            config.enabled,
    lastSyncAt:         config.lastSyncAt?.toISOString() ?? null,
    lastSyncEmailCount: config.lastSyncEmailCount,
    encryptedPasswordLength: config.encryptedPassword.length,
    encryptedPasswordFormat: config.encryptedPassword.includes(":") ? "ok (iv:tag:data)" : "INVALID (no colons — was it saved correctly?)",
  }

  // ── Decrypt ───────────────────────────────────────────────────────────────
  let password: string
  let decryptStatus: Record<string, unknown>
  try {
    password      = decryptField(config.encryptedPassword)
    decryptStatus = {
      status:         "ok",
      passwordLength: password.length,
      // Show first + last char so you can verify it looks right without exposing it
      passwordHint:   password.length > 0
        ? `${password[0]}${"*".repeat(Math.max(0, password.length - 2))}${password[password.length - 1]}`
        : "(empty — password was blank when saved)",
    }
  } catch (err) {
    return NextResponse.json({
      env:           { IMAP_ENCRYPTION_KEY: encKeySet ? `set (${encKeyLength} chars)` : "NOT SET" },
      config:        configSummary,
      decrypt:       {
        status: "failed",
        error:  err instanceof Error ? err.message : String(err),
        hint:   encKeySet
          ? "Key is set but decryption failed — the key may have changed since the password was saved. Re-save the password in CRM Settings."
          : "IMAP_ENCRYPTION_KEY is not set in Vercel env vars. Add it and re-save the password.",
      },
      attempts:      [],
      crmContacts:   await getCrmContacts(),
      crmEmailCount: await prisma.crmEmail.count(),
    })
  }

  // ── Try multiple IMAP configurations ─────────────────────────────────────
  // Test in parallel: port 993 SSL (standard) and port 143 STARTTLS (fallback)
  const [attempt993, attempt143] = await Promise.all([
    tryConnect(config.emailAddress, password, config.host, 993,  true),
    tryConnect(config.emailAddress, password, config.host, 143, false),
  ])

  const [crmContacts, crmEmailCount] = await Promise.all([
    getCrmContacts(),
    prisma.crmEmail.count(),
  ])

  return NextResponse.json({
    env:           { IMAP_ENCRYPTION_KEY: encKeySet ? `set (${encKeyLength} chars)` : "NOT SET — password cannot be decrypted" },
    config:        configSummary,
    decrypt:       decryptStatus,
    attempts:      [attempt993, attempt143],
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
