import { orgDb } from "./org-db"
import { sendEmailSafe } from "./email"

// Minimal notification layer (email only, fire-and-forget). Recipients are
// resolved org-scoped; delivery never blocks or fails the triggering request.

export async function notifyManagers(orgId: string, subject: string, text: string): Promise<void> {
  const managers = await orgDb(orgId).user.findMany({
    where: { role: { in: ["OWNER", "ADMIN", "MANAGER"] }, isActive: true },
    select: { email: true },
  })
  const to = managers.map((m) => m.email)
  if (to.length) sendEmailSafe({ to, subject, text })
}

export async function notifyUser(orgId: string, userId: string, subject: string, text: string): Promise<void> {
  const user = await orgDb(orgId).user.findFirst({ where: { id: userId, isActive: true }, select: { email: true } })
  if (user?.email) sendEmailSafe({ to: user.email, subject, text })
}
