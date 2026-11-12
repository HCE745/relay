import "server-only"
import { NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// POST /api/super-admin/crm/exit-rep-impersonation
// Ends the current CRM rep impersonation session and restores the super admin's
// normal session.  Also closes the audit log entry.
export async function POST() {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!session.crmImpersonatedSalesUserId) {
    return NextResponse.json({ error: "No active rep impersonation to exit" }, { status: 400 })
  }

  // Close the audit log entry
  if (session.crmImpersonationLogId) {
    await prisma.crmRepImpersonationLog.update({
      where: { id: session.crmImpersonationLogId },
      data:  { endedAt: new Date() },
    }).catch(() => { /* ignore if already closed or missing */ })
  }

  // Issue clean SA session without impersonation fields
  const { crmImpersonatedSalesUserId, crmImpersonationExpiresAt, crmImpersonationLogId, ...cleanSession } = session
  await createSession(cleanSession)

  return NextResponse.json({ ok: true })
}
