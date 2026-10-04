import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { portalInviteSchema } from "@/lib/zod-schemas"
import { createPortalInvite } from "@/lib/data/portal"
import { isEmailConfigured, sendEmail } from "@/lib/email"

const CAP = "portal.customerAccess"

// Manager invites a customer contact. Sends the accept link by email when email
// is configured; otherwise returns the link for the manager to share (BLOCKED
// on Resend → degrade to a copyable link).
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(portalInviteSchema, request)
  if (!body.ok) return body.response
  const appUrl = process.env.CLEANING_APP_URL || new URL(request.url).origin
  return runWrite(async () => {
    const invite = await createPortalInvite(g.orgId, body.data.customerId, body.data.email, g.session.userId, appUrl)
    let emailed = false
    if (isEmailConfigured()) {
      await sendEmail({ to: invite.email, subject: "Your HCE Cleaning portal invitation", text: `You've been invited to the customer portal.\n\nActivate your account: ${invite.link}\n\nThis link expires in 7 days.` })
      emailed = true
    }
    // Only return the raw link when we could NOT email it.
    return { emailed, link: emailed ? null : invite.link }
  }, { created: true })
}
