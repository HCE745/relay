// Minimal transactional email over Resend's REST API (no SDK dependency).
//
// "Configured" requires BOTH a Resend API key AND an explicit From address on a
// domain you control — sending from Resend's shared onboarding address is a dev
// convenience only. Customer-facing features (e.g. emailing an invoice) gate on
// isEmailConfigured() and offer "Download PDF" instead when it is false, so a
// send control is never rendered that would silently fail.

export type EmailAttachment = { filename: string; content: string } // content = base64
export type EmailResult = { delivered: boolean; dev?: boolean; error?: string }

/** True only when a real, domain-backed sender is configured. */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.CLEANING_EMAIL_FROM
}

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  text: string
  html?: string
  attachments?: EmailAttachment[]
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.CLEANING_EMAIL_FROM || "HCE Cleaning <onboarding@resend.dev>"
  const to = Array.isArray(opts.to) ? opts.to : [opts.to]
  if (to.length === 0) return { delivered: false, error: "No recipient" }

  if (!key) {
    console.log(`[email:dev] to=${to.join(",")} subject="${opts.subject}"${opts.attachments?.length ? ` (+${opts.attachments.length} attachment)` : ""}\n${opts.text}`)
    return { delivered: false, dev: true }
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        attachments: opts.attachments,
      }),
    })
    if (res.ok) return { delivered: true }
    const detail = await res.text().catch(() => "")
    return { delivered: false, error: `Email provider rejected the message${detail ? `: ${detail.slice(0, 200)}` : ""}` }
  } catch {
    return { delivered: false, error: "Could not reach the email provider" }
  }
}

/** Fire-and-forget: never let a notification failure break the request. */
export function sendEmailSafe(opts: { to: string | string[]; subject: string; text: string }): void {
  void sendEmail(opts).catch(() => {})
}
