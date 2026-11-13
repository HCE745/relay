import "server-only"

// Known Sent-folder names to try when no special-use flag is advertised
const SENT_NAME_CANDIDATES = ["Sent", "Sent Items", "Sent Messages", "SENT"]

export interface AppendResult {
  ok:         boolean
  folderPath?: string
  error?:     string
}

interface ImapCreds {
  host:         string
  port:         number
  emailAddress: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function silentLogger(): any {
  const l = { debug: ()=>{}, info: ()=>{}, warn: ()=>{}, error: ()=>{}, trace: ()=>{}, fatal: ()=>{}, child: () => l }
  return l
}

/**
 * Appends `mimeBuffer` to the sender's IMAP Sent folder.
 *
 * Discovers the correct folder via special-use flags (RFC 6154) and falls back
 * to common folder names.  Returns ok=false (never throws) if the IMAP append
 * fails; callers must NOT treat this as a send failure.
 */
export async function appendToSentFolder(
  cfg:        ImapCreds,
  password:   string,
  mimeBuffer: Buffer,
  sentAt?:    Date,
): Promise<AppendResult> {
  const { ImapFlow } = await import("imapflow") as typeof import("imapflow")

  const client = new ImapFlow({
    host:              cfg.host,
    port:              cfg.port,
    secure:            cfg.port === 993,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger:            silentLogger() as any,
    auth:              { user: cfg.emailAddress, pass: password },
    tls:               { rejectUnauthorized: false },
    connectionTimeout: 10_000,
    greetingTimeout:   8_000,
    socketTimeout:     15_000,
  })

  try {
    await client.connect()

    // --- Discover Sent folder -------------------------------------------
    const mailboxes = await client.list()

    // 1. RFC 6154 special-use: \Sent attribute
    const sentPath =
      mailboxes.find(m => m.specialUse === "\\Sent")?.path ??
      // 2. Fall back to well-known names
      SENT_NAME_CANDIDATES.find(name => mailboxes.some(m => m.path === name || m.name === name)) ??
      // 3. Last resort — most servers do have a folder called "Sent"
      "Sent"

    // Append with \Seen flag so it doesn't appear as unread in the sender's client
    await client.append(sentPath, mimeBuffer, ["\\Seen"], sentAt ?? new Date())

    try { await client.logout() } catch { /* ignore */ }

    return { ok: true, folderPath: sentPath }
  } catch (err) {
    try { client.close() } catch { /* ignore */ }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Rebuilds a minimal MIME buffer from stored CrmEmail fields so a failed
 * Sent-folder append can be retried without re-sending the email.
 */
export async function buildMimeBuffer(opts: {
  from:      string
  to:        string
  subject:   string
  bodyHtml:  string
  bodyText:  string
  messageId: string
  sentAt:    Date
}): Promise<Buffer> {
  const { createTransport } = await import("nodemailer")
  const streamTransport = createTransport({ streamTransport: true, newline: "unix", buffer: true })
  const result = await streamTransport.sendMail({
    from:    opts.from,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.bodyHtml,
    text:    opts.bodyText,
    date:    opts.sentAt,
    headers: { "Message-ID": opts.messageId },
  }) as { message: Buffer }
  return result.message
}
