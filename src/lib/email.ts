import "server-only"

// ─────────────────────────────────────────────────────────────────────────────
// Core send function
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL     = "Relay <noreply@getrelay.software>"
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
const SUPPORT_EMAIL  = "support@getrelay.software"

export interface EmailPayload {
  to: string
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — email not sent")
    return { ok: false, error: "Email service not configured" }
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to:   payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, error: (body as { message?: string }).message ?? "Failed to send email" }
  }

  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens & helpers
// ─────────────────────────────────────────────────────────────────────────────

const FONT   = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
const NAVY   = "#0f172a"
const BLUE   = "#3b82f6"
const TEXT   = "#1e293b"
const MUTED  = "#64748b"
const SUBTLE = "#94a3b8"
const BORDER = "#e2e8f0"
const SURFACE = "#f8fafc"
const WHITE  = "#ffffff"

function btn(label: string, url: string, color = BLUE): string {
  return `<a href="${url}" style="display:inline-block;background:${color};color:${WHITE};font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;text-decoration:none;font-family:${FONT};letter-spacing:-0.1px">${label}</a>`
}

function badge(label: string, textColor: string, bg: string): string {
  return `<span style="display:inline-block;background:${bg};color:${textColor};font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT}">${label}</span>`
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="color:${MUTED};font-size:13px;padding:6px 0;width:140px;vertical-align:top;font-family:${FONT}">${label}</td>
    <td style="color:${TEXT};font-size:13px;padding:6px 0;font-weight:500;font-family:${FONT}">${value}</td>
  </tr>`
}

function card(rows: string): string {
  return `<div style="background:${SURFACE};border:1px solid ${BORDER};border-radius:8px;padding:20px 24px;margin:24px 0">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
  </div>`
}

function alertBox(html: string, color = "#1d4ed8", bg = "#eff6ff"): string {
  return `<div style="background:${bg};border-left:4px solid ${color};border-radius:0 6px 6px 0;padding:14px 18px;margin:20px 0;font-size:13px;color:${color};font-family:${FONT};line-height:1.6">${html}</div>`
}

function layout(body: string, preview = ""): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<style>
body{margin:0;padding:0;background:#f1f5f9}
@media only screen and (max-width:620px){
  .ew{padding:24px 16px!important}
  .eh{padding:20px 24px!important;border-radius:0!important}
  .ef{padding:20px 24px!important;border-radius:0!important}
}
</style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${FONT}">
${preview ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f1f5f9">${preview}&nbsp;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;</div>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9">
<tr><td class="ew" align="center" style="padding:40px 20px">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">

  <!-- Header -->
  <tr><td class="eh" style="background:${NAVY};padding:24px 40px;border-radius:12px 12px 0 0">
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="vertical-align:middle">
          <svg width="26" height="26" viewBox="1.75 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 9 V39" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
            <path d="M16 9 H27 A8.5 8.5 0 0 1 27 26 H19.5 L32 39" stroke="#5b9bff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M32 33.5 L32 39 L26.5 39" stroke="#5b9bff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </td>
        <td style="padding-left:8px;font-size:22px;font-weight:800;color:${WHITE};letter-spacing:-0.5px;font-family:${FONT}">Relay</td>
      </tr>
    </table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:${WHITE};padding:36px 40px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER}">
    ${body}
  </td></tr>

  <!-- Footer -->
  <tr><td class="ef" style="background:${SURFACE};padding:24px 40px;border:1px solid ${BORDER};border-top:none;border-radius:0 0 12px 12px">
    <p style="margin:0 0 6px;font-size:12px;color:${MUTED};font-family:${FONT}">
      <a href="${APP_URL}" style="color:${MUTED};text-decoration:none">app.getrelay.software</a>
      &nbsp;·&nbsp;
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${MUTED};text-decoration:none">${SUPPORT_EMAIL}</a>
    </p>
    <p style="margin:0;font-size:11px;color:${SUBTLE};font-family:${FONT}">© ${year} Relay. All rights reserved.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Welcome Email
// ─────────────────────────────────────────────────────────────────────────────

export function welcomeEmail({ name, orgName, setupUrl }: {
  name: string
  orgName: string
  setupUrl: string
}): string {
  return layout(`
<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Welcome to Relay, ${name}!</h1>
<p style="margin:0 0 28px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Your workspace for <strong style="color:${TEXT}">${orgName}</strong> is ready. Get set up in a few minutes and start tracking issues across your team.</p>

<div style="margin:0 0 32px">
  ${btn("Complete Setup →", setupUrl)}
</div>

<p style="margin:0 0 16px;font-size:13px;font-weight:700;color:${TEXT};text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT}">Three things to do first</p>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px">
  <tr><td style="padding:16px 0;border-bottom:1px solid ${BORDER}">
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="width:40px;height:40px;background:#eff6ff;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px">📋</td>
        <td style="padding-left:14px">
          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:${TEXT};font-family:${FONT}">Submit your first issue</p>
          <p style="margin:0;font-size:13px;color:${MUTED};font-family:${FONT}">Log a maintenance request, safety concern, or any workplace issue.</p>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 0;border-bottom:1px solid ${BORDER}">
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="width:40px;height:40px;background:#f0fdf4;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px">👥</td>
        <td style="padding-left:14px">
          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:${TEXT};font-family:${FONT}">Invite your team</p>
          <p style="margin:0;font-size:13px;color:${MUTED};font-family:${FONT}">Add employees, assign roles, and get everyone on the same platform.</p>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 0">
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="width:40px;height:40px;background:#fdf4ff;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px">⚡</td>
        <td style="padding-left:14px">
          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:${TEXT};font-family:${FONT}">Set up routing rules</p>
          <p style="margin:0;font-size:13px;color:${MUTED};font-family:${FONT}">Automatically assign issues to the right people by category and location.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>

<p style="margin:0;font-size:13px;color:${MUTED};font-family:${FONT}">Questions? We're here to help — <a href="mailto:${SUPPORT_EMAIL}" style="color:${BLUE};text-decoration:none">${SUPPORT_EMAIL}</a></p>
`, `Your ${orgName} workspace is ready — complete setup to get started`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Email Verification
// ─────────────────────────────────────────────────────────────────────────────

export function emailVerificationEmail({ name, verifyUrl }: {
  name: string
  verifyUrl: string
}): string {
  return layout(`
<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Verify your email</h1>
<p style="margin:0 0 28px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${name}, click the button below to verify your Relay email address and activate your account.</p>

<div style="margin:0 0 8px;background:${SURFACE};border:1px solid ${BORDER};border-radius:10px;padding:32px;text-align:center">
  ${btn("Verify Email Address", verifyUrl)}
  <p style="margin:16px 0 0;font-size:12px;color:${SUBTLE};font-family:${FONT}">This link expires in 24 hours</p>
</div>

<p style="margin:20px 0 6px;font-size:12px;color:${MUTED};font-family:${FONT}">Or copy and paste this URL into your browser:</p>
<p style="margin:0 0 20px;font-size:12px;color:${BLUE};font-family:monospace;word-break:break-all;line-height:1.6">${verifyUrl}</p>

${alertBox(`<strong>Security notice:</strong> If you didn't create a Relay account, you can safely ignore this email. Someone may have entered your address by mistake.`)}
`, "Verify your Relay email address to activate your account")
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Team Invite Email
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator", MANAGER: "Manager", SUPERVISOR: "Supervisor",
  EMPLOYEE: "Employee", HR: "HR", VENDOR: "Vendor",
}

export function teamInviteEmail({ inviterName, orgName, role, inviteUrl, expiresInDays = 7 }: {
  inviterName: string
  orgName: string
  role: string
  inviteUrl: string
  expiresInDays?: number
}): string {
  const displayRole = ROLE_LABELS[role] ?? role

  return layout(`
<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">You're invited to join ${orgName}</h1>
<p style="margin:0 0 28px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6"><strong style="color:${TEXT}">${inviterName}</strong> has invited you to join <strong style="color:${TEXT}">${orgName}</strong> on Relay — the operations platform for tracking workplace issues, maintenance, and team coordination.</p>

<div style="margin:0 0 8px;background:${SURFACE};border:1px solid ${BORDER};border-radius:10px;padding:32px;text-align:center">
  ${btn("Accept Invitation →", inviteUrl)}
  <p style="margin:16px 0 0;font-size:12px;color:${SUBTLE};font-family:${FONT}">Invitation expires in ${expiresInDays} days</p>
</div>

${card(`
  ${infoRow("Invited by", inviterName)}
  ${infoRow("Organization", orgName)}
  ${infoRow("Your role", displayRole)}
`)}

<p style="margin:0;font-size:13px;color:${MUTED};font-family:${FONT}">If you weren't expecting this invitation, you can safely ignore this email. The link will expire automatically.</p>
`, `${inviterName} has invited you to join ${orgName} on Relay`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Password Reset
// ─────────────────────────────────────────────────────────────────────────────

export function passwordResetEmail({ name, resetUrl }: {
  name: string
  resetUrl: string
}): string {
  return layout(`
<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Reset your password</h1>
<p style="margin:0 0 28px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${name}, we received a request to reset your Relay password. Click the button below to choose a new one.</p>

<div style="margin:0 0 8px;background:${SURFACE};border:1px solid ${BORDER};border-radius:10px;padding:32px;text-align:center">
  ${btn("Reset Password", resetUrl)}
  <p style="margin:16px 0 0;font-size:12px;color:${SUBTLE};font-family:${FONT}">This link expires in 1 hour</p>
</div>

<p style="margin:20px 0 6px;font-size:12px;color:${MUTED};font-family:${FONT}">Or copy and paste this URL into your browser:</p>
<p style="margin:0 0 20px;font-size:12px;color:${BLUE};font-family:monospace;word-break:break-all;line-height:1.6">${resetUrl}</p>

${alertBox(`<strong>Didn't request this?</strong> If you didn't request a password reset, contact support immediately at <a href="mailto:${SUPPORT_EMAIL}" style="color:#1d4ed8">${SUPPORT_EMAIL}</a> — your account may be at risk.`, "#dc2626", "#fef2f2")}
`, "Reset your Relay password — link expires in 1 hour")
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Trial Expiring Soon
// ─────────────────────────────────────────────────────────────────────────────

export function trialExpiringEmail({ name, orgName, daysLeft, upgradeUrl, usageStats }: {
  name: string
  orgName: string
  daysLeft: number
  upgradeUrl: string
  usageStats?: { issues?: number; users?: number; locations?: number }
}): string {
  const urgent = daysLeft <= 3
  const accentColor = urgent ? "#dc2626" : "#d97706"
  const accentBg    = urgent ? "#fef2f2" : "#fffbeb"

  return layout(`
<div style="background:${accentBg};border:1px solid ${accentColor}44;border-radius:10px;padding:20px;margin:0 0 28px;text-align:center">
  <p style="margin:0;font-size:36px;font-weight:800;color:${accentColor};font-family:${FONT};letter-spacing:-1px">${daysLeft}</p>
  <p style="margin:2px 0 0;font-size:14px;color:${accentColor};font-family:${FONT};font-weight:500">${daysLeft === 1 ? "day" : "days"} remaining on your trial</p>
</div>

<h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Don't lose access to your data</h1>
<p style="margin:0 0 28px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${name}, your free trial for <strong style="color:${TEXT}">${orgName}</strong> ends in <strong style="color:${TEXT}">${daysLeft} ${daysLeft === 1 ? "day" : "days"}</strong>. Upgrade now to keep full access to everything you've built.</p>

<div style="margin:0 0 28px">
  ${btn("Upgrade Now →", upgradeUrl, accentColor)}
</div>

${usageStats ? card(`
  ${usageStats.issues !== undefined ? infoRow("Issues logged", String(usageStats.issues)) : ""}
  ${usageStats.users !== undefined ? infoRow("Team members", String(usageStats.users)) : ""}
  ${usageStats.locations !== undefined ? infoRow("Locations", String(usageStats.locations)) : ""}
`) : ""}

<p style="margin:0 0 10px;font-size:14px;font-weight:600;color:${TEXT};font-family:${FONT}">What you'll lose if you don't upgrade:</p>
<ul style="margin:0 0 24px;padding-left:20px;color:${MUTED};font-size:13px;font-family:${FONT};line-height:2">
  <li>All issue tracking history and open issues</li>
  <li>Team member accounts and permissions</li>
  <li>Automated routing rules and escalation policies</li>
  <li>AI-powered suggestions and category inference</li>
  <li>Analytics, SOPs, and purchase requests</li>
</ul>

<p style="margin:0;font-size:13px;color:${MUTED};font-family:${FONT}">Questions about pricing? Reply to this email or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:${BLUE};text-decoration:none">${SUPPORT_EMAIL}</a></p>
`, `Your Relay trial expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"} — upgrade to keep access`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Trial Expired
// ─────────────────────────────────────────────────────────────────────────────

export function trialExpiredEmail({ name, orgName, upgradeUrl }: {
  name: string
  orgName: string
  upgradeUrl: string
}): string {
  return layout(`
<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Your trial has ended</h1>
<p style="margin:0 0 28px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${name}, the free trial for <strong style="color:${TEXT}">${orgName}</strong> has ended. Your account is currently paused — but all your data is safe and preserved.</p>

<div style="background:${SURFACE};border:1px solid ${BORDER};border-radius:10px;padding:32px;text-align:center;margin:0 0 28px">
  <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:${TEXT};font-family:${FONT}">Ready to get back on track?</p>
  <p style="margin:0 0 20px;font-size:13px;color:${MUTED};font-family:${FONT}">Subscribe in seconds — no data loss, pick up right where you left off.</p>
  ${btn("Reactivate My Account →", upgradeUrl)}
</div>

${alertBox(`<strong>Your data is safe.</strong> All your issues, team members, locations, and history are preserved for 30 days. After that, inactive accounts are permanently deleted.`)}

<p style="margin:20px 0 6px;font-size:14px;font-weight:600;color:${TEXT};font-family:${FONT}">Need help choosing a plan?</p>
<p style="margin:0;font-size:13px;color:${MUTED};font-family:${FONT}">Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${BLUE};text-decoration:none">${SUPPORT_EMAIL}</a> and we'll find the right fit for your team size and needs.</p>
`, "Your Relay trial has ended — your data is safe, reactivate to restore access")
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Payment Confirmation
// ─────────────────────────────────────────────────────────────────────────────

export function paymentConfirmationEmail({ name, planName, amount, currency = "USD", billingPeriod, nextBillingDate, billingUrl }: {
  name: string
  planName: string
  amount: number
  currency?: string
  billingPeriod: string
  nextBillingDate: string
  billingUrl: string
}): string {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100)

  return layout(`
<div style="text-align:center;margin:0 0 28px">
  <div style="display:inline-flex;align-items:center;justify-content:center;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:50%;width:60px;height:60px;font-size:28px">✓</div>
  <h1 style="margin:14px 0 6px;font-size:26px;font-weight:800;color:#16a34a;font-family:${FONT};letter-spacing:-0.5px">Payment confirmed</h1>
  <p style="margin:0;font-size:15px;color:${MUTED};font-family:${FONT}">Thank you, ${name}. Your Relay subscription is active.</p>
</div>

${card(`
  ${infoRow("Plan", planName)}
  ${infoRow("Amount charged", formatted)}
  ${infoRow("Billing period", billingPeriod)}
  ${infoRow("Next billing date", nextBillingDate)}
`)}

<p style="margin:0 0 8px;font-size:13px;color:${MUTED};font-family:${FONT}">Manage your subscription, update payment methods, and download receipts from your billing portal.</p>
<p style="margin:0"><a href="${billingUrl}" style="color:${BLUE};font-size:13px;font-family:${FONT};text-decoration:none;font-weight:500">Manage billing →</a></p>
`, `Payment confirmed — Relay ${planName} ${formatted}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Payment Failed
// ─────────────────────────────────────────────────────────────────────────────

export function paymentFailedEmail({ name, planName, amount, currency = "USD", failedDate, retryDate, billingUrl }: {
  name: string
  planName: string
  amount: number
  currency?: string
  failedDate: string
  retryDate?: string
  billingUrl: string
}): string {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100)

  return layout(`
<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#dc2626;font-family:${FONT};letter-spacing:-0.5px">Payment failed</h1>
<p style="margin:0 0 28px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${name}, we were unable to process your payment for <strong style="color:${TEXT}">Relay ${planName}</strong>. Please update your payment method to keep your account active.</p>

<div style="margin:0 0 28px">
  ${btn("Update Payment Method →", billingUrl, "#dc2626")}
</div>

${card(`
  ${infoRow("Plan", planName)}
  ${infoRow("Amount", formatted)}
  ${infoRow("Failed on", failedDate)}
  ${retryDate ? infoRow("Next retry", retryDate) : ""}
`)}

${alertBox(`<strong>Action required:</strong> If payment is not resolved within 7 days, your account will be suspended. Your data will be preserved for 30 days after suspension.`, "#dc2626", "#fef2f2")}

<p style="margin:0;font-size:13px;color:${MUTED};font-family:${FONT}">Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${BLUE};text-decoration:none">${SUPPORT_EMAIL}</a></p>
`, `Action required: Payment of ${formatted} failed for Relay ${planName}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Issue Assigned
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, { text: string; bg: string }> = {
  CRITICAL: { text: "#991b1b", bg: "#fef2f2" },
  HIGH:     { text: "#92400e", bg: "#fffbeb" },
  MEDIUM:   { text: "#1d4ed8", bg: "#eff6ff" },
  LOW:      { text: "#166534", bg: "#f0fdf4" },
}

export function issueAssignedEmail({ assigneeName, issuerName, issueTitle, priority, issueUrl, description, category, locationName }: {
  assigneeName: string
  issuerName: string
  issueTitle: string
  priority: string
  issueUrl: string
  description?: string | null
  category?: string | null
  locationName?: string | null
}): string {
  const p = PRIORITY_STYLE[priority.toUpperCase()] ?? PRIORITY_STYLE.MEDIUM
  const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase()

  return layout(`
<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">New issue assigned to you</h1>
<p style="margin:0 0 24px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${assigneeName}, <strong style="color:${TEXT}">${issuerName}</strong> has assigned the following issue to you.</p>

<div style="background:${SURFACE};border:1px solid ${BORDER};border-radius:10px;padding:24px;margin:0 0 24px">
  <div style="margin-bottom:12px">${badge(priorityLabel, p.text, p.bg)}</div>
  <h2 style="margin:0 0 10px;font-size:17px;font-weight:600;color:${TEXT};font-family:${FONT}">${issueTitle}</h2>
  ${description ? `<p style="margin:0 0 14px;font-size:13px;color:${MUTED};font-family:${FONT};line-height:1.6">${description.slice(0, 300)}${description.length > 300 ? "…" : ""}</p>` : ""}
  ${category || locationName ? `<p style="margin:0;font-size:12px;color:${SUBTLE};font-family:${FONT}">${[
    category ? category.replace(/_/g, " ") : "",
    locationName ? `📍 ${locationName}` : "",
  ].filter(Boolean).join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</p>` : ""}
</div>

${btn("View Issue →", issueUrl)}

<p style="margin:24px 0 0;font-size:12px;color:${SUBTLE};font-family:${FONT}">You received this because you were assigned an issue in Relay.</p>
`, `New issue assigned: ${issueTitle} [${priorityLabel}]`)
}

// Backward-compat alias used by existing notify route
export const issueAssignmentEmail = issueAssignedEmail

// ─────────────────────────────────────────────────────────────────────────────
// 10. Issue Escalated
// ─────────────────────────────────────────────────────────────────────────────

export function issueEscalatedEmail({ recipientName, escalatedByName, issueTitle, issueUrl, reason, toLevel, currentStatus }: {
  recipientName: string
  escalatedByName: string
  issueTitle: string
  issueUrl: string
  reason?: string | null
  toLevel: number
  currentStatus: string
}): string {
  return layout(`
<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;margin:0 0 24px">
  <p style="margin:0;font-size:13px;font-weight:700;color:#dc2626;font-family:${FONT}">⚠ Issue Escalated — Requires Immediate Attention</p>
</div>

<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Escalated to Level ${toLevel}</h1>
<p style="margin:0 0 24px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${recipientName}, <strong style="color:${TEXT}">${escalatedByName}</strong> has escalated an issue that requires your attention.</p>

<div style="background:${SURFACE};border:1px solid ${BORDER};border-radius:10px;padding:24px;margin:0 0 24px">
  <h2 style="margin:0 0 14px;font-size:16px;font-weight:600;color:${TEXT};font-family:${FONT}">${issueTitle}</h2>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    ${infoRow("Escalated by", escalatedByName)}
    ${infoRow("Escalation level", `Level ${toLevel}`)}
    ${infoRow("Current status", currentStatus.replace(/_/g, " "))}
    ${reason ? infoRow("Reason", reason) : ""}
  </table>
</div>

${btn("View Escalated Issue →", issueUrl, "#dc2626")}

<p style="margin:24px 0 0;font-size:12px;color:${SUBTLE};font-family:${FONT}">You received this because an issue in your organization has been escalated.</p>
`, `Escalated: ${issueTitle} — requires immediate attention`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Injury Report Alert
// ─────────────────────────────────────────────────────────────────────────────

const SEV_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  MINOR:    { label: "Minor / First Aid",   color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  MODERATE: { label: "Moderate",            color: "#92400e", bg: "#fffbeb", border: "#fcd34d" },
  SEVERE:   { label: "Severe / Emergency",  color: "#991b1b", bg: "#fef2f2", border: "#fca5a5" },
}

export function injuryAlertEmail({ reporterName, severity, injuryDescription, locationName, issueUrl, orgName, reportedAt }: {
  reporterName: string
  severity: string
  injuryDescription: string
  locationName?: string | null
  issueUrl: string
  orgName: string
  reportedAt?: string
}): string {
  const s = SEV_STYLE[severity] ?? SEV_STYLE.MINOR
  const isSevere = severity === "SEVERE"

  return layout(`
<div style="background:${s.bg};border:1px solid ${s.border};border-radius:8px;padding:14px 18px;margin:0 0 24px">
  <p style="margin:0;font-size:13px;font-weight:700;color:${s.color};font-family:${FONT}">${isSevere ? "🚨 " : "⚠ "}Workplace Injury Report — ${s.label}</p>
</div>

<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Injury Report Submitted</h1>
<p style="margin:0 0 24px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6"><strong style="color:${TEXT}">${reporterName}</strong> has submitted a workplace injury report requiring immediate attention.</p>

${card(`
  ${infoRow("Reporter", reporterName)}
  ${infoRow("Severity", `<span style="color:${s.color};font-weight:600">${s.label}</span>`)}
  ${locationName ? infoRow("Location", locationName) : ""}
  ${reportedAt ? infoRow("Reported at", reportedAt) : ""}
  ${infoRow("Description", `<span style="white-space:pre-wrap;line-height:1.6">${injuryDescription.slice(0, 500)}${injuryDescription.length > 500 ? "…" : ""}</span>`)}
`)}

${isSevere ? alertBox(`<strong>Emergency protocol:</strong> A severe injury has been reported. Consider calling emergency services (911) if the employee requires immediate medical attention. Document all actions taken.`, "#dc2626", "#fef2f2") : ""}

${btn("View Injury Report →", issueUrl, s.color)}

<p style="margin:24px 0 0;font-size:12px;color:${SUBTLE};font-family:${FONT}">Sent via Relay — ${orgName}. This is an automated safety notification.</p>
`, `${isSevere ? "🚨 " : ""}Injury Report: ${reporterName} — ${s.label}${locationName ? ` at ${locationName}` : ""}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Password Changed Confirmation
// ─────────────────────────────────────────────────────────────────────────────

export function passwordChangedEmail({ name, changedAt }: {
  name: string
  changedAt: string
}): string {
  return layout(`
<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Password changed</h1>
<p style="margin:0 0 24px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${name}, your Relay account password was successfully changed.</p>

${card(infoRow("Changed on", changedAt))}

${alertBox(`<strong>Didn't make this change?</strong> If you didn't change your password, your account may be compromised. <a href="mailto:${SUPPORT_EMAIL}" style="color:#1d4ed8">Contact support immediately</a> to secure your account.`, "#dc2626", "#fef2f2")}

<p style="margin:20px 0 0;font-size:12px;color:${SUBTLE};font-family:${FONT}">You received this security notice because the password on your Relay account changed.</p>
`, "Your Relay password was successfully changed")
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Account Lookup (forgot username / email)
// ─────────────────────────────────────────────────────────────────────────────

export function forgotUsernameEmail({ name, email, orgName }: {
  name: string
  email: string
  orgName: string
}): string {
  return layout(`
<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Your Relay login email</h1>
<p style="margin:0 0 28px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${name}, you requested a lookup for your Relay account. Here are your login details.</p>

${card(`
  ${infoRow("Name", name)}
  ${infoRow("Organization", orgName)}
  ${infoRow("Login email", `<strong style="color:${TEXT}">${email}</strong>`)}
`)}

<div style="margin:24px 0">
  ${btn("Sign In to Relay →", `${APP_URL}/login`)}
</div>

${alertBox(`<strong>Didn't request this?</strong> If you didn't request an account lookup, you can safely ignore this email.`)}
`, `Your Relay login email for ${orgName}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor Dispatch (unchanged functionality, updated design)
// ─────────────────────────────────────────────────────────────────────────────

export function vendorDispatchEmail({ vendorContactName, orgName, issueTitle, description, priority, locationName, assetName, assetTag, customBody }: {
  vendorContactName: string
  orgName: string
  issueTitle: string
  description?: string | null
  priority: string
  locationName?: string | null
  assetName?: string | null
  assetTag?: string | null
  customBody?: string | null
}): string {
  if (customBody) {
    return layout(`<div style="font-size:14px;color:${TEXT};font-family:${FONT};white-space:pre-wrap;line-height:1.7">${customBody}</div>`)
  }

  const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase()

  return layout(`
<h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Service Request from ${orgName}</h1>
<p style="margin:0 0 24px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Dear ${vendorContactName},<br><br>${orgName} requires your assistance with the following issue.</p>

${card(`
  ${infoRow("Issue", issueTitle)}
  ${infoRow("Priority", priorityLabel)}
  ${locationName ? infoRow("Location", locationName) : ""}
  ${assetName ? infoRow("Asset", `${assetName}${assetTag ? ` (${assetTag})` : ""}`) : ""}
  ${description ? infoRow("Details", description) : ""}
`)}

<p style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};line-height:1.6">Please reply to confirm your availability and estimated arrival time.</p>
<p style="margin:0;font-size:14px;color:${TEXT};font-family:${FONT}">Thank you,<br><strong>${orgName}</strong></p>
`, `Service request from ${orgName}: ${issueTitle}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Referral reward notification emails
// ─────────────────────────────────────────────────────────────────────────────

export function referralRewardReferrerEmail({
  referrerAdminName,
  referrerOrgName,
  referredOrgName,
  rewardDescription,
  dashboardUrl,
}: {
  referrerAdminName: string
  referrerOrgName:   string
  referredOrgName:   string
  rewardDescription: string
  dashboardUrl:      string
}): EmailPayload {
  return {
    to: "", // caller sets .to
    subject: `Your Relay referral reward has been applied — ${rewardDescription}`,
    html: layout(`
<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">Your referral reward is here!</h1>
<p style="margin:0 0 24px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${referrerAdminName}, thanks for referring ${referredOrgName} to Relay. They've now been an active customer long enough to qualify your referral reward.</p>

${card(`
  ${infoRow("Reward", `<strong style="color:${TEXT}">${rewardDescription}</strong>`)}
  ${infoRow("Credited to", referrerOrgName)}
  ${infoRow("Referred org", referredOrgName)}
`)}

<p style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};line-height:1.6">Your discount has been applied automatically to your Relay subscription. No action is needed from you.</p>
${btn("View your dashboard", dashboardUrl)}
<p style="margin:16px 0 0;font-size:13px;color:${MUTED};font-family:${FONT}">Questions? Reply to this email or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:${BLUE};text-decoration:none">${SUPPORT_EMAIL}</a></p>
`, `Your referral reward has been applied — ${rewardDescription}`),
  }
}

export function referralRewardReferredEmail({
  referredAdminName,
  referredOrgName,
  referrerOrgName,
  rewardDescription,
  dashboardUrl,
}: {
  referredAdminName: string
  referredOrgName:   string
  referrerOrgName:   string
  rewardDescription: string
  dashboardUrl:      string
}): EmailPayload {
  return {
    to: "",
    subject: `A referral reward has been applied to your Relay account — ${rewardDescription}`,
    html: layout(`
<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${TEXT};font-family:${FONT};letter-spacing:-0.5px">You've earned a referral reward</h1>
<p style="margin:0 0 24px;font-size:15px;color:${MUTED};font-family:${FONT};line-height:1.6">Hi ${referredAdminName}, as a thank-you for joining Relay through ${referrerOrgName}'s referral, we've applied a reward to your account.</p>

${card(`
  ${infoRow("Reward", `<strong style="color:${TEXT}">${rewardDescription}</strong>`)}
  ${infoRow("Credited to", referredOrgName)}
`)}

<p style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};line-height:1.6">Your discount has been applied automatically to your Relay subscription. No action is needed from you.</p>
${btn("View your dashboard", dashboardUrl)}
<p style="margin:16px 0 0;font-size:13px;color:${MUTED};font-family:${FONT}">Questions? Reply to this email or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:${BLUE};text-decoration:none">${SUPPORT_EMAIL}</a></p>
`, `A referral reward has been applied to your account`),
  }
}
