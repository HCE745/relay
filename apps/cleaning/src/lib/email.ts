
// Minimal transactional email. Uses Resend's REST API when RESEND_API_KEY is
// set; otherwise logs to the server console (dev/test) so flows work without
// email infrastructure. No dependency, and NOT coupled to Relay's config.
export type EmailResult = { delivered: boolean; dev?: boolean }

export async function sendEmail(opts: { to: string | string[]; subject: string; text: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.CLEANING_EMAIL_FROM || "HCE Cleaning <onboarding@resend.dev>"
  const to = Array.isArray(opts.to) ? opts.to : [opts.to]
  if (to.length === 0) return { delivered: false }

  if (!key) {
    console.log(`[email:dev] to=${to.join(",")} subject="${opts.subject}"\n${opts.text}`)
    return { delivered: false, dev: true }
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject: opts.subject, text: opts.text }),
    })
    return { delivered: res.ok }
  } catch {
    return { delivered: false }
  }
}

/** Fire-and-forget: never let a notification failure break the request. */
export function sendEmailSafe(opts: { to: string | string[]; subject: string; text: string }): void {
  void sendEmail(opts).catch(() => {})
}
