import { NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await getSession()
  if (!session?.impersonatedBy) {
    return NextResponse.json({ error: "Not in an impersonation session" }, { status: 400 })
  }

  // Close the audit log entry
  if (session.impersonationLogId) {
    await prisma.impersonationLog.update({
      where: { id: session.impersonationLogId },
      data:  { endedAt: new Date() },
    }).catch(() => {}) // non-fatal if log was already closed
  }

  // Re-fetch the super admin to restore their session
  const superAdmin = await prisma.superAdmin.findUnique({
    where: { id: session.impersonatedBy },
  })

  if (!superAdmin || !superAdmin.isActive) {
    return NextResponse.json({ error: "Super admin account not found or disabled" }, { status: 403 })
  }

  await createSession({
    userId:         superAdmin.id,
    email:          superAdmin.email,
    name:           superAdmin.name,
    role:           "SUPER_ADMIN",
    organizationId: "",
    superAdmin:     true,
    superAdminId:   superAdmin.id,
  })

  return NextResponse.json({ success: true })
}
