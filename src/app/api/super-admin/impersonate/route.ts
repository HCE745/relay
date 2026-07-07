import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { organizationId } = await req.json() as { organizationId: string }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: {
        where: { role: "ADMIN", isActive: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  })

  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  const adminUser = org.users[0]
  if (!adminUser) {
    return NextResponse.json({ error: "No active admin user found in this organization" }, { status: 422 })
  }

  const log = await prisma.impersonationLog.create({
    data: {
      superAdminId:   session.superAdminId,
      superAdminName: session.name,
      organizationId: org.id,
      orgName:        org.name,
      targetUserId:   adminUser.id,
      targetUserName: adminUser.name,
    },
  })

  await createSession({
    userId:           adminUser.id,
    email:            adminUser.email,
    name:             adminUser.name,
    role:             adminUser.role,
    organizationId:   org.id,
    onboardingCompleted: true,
    subscriptionStatus: "active",
    superAdmin:       false,
    superAdminId:     session.superAdminId,
    impersonatedBy:       session.superAdminId,
    impersonatedByName:   session.name,
    impersonatedOrgName:  org.name,
    impersonationLogId:   log.id,
  })

  return NextResponse.json({ success: true })
}
