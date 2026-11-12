import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// POST /api/super-admin/crm/impersonate-rep
// { salesUserId: string }
// Initiates a CRM rep impersonation session for a super admin.
// The SA's real identity is preserved in the session JWT; the impersonated
// rep's ID is added so all CRM data routes scope to that rep.
// Email sending and other mutations are blocked while impersonating.
// Sessions auto-expire after 8 hours.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Forbidden — super admin only" }, { status: 403 })
  }

  // Block nested impersonation
  if (session.crmImpersonatedSalesUserId) {
    return NextResponse.json({ error: "Already impersonating a rep — exit first" }, { status: 400 })
  }

  const body = await req.json() as { salesUserId?: string }
  if (!body.salesUserId) {
    return NextResponse.json({ error: "salesUserId required" }, { status: 400 })
  }

  const salesUser = await prisma.salesUser.findUnique({
    where:  { id: body.salesUserId },
    select: { id: true, name: true, isActive: true, role: true },
  })
  if (!salesUser || !salesUser.isActive) {
    return NextResponse.json({ error: "Sales user not found or inactive" }, { status: 404 })
  }

  // Write audit log
  const log = await prisma.crmRepImpersonationLog.create({
    data: {
      superAdminId:   session.superAdminId!,
      superAdminName: session.name ?? "Super Admin",
      salesUserId:    salesUser.id,
      salesUserName:  salesUser.name,
    },
  })

  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)

  // Issue new session JWT that carries both SA identity and the impersonated rep.
  await createSession({
    ...session,
    crmImpersonatedSalesUserId: salesUser.id,
    crmImpersonationExpiresAt:  expiresAt.toISOString(),
    crmImpersonationLogId:      log.id,
  })

  return NextResponse.json({
    ok:           true,
    salesUserId:  salesUser.id,
    salesUserName: salesUser.name,
    expiresAt:    expiresAt.toISOString(),
  })
}
